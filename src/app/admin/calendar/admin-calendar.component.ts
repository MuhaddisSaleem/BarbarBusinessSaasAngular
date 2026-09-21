import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminBooking, AdminBookingService, BookingStatus } from '../bookings/admin-booking.service';

type ScheduleView = 'daily' | 'week';

interface BarberScheduleSummary {
  name: string;
  bookings: number;
  nextAvailable: string;
  bookedMinutes: number;
}

@Component({
  selector: 'app-admin-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-calendar.component.html',
  styleUrl: './admin-calendar.component.scss'
})
export class AdminCalendarComponent {
  view: ScheduleView = 'daily';
  selectedDateKey = this.toDateKey(new Date());
  selectedBarber = 'All';
  selectedStatus: 'All' | BookingStatus = 'All';
  selectedBooking: AdminBooking | null = null;

  readonly workingStart = 8 * 60;
  readonly workingEnd = 21 * 60;
  readonly workingHoursLabel = '8:00 AM – 9:00 PM';

  constructor(
    public readonly bookingService: AdminBookingService,
    private readonly router: Router
  ) {}

  get selectedDate(): Date {
    return this.parseDateKey(this.selectedDateKey);
  }

  get selectedDateLabel(): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.selectedDate);
  }

  get dailyBookings(): AdminBooking[] {
    return this.bookingService.all
      .filter(item => item.date === this.selectedDateKey && item.status !== 'Cancelled')
      .filter(item => this.selectedBarber === 'All' || item.barber === this.selectedBarber)
      .filter(item => this.selectedStatus === 'All' || item.status === this.selectedStatus)
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  get allBookingsForSelectedDay(): AdminBooking[] {
    return this.bookingService.all
      .filter(item => item.date === this.selectedDateKey && item.status !== 'Cancelled')
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  get totalBookings(): number {
    return this.allBookingsForSelectedDay.length;
  }

  get confirmedBookings(): number {
    return this.allBookingsForSelectedDay.filter(item => item.status === 'Confirmed').length;
  }

  get pendingBookings(): number {
    return this.allBookingsForSelectedDay.filter(item => item.status === 'Pending').length;
  }

  get totalBookedValue(): number {
    return this.allBookingsForSelectedDay.reduce((sum, item) => sum + item.amount, 0);
  }

  get barberSummaries(): BarberScheduleSummary[] {
    const barbers = this.selectedBarber === 'All'
      ? this.bookingService.barbers
      : [this.selectedBarber];

    return barbers.map(name => {
      const bookings = this.allBookingsForSelectedDay
        .filter(item => item.barber === name)
        .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));

      return {
        name,
        bookings: bookings.length,
        nextAvailable: this.findNextAvailable(bookings),
        bookedMinutes: bookings.reduce((sum, item) => sum + item.duration, 0)
      };
    });
  }

  get weekDays(): Date[] {
    const start = this.startOfWeek(this.selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  get weekRangeLabel(): string {
    const days = this.weekDays;
    const first = days[0];
    const last = days[6];

    if (first.getMonth() === last.getMonth()) {
      return first.getDate() + '–' + last.getDate() + ' ' +
        first.toLocaleString('en-GB', { month: 'long' }) + ' ' + last.getFullYear();
    }

    return first.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
      ' – ' +
      last.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  setView(view: ScheduleView): void {
    this.view = view;
    this.selectedBooking = null;
  }

  previousPeriod(): void {
    this.shiftDate(this.view === 'daily' ? -1 : -7);
  }

  nextPeriod(): void {
    this.shiftDate(this.view === 'daily' ? 1 : 7);
  }

  goToday(): void {
    this.selectedDateKey = this.toDateKey(new Date());
    this.selectedBooking = null;
  }

  openDay(date: Date): void {
    this.selectedDateKey = this.toDateKey(date);
    this.view = 'daily';
    this.selectedBooking = null;
  }

  resetFilters(): void {
    this.selectedBarber = 'All';
    this.selectedStatus = 'All';
  }

  bookingsForDate(date: Date): AdminBooking[] {
    const key = this.toDateKey(date);
    return this.bookingService.all
      .filter(item => item.date === key && item.status !== 'Cancelled')
      .filter(item => this.selectedBarber === 'All' || item.barber === this.selectedBarber)
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  weekPending(date: Date): number {
    return this.bookingsForDate(date).filter(item => item.status === 'Pending').length;
  }

  weekConfirmed(date: Date): number {
    return this.bookingsForDate(date).filter(item => item.status === 'Confirmed').length;
  }

  weekValue(date: Date): number {
    return this.bookingsForDate(date).reduce((sum, item) => sum + item.amount, 0);
  }

  isToday(date: Date): boolean {
    return this.toDateKey(date) === this.toDateKey(new Date());
  }

  openBooking(booking: AdminBooking): void {
    this.selectedBooking = booking;
  }

  closePreview(): void {
    this.selectedBooking = null;
  }

  manageBooking(): void {
    if (!this.selectedBooking) return;

    void this.router.navigate(['/admin/bookings'], {
      queryParams: { booking: this.selectedBooking.id }
    });
  }

  statusIcon(status: BookingStatus): string {
    if (status === 'Pending') return 'bi-clock-history';
    if (status === 'Completed') return 'bi-check2-all';
    if (status === 'Cancelled') return 'bi-x-circle';
    return 'bi-check-circle';
  }

  private findNextAvailable(bookings: AdminBooking[]): string {
    let candidate = this.workingStart;

    if (this.selectedDateKey === this.toDateKey(new Date())) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      candidate = Math.max(candidate, Math.ceil(nowMinutes / 30) * 30);
    }

    while (candidate + 30 <= this.workingEnd) {
      const candidateEnd = candidate + 30;
      const conflict = bookings.some(booking => {
        const start = this.timeToMinutes(booking.time);
        const end = start + booking.duration;
        return candidate < end && candidateEnd > start;
      });

      if (!conflict) return this.minutesToLabel(candidate);
      candidate += 30;
    }

    return 'Fully booked';
  }

  private shiftDate(days: number): void {
    const date = this.selectedDate;
    date.setDate(date.getDate() + days);
    this.selectedDateKey = this.toDateKey(date);
    this.selectedBooking = null;
  }

  private startOfWeek(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(12, 0, 0, 0);
    const day = copy.getDay();
    const difference = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + difference);
    return copy;
  }

  private parseDateKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  private toDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  private minutesToLabel(total: number): string {
    const hour24 = Math.floor(total / 60);
    const minute = total % 60;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour = hour24 % 12 || 12;
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' ' + period;
  }

  private timeToMinutes(time: string): number {
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
