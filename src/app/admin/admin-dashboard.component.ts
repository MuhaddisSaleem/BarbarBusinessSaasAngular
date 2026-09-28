import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AdminBarberService } from './barbers/admin-barber.service';
import { AdminBooking, AdminBookingService, BookingStatus } from './bookings/admin-booking.service';
import { AdminCustomerService } from './customers/admin-customer.service';
import { AdminSettingsService } from './settings/admin-settings.service';
import { AdminShellComponent } from './shared/admin-shell.component';

interface DashboardStat {
  label: string;
  value: string;
  detail: string;
  trend: string;
  icon: string;
}

interface DashboardAppointment {
  time: string;
  customer: string;
  service: string;
  barber: string;
  price: number;
  status: BookingStatus;
  initials: string;
}

interface DashboardService {
  name: string;
  bookings: number;
  percent: number;
  revenue: number;
}

interface DashboardCustomer {
  name: string;
  phone: string;
  visits: number;
  spend: number;
  initials: string;
}

interface DashboardBarberLoad {
  name: string;
  value: number;
  appointments: number;
  available: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminShellComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent {
  activeStatus: 'All' | BookingStatus = 'All';

  readonly appointmentStatuses: Array<'All' | BookingStatus> = [
    'All',
    'Confirmed',
    'Pending',
    'Completed',
    'Cancelled',
    'In Progress',
    'No Show'
  ];

  constructor(
    private readonly router: Router,
    public readonly bookingService: AdminBookingService,
    public readonly customerService: AdminCustomerService,
    public readonly barberService: AdminBarberService,
    public readonly settingsService: AdminSettingsService
  ) {}

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get currentDateLabel(): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }

  get businessName(): string {
    return this.settingsService.current.businessName || 'Salon';
  }

  get stats(): DashboardStat[] {
    const todayBookings = this.todayBookings;
    const yesterdayBookings = this.bookingsForDate(this.dateKey(-1));
    const customers = this.customerService.all;
    const activeBarbers = this.barberService.active;
    const availableBarbers = this.barberService.availableToday.length;

    return [
      {
        label: 'Today\'s Bookings',
        value: String(todayBookings.length),
        detail: this.upcomingTodayCount + ' still upcoming',
        trend: this.changeLabel(todayBookings.length, yesterdayBookings.length),
        icon: 'bi-calendar2-check'
      },
      {
        label: 'Today\'s Revenue',
        value: 'Rs. ' + this.formatNumber(this.completedRevenueToday),
        detail: 'Rs. ' + this.formatNumber(this.todayBookedValue) + ' booked value',
        trend: this.changeLabel(this.completedRevenueToday, this.completedRevenueYesterday),
        icon: 'bi-cash-stack'
      },
      {
        label: 'Customers',
        value: String(customers.length),
        detail: this.newCustomersThisMonth + ' new this month',
        trend: this.returningCustomerRate + '% returning',
        icon: 'bi-people'
      },
      {
        label: 'Active Barbers',
        value: String(activeBarbers.length),
        detail: availableBarbers + ' available today',
        trend: this.barberAvailabilityRate + '% available',
        icon: 'bi-person-badge'
      }
    ];
  }

  get appointments(): DashboardAppointment[] {
    return this.todayBookings
      .slice()
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time))
      .map(item => ({
        time: item.time,
        customer: item.customerName,
        service: item.service,
        barber: item.barber,
        price: item.amount,
        status: item.status,
        initials: this.initials(item.customerName)
      }));
  }

  get filteredAppointments(): DashboardAppointment[] {
    return this.activeStatus === 'All'
      ? this.appointments
      : this.appointments.filter(item => item.status === this.activeStatus);
  }

  get completedRevenueToday(): number {
    return this.todayBookings
      .filter(item => item.status === 'Completed')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get completedRevenueYesterday(): number {
    return this.bookingsForDate(this.dateKey(-1))
      .filter(item => item.status === 'Completed')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get todayBookedValue(): number {
    return this.todayBookings
      .filter(item => this.bookingService.blocksSlot(item))
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get todayOpenValue(): number {
    return this.todayBookings
      .filter(item => this.bookingService.isOpen(item))
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get averageBookingToday(): number {
    const activeBookings = this.todayBookings.filter(item => this.bookingService.blocksSlot(item));
    return activeBookings.length
      ? Math.round(this.todayBookedValue / activeBookings.length)
      : 0;
  }

  get revenueProgress(): number {
    if (!this.todayBookedValue) return 0;
    return Math.min(100, Math.round((this.completedRevenueToday / this.todayBookedValue) * 100));
  }

  get revenueTrendLabel(): string {
    return this.changeLabel(this.completedRevenueToday, this.completedRevenueYesterday) + ' vs yesterday';
  }

  get barberLoad(): DashboardBarberLoad[] {
    const today = this.dateKey(0);
    const hours = this.settingsService.hoursForDate(new Date(today + 'T12:00:00'));

    return this.barberService.active.map(barber => {
      const available = this.barberService.isAvailableOnDate(barber.id, today);
      const barberHours = this.barberService.workingWindowFor(barber.id);
      const capacity = hours && barberHours
        ? Math.max(0, Math.min(hours.end, barberHours.end) - Math.max(hours.start, barberHours.start))
        : 0;
      const bookings = this.todayBookings.filter(item =>
        this.bookingService.blocksSlot(item) && item.barber === barber.name
      );
      const bookedMinutes = bookings.reduce((sum, item) => sum + item.duration, 0);

      return {
        name: barber.name,
        appointments: bookings.length,
        available,
        value: available && capacity
          ? Math.min(100, Math.round((bookedMinutes / capacity) * 100))
          : 0
      };
    });
  }

  get overallBarberLoad(): number {
    const available = this.barberLoad.filter(item => item.available);
    if (!available.length) return 0;

    return Math.round(
      available.reduce((sum, item) => sum + item.value, 0) / available.length
    );
  }

  get topServices(): DashboardService[] {
    const start = this.dateKey(-29);
    const end = this.dateKey(0);
    const groups = new Map<string, AdminBooking[]>();

    this.bookingService.all
      .filter(item =>
        this.bookingService.blocksSlot(item)
        && item.date >= start
        && item.date <= end
      )
      .forEach(item => {
        const list = groups.get(item.service) || [];
        list.push(item);
        groups.set(item.service, list);
      });

    const rows = Array.from(groups.entries()).map(([name, bookings]) => ({
      name,
      bookings: bookings.length,
      percent: 0,
      revenue: bookings
        .filter(item => item.status === 'Completed')
        .reduce((sum, item) => sum + item.amount, 0)
    }));

    const maxBookings = Math.max(1, ...rows.map(item => item.bookings));

    return rows
      .map(item => ({
        ...item,
        percent: Math.round((item.bookings / maxBookings) * 100)
      }))
      .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue)
      .slice(0, 4);
  }

  get recentCustomers(): DashboardCustomer[] {
    return this.customerService.all
      .slice(0, 4)
      .map(customer => ({
        name: customer.name,
        phone: customer.phone,
        visits: customer.completedVisits,
        spend: customer.totalSpend,
        initials: this.initials(customer.name)
      }));
  }

  get upcomingTodayCount(): number {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return this.todayBookings.filter(item =>
      (item.status === 'Confirmed' || item.status === 'Pending')
      && this.timeToMinutes(item.time) >= nowMinutes
    ).length;
  }

  get newCustomersThisMonth(): number {
    const now = new Date();
    const monthStart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      '01'
    ].join('-');
    const today = this.dateKey(0);

    return this.customerService.all.filter(customer =>
      customer.firstBookingDate >= monthStart
      && customer.firstBookingDate <= today
    ).length;
  }

  get returningCustomerRate(): number {
    const customers = this.customerService.all;
    if (!customers.length) return 0;

    const returning = customers.filter(item => item.customerType === 'Returning').length;
    return Math.round((returning / customers.length) * 100);
  }

  get barberAvailabilityRate(): number {
    const active = this.barberService.active.length;
    if (!active) return 0;
    return Math.round((this.barberService.availableToday.length / active) * 100);
  }

  setStatus(status: 'All' | BookingStatus): void {
    this.activeStatus = status;
  }

  goToBookings(): void {
    void this.router.navigateByUrl('/admin/bookings');
  }

  goToReports(): void {
    void this.router.navigateByUrl('/admin/reports');
  }

  goToCustomers(): void {
    void this.router.navigateByUrl('/admin/customers');
  }

  private get todayBookings(): AdminBooking[] {
    return this.bookingsForDate(this.dateKey(0));
  }

  private bookingsForDate(date: string): AdminBooking[] {
    return this.bookingService.all.filter(item => item.date === date);
  }

  private changeLabel(current: number, previous: number): string {
    if (!previous) return current ? 'New' : '0%';

    const percent = Math.round(((current - previous) / previous) * 100);
    return (percent > 0 ? '+' : '') + percent + '%';
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  private initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'C';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  private dateKey(offset: number): string {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
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
