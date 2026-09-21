import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminBooking, AdminBookingService } from '../bookings/admin-booking.service';

type CalendarView = 'day' | 'week';

@Component({
  selector: 'app-admin-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-calendar.component.html',
  styleUrl: './admin-calendar.component.scss'
})
export class AdminCalendarComponent {
  view: CalendarView = 'day';
  selectedBarber = 'All';
  selectedDate = new Date();
  selectedBooking: AdminBooking | null = null;

  readonly slotHeight = 44;
  readonly startMinutes = 8 * 60;
  readonly endMinutes = 21 * 60;
  readonly timelineSlots = this.buildTimeline();

  constructor(
    public readonly bookingService: AdminBookingService,
    private readonly router: Router
  ) {}

  get selectedDateKey(): string {
    return this.toDateKey(this.selectedDate);
  }

  get visibleBarbers(): string[] {
    return this.selectedBarber === 'All'
      ? this.bookingService.barbers
      : [this.selectedBarber];
  }

  get dayBookings(): AdminBooking[] {
    return this.bookingService.all
      .filter(item => item.date === this.selectedDateKey && item.status !== 'Cancelled')
      .filter(item => this.selectedBarber === 'All' || item.barber === this.selectedBarber)
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  get weekDays(): Date[] {
    const start = this.startOfWeek(this.selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  get selectedDateLabel(): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.selectedDate);
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

  get totalBookings(): number {
    return this.dayBookings.length;
  }

  get confirmedBookings(): number {
    return this.dayBookings.filter(item => item.status === 'Confirmed').length;
  }

  get pendingBookings(): number {
    return this.dayBookings.filter(item => item.status === 'Pending').length;
  }

  get totalRevenue(): number {
    return this.dayBookings.reduce((sum, item) => sum + item.amount, 0);
  }

  setView(view: CalendarView): void {
    this.view = view;
    this.selectedBooking = null;
  }

  previousPeriod(): void {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() - (this.view === 'day' ? 1 : 7));
    this.selectedDate = date;
    this.selectedBooking = null;
  }

  nextPeriod(): void {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() + (this.view === 'day' ? 1 : 7));
    this.selectedDate = date;
    this.selectedBooking = null;
  }

  goToday(): void {
    this.selectedDate = new Date();
    this.selectedBooking = null;
  }

  selectWeekDay(date: Date): void {
    this.selectedDate = new Date(date);
    this.view = 'day';
  }

  bookingsForBarber(barber: string): AdminBooking[] {
    return this.dayBookings.filter(item => item.barber === barber);
  }

  bookingsForDate(date: Date): AdminBooking[] {
    const key = this.toDateKey(date);
    return this.bookingService.all
      .filter(item => item.date === key && item.status !== 'Cancelled')
      .filter(item => this.selectedBarber === 'All' || item.barber === this.selectedBarber)
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  weekDayRevenue(date: Date): number {
    return this.bookingsForDate(date).reduce((sum, item) => sum + item.amount, 0);
  }

  appointmentStyle(booking: AdminBooking): Record<string, string> {
    const start = this.timeToMinutes(booking.time);
    const top = ((start - this.startMinutes) / 30) * this.slotHeight;
    const rawHeight = (booking.duration / 30) * this.slotHeight;
    const height = Math.max(rawHeight - 5, 28);

    return {
      top: top + 'px',
      height: height + 'px'
    };
  }

  slotLabelStyle(index: number): Record<string, string> {
    return { top: (index * this.slotHeight - 7) + 'px' };
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

  statusIcon(booking: AdminBooking): string {
    if (booking.status === 'Pending') return 'bi-clock-history';
    if (booking.status === 'Completed') return 'bi-check2-all';
    return 'bi-check-circle';
  }

  isToday(date: Date): boolean {
    return this.toDateKey(date) === this.toDateKey(new Date());
  }

  private buildTimeline(): string[] {
    const slots: string[] = [];
    for (let minute = this.startMinutes; minute <= this.endMinutes; minute += 30) {
      slots.push(this.minutesToLabel(minute));
    }
    return slots;
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

  private startOfWeek(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(12, 0, 0, 0);
    const day = copy.getDay();
    const difference = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + difference);
    return copy;
  }

  private toDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }
}
