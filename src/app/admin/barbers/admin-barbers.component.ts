import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminShellComponent } from '../shared/admin-shell.component';
import {
  AdminBarber,
  AdminBarberService,
  BarberAccountStatus,
  BarberAvailability
} from './admin-barber.service';
import { AdminServiceService } from '../services/admin-service.service';
import { AdminBookingService } from '../bookings/admin-booking.service';

@Component({
  selector: 'app-admin-barbers',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-barbers.component.html',
  styleUrl: './admin-barbers.component.scss'
})
export class AdminBarbersComponent {
  searchTerm = '';
  selectedAvailability = 'All';
  selectedStatus: 'All' | BarberAccountStatus = 'All';

  addModalOpen = false;
  editModalOpen = false;
  leaveModalOpen = false;
  deleteModalOpen = false;
  selectedBarber: AdminBarber | null = null;
  editCandidate: AdminBarber | null = null;
  deleteCandidate: AdminBarber | null = null;

  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  imageValidationState: 'idle' | 'checking' | 'valid' | 'invalid' | 'unsupported' = 'idle';
  imageValidationMessage = '';
  manualFaceConfirmed = false;

  editImageValidationState: 'idle' | 'checking' | 'valid' | 'invalid' | 'unsupported' = 'idle';
  editImageValidationMessage = '';
  editManualFaceConfirmed = false;

  newBarber = this.emptyBarberForm();
  editBarber = this.emptyBarberForm();

  leaveForm = {
    type: 'On Leave' as 'On Leave' | 'Vacation',
    from: '',
    to: '',
    note: ''
  };

  readonly availabilityOptions: BarberAvailability[] = [
    'Available Today',
    'Not Available Today',
    'On Leave',
    'Vacation'
  ];

  get specialtyOptions(): string[] {
    return this.serviceService.active.map(service => service.name);
  }

  constructor(
    public readonly barberService: AdminBarberService,
    public readonly serviceService: AdminServiceService,
    private readonly bookingService: AdminBookingService
  ) {}

  get filteredBarbers(): AdminBarber[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.barberService.all
      .filter(item =>
        this.selectedAvailability === 'All' || item.availability === this.selectedAvailability
      )
      .filter(item =>
        this.selectedStatus === 'All' || item.accountStatus === this.selectedStatus
      )
      .filter(item => {
        if (!term) return true;

        return [
          item.name,
          item.phone,
          item.experience,
          item.specialties.join(' ')
        ].some(value => value.toLowerCase().includes(term));
      });
  }

  get unavailableTodayCount(): number {
    return this.barberService.all.filter(item =>
      item.accountStatus === 'Active' && item.availability === 'Not Available Today'
    ).length;
  }

  get awayCount(): number {
    return this.barberService.all.filter(item =>
      item.accountStatus === 'Active' &&
      (item.availability === 'On Leave' || item.availability === 'Vacation')
    ).length;
  }

  openAddModal(): void {
    this.newBarber = this.emptyBarberForm();
    this.imageValidationState = 'idle';
    this.imageValidationMessage = '';
    this.manualFaceConfirmed = false;
    this.addModalOpen = true;
    this.feedbackMessage = '';
  }

  closeAddModal(): void {
    this.addModalOpen = false;
  }

  addBarber(): void {
    const digits = this.newBarber.phone.replace(/\D/g, '');

    if (!this.newBarber.name.trim() || !/^3\d{9}$/.test(digits)) {
      this.showFeedback(false, 'Enter barber name and a valid Pakistan mobile number.');
      return;
    }

    if (!this.newBarber.specialties.length) {
      this.showFeedback(false, 'Select at least one specialty.');
      return;
    }

    if (!this.newBarber.image) {
      this.showFeedback(false, 'Upload a barber photo before adding the barber.');
      return;
    }

    const photoAccepted =
      this.imageValidationState === 'valid'
      || (this.imageValidationState === 'unsupported' && this.manualFaceConfirmed);

    if (!photoAccepted) {
      this.showFeedback(false, 'Please complete the barber face check before adding the barber.');
      return;
    }

    const result = this.barberService.addBarber({
      name: this.newBarber.name,
      phone: '+92 ' + digits.slice(0, 3) + ' ' + digits.slice(3),
      experience: this.newBarber.experience || 'New',
      specialties: this.newBarber.specialties,
      workingHours: this.newBarber.workingHours.trim(),
      image: this.newBarber.image || 'assets/images/barber-placeholder.svg',
      rating: 5,
      availability: 'Available Today',
      accountStatus: 'Active',
      note: ''
    });

    this.showFeedback(result.success, result.message);

    if (result.success) {
      this.addModalOpen = false;
    }
  }

  onPhoneInput(value: string): void {
    this.newBarber.phone = value.replace(/\D/g, '').slice(0, 10);
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.newBarber.image = '';
    this.imageValidationState = 'idle';
    this.imageValidationMessage = '';
    this.manualFaceConfirmed = false;

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.imageValidationState = 'invalid';
      this.imageValidationMessage = 'Please select a valid image file.';
      this.showFeedback(false, this.imageValidationMessage);
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.imageValidationState = 'invalid';
      this.imageValidationMessage = 'Barber image must be smaller than 2 MB.';
      this.showFeedback(false, this.imageValidationMessage);
      input.value = '';
      return;
    }

    this.imageValidationState = 'checking';
    this.imageValidationMessage = 'Checking the photo for a clear barber face...';

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const faceCheck = await this.detectFaces(file);

      if (faceCheck.supported && faceCheck.count === 0) {
        this.imageValidationState = 'invalid';
        this.imageValidationMessage = 'No face detected. Upload a clear photo of the barber.';
        this.showFeedback(false, this.imageValidationMessage);
        input.value = '';
        return;
      }

      if (faceCheck.supported && faceCheck.count > 1) {
        this.imageValidationState = 'invalid';
        this.imageValidationMessage = 'Multiple faces detected. Upload a photo containing only the barber.';
        this.showFeedback(false, this.imageValidationMessage);
        input.value = '';
        return;
      }

      this.newBarber.image = dataUrl;

      if (faceCheck.supported) {
        this.imageValidationState = 'valid';
        this.imageValidationMessage = 'Face detected successfully. This photo can be used as the barber profile image.';
      } else {
        this.imageValidationState = 'unsupported';
        this.imageValidationMessage = 'Automatic face detection is not available in this browser. Please confirm the photo contains one clear barber face.';
      }
    } catch {
      this.imageValidationState = 'invalid';
      this.imageValidationMessage = 'We could not validate this image. Please try another clear photo.';
      this.showFeedback(false, this.imageValidationMessage);
      input.value = '';
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async detectFaces(file: File): Promise<{ supported: boolean; count: number }> {
    const FaceDetectorConstructor = (window as unknown as {
      FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
        detect(source: ImageBitmap): Promise<unknown[]>;
      };
    }).FaceDetector;

    if (!FaceDetectorConstructor || typeof createImageBitmap !== 'function') {
      return { supported: false, count: 0 };
    }

    const bitmap = await createImageBitmap(file);

    try {
      const detector = new FaceDetectorConstructor({
        fastMode: true,
        maxDetectedFaces: 2
      });

      const faces = await detector.detect(bitmap);
      return { supported: true, count: faces.length };
    } finally {
      bitmap.close();
    }
  }

  openEditModal(barber: AdminBarber): void {
    this.editCandidate = barber;
    this.editBarber = {
      name: barber.name,
      phone: barber.phone.replace(/\D/g, '').replace(/^92/, '').slice(-10),
      experience: this.experienceNumber(barber.experience),
      specialties: [...barber.specialties],
      workingHours: barber.workingHours,
      image: barber.image
    };
    this.editImageValidationState = 'valid';
    this.editImageValidationMessage = 'Current barber photo is already approved.';
    this.editManualFaceConfirmed = false;
    this.editModalOpen = true;
    this.feedbackMessage = '';
  }

  closeEditModal(): void {
    this.editModalOpen = false;
    this.editCandidate = null;
  }

  onEditPhoneInput(value: string): void {
    this.editBarber.phone = value.replace(/\D/g, '').slice(0, 10);
  }

  saveBarberChanges(): void {
    if (!this.editCandidate) return;

    const digits = this.editBarber.phone.replace(/\D/g, '');

    if (!this.editBarber.name.trim() || !/^3\d{9}$/.test(digits)) {
      this.showFeedback(false, 'Enter barber name and a valid Pakistan mobile number.');
      return;
    }

    if (!this.editBarber.specialties.length) {
      this.showFeedback(false, 'Select at least one specialty.');
      return;
    }

    if (!this.editBarber.image) {
      this.showFeedback(false, 'A barber profile photo is required.');
      return;
    }

    const photoAccepted =
      this.editImageValidationState === 'valid'
      || (this.editImageValidationState === 'unsupported' && this.editManualFaceConfirmed);

    if (!photoAccepted) {
      this.showFeedback(false, 'Please complete the barber face check before saving.');
      return;
    }

    const upcomingBookings = this.activeUpcomingBookingsFor(this.editCandidate.name);

    if (
      this.editBarber.name.trim() !== this.editCandidate.name
      && upcomingBookings.length
    ) {
      this.showFeedback(
        false,
        'Reassign or complete upcoming bookings before changing this barber\'s name.'
      );
      return;
    }

    const specialtySet = new Set(this.editBarber.specialties.map(item => item.trim().toLowerCase()));
    const incompatibleBooking = upcomingBookings.find(booking =>
      booking.service
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
        .some(service => !specialtySet.has(service))
    );

    if (incompatibleBooking) {
      this.showFeedback(
        false,
        'This barber has an upcoming booking for "' + incompatibleBooking.service + '". Keep those specialties or reassign the booking first.'
      );
      return;
    }

    const result = this.barberService.updateBarber(this.editCandidate.id, {
      name: this.editBarber.name,
      phone: '+92 ' + digits.slice(0, 3) + ' ' + digits.slice(3),
      experience: this.editBarber.experience,
      specialties: this.editBarber.specialties,
      workingHours: this.editBarber.workingHours,
      image: this.editBarber.image
    });

    this.showFeedback(result.success, result.message);

    if (result.success) {
      this.closeEditModal();
    }
  }

  onAvailabilityChange(barber: AdminBarber, availability: BarberAvailability): void {
    if (availability === 'On Leave' || availability === 'Vacation') {
      this.openLeaveModal(barber, availability);
      return;
    }

    const result = this.barberService.updateAvailability(barber.id, availability);
    this.showFeedback(result.success, result.message);
  }

  markUnavailableToday(barber: AdminBarber): void {
    const todayBookings = this.activeUpcomingBookingsFor(barber.name)
      .filter(booking => booking.date === this.todayKey);

    if (todayBookings.length) {
      this.showFeedback(
        false,
        barber.name + ' has ' + todayBookings.length + ' active booking' + (todayBookings.length === 1 ? '' : 's') + ' today. Reassign or cancel them first.'
      );
      return;
    }

    const result = this.barberService.updateAvailability(barber.id, 'Not Available Today');
    this.showFeedback(result.success, result.message);
  }

  markAvailableToday(barber: AdminBarber): void {
    const result = this.barberService.updateAvailability(barber.id, 'Available Today');
    this.showFeedback(result.success, result.message);
  }

  openLeaveModal(barber: AdminBarber, type: 'On Leave' | 'Vacation'): void {
    this.selectedBarber = barber;
    this.leaveForm = {
      type,
      from: barber.leaveFrom || this.todayKey,
      to: barber.leaveTo || this.todayKey,
      note: barber.note || ''
    };
    this.leaveModalOpen = true;
  }

  closeLeaveModal(): void {
    this.leaveModalOpen = false;
    this.selectedBarber = null;
  }

  saveLeave(): void {
    if (!this.selectedBarber) return;

    const overlappingBookings = this.activeUpcomingBookingsFor(this.selectedBarber.name)
      .filter(booking =>
        booking.date >= this.leaveForm.from
        && booking.date <= this.leaveForm.to
      );

    if (overlappingBookings.length) {
      this.showFeedback(
        false,
        this.selectedBarber.name + ' has ' + overlappingBookings.length + ' active booking' + (overlappingBookings.length === 1 ? '' : 's') + ' during this period. Reassign or cancel them first.'
      );
      return;
    }

    const result = this.barberService.updateLeave(
      this.selectedBarber.id,
      this.leaveForm.type,
      this.leaveForm.from,
      this.leaveForm.to,
      this.leaveForm.note
    );

    this.showFeedback(result.success, result.message);

    if (result.success) {
      this.closeLeaveModal();
    }
  }

  toggleAccountStatus(barber: AdminBarber): void {
    if (barber.accountStatus === 'Active') {
      const upcoming = this.activeUpcomingBookingsFor(barber.name);
      if (upcoming.length) {
        this.showFeedback(
          false,
          barber.name + ' has ' + upcoming.length + ' active upcoming booking' + (upcoming.length === 1 ? '' : 's') + '. Reassign or cancel them before deactivating.'
        );
        return;
      }
    }

    const result = this.barberService.toggleAccountStatus(barber.id);
    this.showFeedback(result.success, result.message);
  }

  requestDelete(barber: AdminBarber): void {
    const upcomingCount = this.activeUpcomingBookingsFor(barber.name).length;

    if (upcomingCount) {
      this.showFeedback(
        false,
        barber.name + ' has ' + upcomingCount + ' upcoming booking' + (upcomingCount === 1 ? '' : 's') + '. Reassign or cancel them before deleting this barber.'
      );
      return;
    }

    this.deleteCandidate = barber;
    this.deleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.deleteCandidate = null;
  }

  confirmDelete(): void {
    if (!this.deleteCandidate) return;

    const result = this.barberService.deleteBarber(this.deleteCandidate.id);
    this.showFeedback(result.success, result.message);

    if (result.success) {
      this.closeDeleteModal();
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedAvailability = 'All';
    this.selectedStatus = 'All';
  }

  availabilityClass(availability: BarberAvailability): string {
    if (availability === 'Available Today') return 'available';
    if (availability === 'Not Available Today') return 'unavailable';
    if (availability === 'On Leave') return 'leave';
    return 'vacation';
  }

  availabilityIcon(availability: BarberAvailability): string {
    if (availability === 'Available Today') return 'bi-check-circle';
    if (availability === 'Not Available Today') return 'bi-slash-circle';
    if (availability === 'On Leave') return 'bi-calendar2-minus';
    return 'bi-airplane';
  }

  private activeUpcomingBookingsFor(barberName: string) {
    return this.bookingService.all.filter(booking =>
      booking.barber === barberName
      && booking.date >= this.todayKey
      && (booking.status === 'Pending' || booking.status === 'Confirmed')
    );
  }

  get todayKey(): string {
    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  private experienceNumber(value: string): string {
    return String(value || '').match(/\d+(?:\.\d+)?/)?.[0] || '';
  }

  private emptyBarberForm() {
    return {
      name: '',
      phone: '',
      experience: '',
      specialties: [] as string[],
      workingHours: '',
      image: ''
    };
  }

  private showFeedback(success: boolean, message: string): void {
    this.feedbackType = success ? 'success' : 'error';
    this.feedbackMessage = message;

    window.setTimeout(() => {
      if (this.feedbackMessage === message) this.feedbackMessage = '';
    }, 3500);
  }
}
