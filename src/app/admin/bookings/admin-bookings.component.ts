import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminBooking, AdminBookingService, BookingStatus } from './admin-booking.service';

type BookingTab = 'today' | 'upcoming' | 'completed' | 'cancelled';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-bookings.component.html',
  styleUrl: './admin-bookings.component.scss'
})
export class AdminBookingsComponent {
  activeTab: BookingTab = 'today';
  searchTerm = '';
  selectedBarber = 'All';
  selectedService = 'All';
  selectedDate = '';

  selectedBooking: AdminBooking | null = null;
  drawerOpen = false;
  createModalOpen = false;
  cancelDialogOpen = false;
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  editBarber = '';
  editDate = '';
  editTime = '';

  newBooking = {
    customerName: '',
    phone: '',
    service: '',
    barber: '',
    date: '',
    time: '',
    notes: ''
  };

  readonly timeSlots = [
    '08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
    '12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM',
    '04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM',
    '08:00 PM','08:30 PM','09:00 PM'
  ];

  constructor(public readonly bookingService: AdminBookingService) {}

  get todayKey(): string {
    return this.toDateKey(new Date());
  }

  get minDate(): string {
    return this.todayKey;
  }

  get createTimeSlots(): string[] {
    const service = this.bookingService.services.find(item => item.name === this.newBooking.service);
    return this.slotsForDuration(service?.duration ?? 30);
  }

  get editTimeSlots(): string[] {
    return this.slotsForDuration(this.selectedBooking?.duration ?? 30);
  }

  get bookings(): AdminBooking[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.bookingService.all
      .filter(item => {
        if (this.activeTab === 'today') return item.date === this.todayKey && item.status !== 'Cancelled';
        if (this.activeTab === 'upcoming') return item.date > this.todayKey && item.status !== 'Completed' && item.status !== 'Cancelled';
        if (this.activeTab === 'completed') return item.status === 'Completed';
        return item.status === 'Cancelled';
      })
      .filter(item => this.selectedBarber === 'All' || item.barber === this.selectedBarber)
      .filter(item => this.selectedService === 'All' || item.service === this.selectedService)
      .filter(item => !this.selectedDate || item.date === this.selectedDate)
      .filter(item => {
        if (!term) return true;
        return [item.code, item.customerName, item.phone, item.service, item.barber]
          .some(value => value.toLowerCase().includes(term));
      })
      .sort((a, b) => a.date.localeCompare(b.date) || this.timeValue(a.time) - this.timeValue(b.time));
  }

  get todayCount(): number {
    return this.bookingService.all.filter(item => item.date === this.todayKey && item.status !== 'Cancelled').length;
  }

  get pendingCount(): number {
    return this.bookingService.all.filter(item => item.status === 'Pending').length;
  }

  get upcomingCount(): number {
    return this.bookingService.all.filter(item => item.date > this.todayKey && item.status !== 'Cancelled' && item.status !== 'Completed').length;
  }

  get cancelledCount(): number {
    return this.bookingService.all.filter(item => item.status === 'Cancelled').length;
  }

  setTab(tab: BookingTab): void {
    this.activeTab = tab;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedBarber = 'All';
    this.selectedService = 'All';
    this.selectedDate = '';
  }

  openBooking(booking: AdminBooking): void {
    this.selectedBooking = booking;
    this.editBarber = booking.barber;
    this.editDate = booking.date;
    this.editTime = booking.time;
    this.drawerOpen = true;
    this.feedbackMessage = '';
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedBooking = null;
    this.feedbackMessage = '';
  }

  setStatus(status: BookingStatus): void {
    if (!this.selectedBooking) return;
    const result = this.bookingService.updateStatus(this.selectedBooking.id, status);
    this.showFeedback(result.success, result.message);
  }

  saveBarber(): void {
    if (!this.selectedBooking || !this.editBarber) return;
    const result = this.bookingService.assignBarber(this.selectedBooking.id, this.editBarber);
    this.showFeedback(result.success, result.message);
    if (!result.success) this.editBarber = this.selectedBooking.barber;
  }

  saveSchedule(): void {
    if (!this.selectedBooking) return;
    const result = this.bookingService.reschedule(this.selectedBooking.id, this.editDate, this.editTime);
    this.showFeedback(result.success, result.message);
    if (!result.success) {
      this.editDate = this.selectedBooking.date;
      this.editTime = this.selectedBooking.time;
    }
  }

  requestCancel(): void {
    if (this.selectedBooking) this.cancelDialogOpen = true;
  }

  confirmCancel(): void {
    if (!this.selectedBooking) return;
    const result = this.bookingService.cancel(this.selectedBooking.id);
    this.cancelDialogOpen = false;
    this.showFeedback(result.success, result.message);
  }

  openCreateModal(): void {
    this.createModalOpen = true;
    this.feedbackMessage = '';
    this.newBooking = {
      customerName: '',
      phone: '',
      service: '',
      barber: '',
      date: this.todayKey,
      time: '',
      notes: ''
    };
  }

  closeCreateModal(): void {
    this.createModalOpen = false;
  }

  createBooking(): void {
    const form = this.newBooking;
    const digits = form.phone.replace(/\D/g, '');
    const service = this.bookingService.services.find(item => item.name === form.service);

    if (!form.customerName.trim() || !/^3\d{9}$/.test(digits) || !service || !form.barber || !form.date || !form.time) {
      this.showFeedback(false, 'Complete all required fields and enter a valid Pakistan mobile number.');
      return;
    }

    const result = this.bookingService.addBooking({
      customerName: form.customerName.trim(),
      phone: '+92 ' + digits.slice(0, 3) + ' ' + digits.slice(3),
      service: service.name,
      duration: service.duration,
      barber: form.barber,
      date: form.date,
      time: form.time,
      amount: service.amount,
      notes: form.notes.trim(),
      groupSize: 1
    });

    this.showFeedback(result.success, result.message);
    if (result.success) this.createModalOpen = false;
  }

  onPhoneInput(value: string): void {
    this.newBooking.phone = value.replace(/\D/g, '').slice(0, 10);
  }

  statusIcon(status: BookingStatus): string {
    if (status === 'Confirmed') return 'bi-check-circle';
    if (status === 'Pending') return 'bi-clock-history';
    if (status === 'Completed') return 'bi-check2-all';
    return 'bi-x-circle';
  }

  private showFeedback(success: boolean, message: string): void {
    this.feedbackType = success ? 'success' : 'error';
    this.feedbackMessage = message;
    window.setTimeout(() => {
      if (this.feedbackMessage === message) this.feedbackMessage = '';
    }, 3500);
  }

  private toDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  private slotsForDuration(duration: number): string[] {
    return this.timeSlots.filter(slot => this.timeValue(slot) + duration <= 21 * 60);
  }

  private timeValue(time: string): number {
    const match = time.match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
    if (!match) return 0;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
}
