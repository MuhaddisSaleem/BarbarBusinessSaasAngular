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
  leaveModalOpen = false;
  deleteModalOpen = false;
  selectedBarber: AdminBarber | null = null;
  deleteCandidate: AdminBarber | null = null;

  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  imageValidationState: 'idle' | 'checking' | 'valid' | 'invalid' | 'unsupported' = 'idle';
  imageValidationMessage = '';
  manualFaceConfirmed = false;

  newBarber = this.emptyBarberForm();

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

  readonly specialtyOptions = [
    'Haircut',
    'Beard Trim',
    'Hair + Beard',
    'Hair Coloring',
    'Hair Wash',
    'Face Massage',
    'Kids Haircut',
    'Fade',
    'Styling'
  ];

  constructor(public readonly barberService: AdminBarberService) {}

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
      workingHours: this.newBarber.workingHours || '8:00 AM – 9:00 PM',
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

  onAvailabilityChange(barber: AdminBarber, availability: BarberAvailability): void {
    if (availability === 'On Leave' || availability === 'Vacation') {
      this.openLeaveModal(barber, availability);
      return;
    }

    const result = this.barberService.updateAvailability(barber.id, availability);
    this.showFeedback(result.success, result.message);
  }

  markUnavailableToday(barber: AdminBarber): void {
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
    const result = this.barberService.toggleAccountStatus(barber.id);
    this.showFeedback(result.success, result.message);
  }

  requestDelete(barber: AdminBarber): void {
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

  get todayKey(): string {
    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  private emptyBarberForm() {
    return {
      name: '',
      phone: '',
      experience: '',
      specialties: [] as string[],
      workingHours: '8:00 AM – 9:00 PM',
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
