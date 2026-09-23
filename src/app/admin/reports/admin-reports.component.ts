import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminBooking, AdminBookingService, BookingStatus } from '../bookings/admin-booking.service';

interface ServiceReportRow {
  name: string;
  bookings: number;
  completed: number;
  value: number;
  percent: number;
}

interface BarberReportRow {
  name: string;
  bookings: number;
  completed: number;
  cancelled: number;
  value: number;
  percent: number;
}

interface DailyReportRow {
  date: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
  bookedValue: number;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss'
})
export class AdminReportsComponent {
  dateFrom = this.firstDayOfMonth();
  dateTo = this.todayKey();
  selectedBarber = 'All';
  selectedStatus: 'All' | BookingStatus = 'All';

  constructor(public readonly bookingService: AdminBookingService) {}

  get filteredBookings(): AdminBooking[] {
    return this.bookingService.all
      .filter(item => !this.dateFrom || item.date >= this.dateFrom)
      .filter(item => !this.dateTo || item.date <= this.dateTo)
      .filter(item => this.selectedBarber === 'All' || item.barber === this.selectedBarber)
      .filter(item => this.selectedStatus === 'All' || item.status === this.selectedStatus)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  get totalBookings(): number {
    return this.filteredBookings.length;
  }

  get completedBookings(): number {
    return this.filteredBookings.filter(item => item.status === 'Completed').length;
  }

  get cancelledBookings(): number {
    return this.filteredBookings.filter(item => item.status === 'Cancelled').length;
  }

  get bookedValue(): number {
    return this.filteredBookings
      .filter(item => item.status !== 'Cancelled')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get completedRevenue(): number {
    return this.filteredBookings
      .filter(item => item.status === 'Completed')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get averageCompletedTicket(): number {
    return this.completedBookings
      ? Math.round(this.completedRevenue / this.completedBookings)
      : 0;
  }

  get completionRate(): number {
    const eligible = this.filteredBookings.filter(item => item.status !== 'Cancelled').length;
    return eligible ? Math.round((this.completedBookings / eligible) * 100) : 0;
  }

  get serviceRows(): ServiceReportRow[] {
    const groups = new Map<string, AdminBooking[]>();

    this.filteredBookings
      .filter(item => item.status !== 'Cancelled')
      .forEach(item => {
        const list = groups.get(item.service) || [];
        list.push(item);
        groups.set(item.service, list);
      });

    const rows = Array.from(groups.entries()).map(([name, bookings]) => ({
      name,
      bookings: bookings.length,
      completed: bookings.filter(item => item.status === 'Completed').length,
      value: bookings.reduce((sum, item) => sum + item.amount, 0),
      percent: 0
    }));

    const maxBookings = Math.max(1, ...rows.map(item => item.bookings));

    return rows
      .map(item => ({
        ...item,
        percent: Math.round((item.bookings / maxBookings) * 100)
      }))
      .sort((a, b) => b.bookings - a.bookings || b.value - a.value);
  }

  get barberRows(): BarberReportRow[] {
    const groups = new Map<string, AdminBooking[]>();

    this.filteredBookings.forEach(item => {
      const list = groups.get(item.barber) || [];
      list.push(item);
      groups.set(item.barber, list);
    });

    const rows = Array.from(groups.entries()).map(([name, bookings]) => ({
      name,
      bookings: bookings.length,
      completed: bookings.filter(item => item.status === 'Completed').length,
      cancelled: bookings.filter(item => item.status === 'Cancelled').length,
      value: bookings
        .filter(item => item.status !== 'Cancelled')
        .reduce((sum, item) => sum + item.amount, 0),
      percent: 0
    }));

    const maxBookings = Math.max(1, ...rows.map(item => item.bookings));

    return rows
      .map(item => ({
        ...item,
        percent: Math.round((item.bookings / maxBookings) * 100)
      }))
      .sort((a, b) => b.bookings - a.bookings || b.value - a.value);
  }

  get dailyRows(): DailyReportRow[] {
    const groups = new Map<string, AdminBooking[]>();

    this.filteredBookings.forEach(item => {
      const list = groups.get(item.date) || [];
      list.push(item);
      groups.set(item.date, list);
    });

    return Array.from(groups.entries())
      .map(([date, bookings]) => ({
        date,
        bookings: bookings.length,
        completed: bookings.filter(item => item.status === 'Completed').length,
        cancelled: bookings.filter(item => item.status === 'Cancelled').length,
        revenue: bookings
          .filter(item => item.status === 'Completed')
          .reduce((sum, item) => sum + item.amount, 0),
        bookedValue: bookings
          .filter(item => item.status !== 'Cancelled')
          .reduce((sum, item) => sum + item.amount, 0)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  resetFilters(): void {
    this.dateFrom = this.firstDayOfMonth();
    this.dateTo = this.todayKey();
    this.selectedBarber = 'All';
    this.selectedStatus = 'All';
  }

  exportCsv(): void {
    const rows = [
      ['Date', 'Booking ID', 'Customer', 'Phone', 'Service', 'Barber', 'Status', 'Amount'],
      ...this.filteredBookings.map(item => [
        item.date,
        item.code,
        item.customerName,
        item.phone,
        item.service,
        item.barber,
        item.status,
        String(item.amount)
      ])
    ];

    const csv = rows
      .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'royal-barbers-report-' + this.dateFrom + '-to-' + this.dateTo + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private firstDayOfMonth(): string {
    const date = new Date();
    date.setDate(1);
    return this.toDateKey(date);
  }

  private todayKey(): string {
    return this.toDateKey(new Date());
  }

  private toDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }
}
