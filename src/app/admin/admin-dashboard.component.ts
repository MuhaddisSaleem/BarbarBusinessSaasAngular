import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AdminNotification, NotificationService } from './notifications/notification.service';

type AppointmentStatus = 'Confirmed' | 'Pending' | 'Completed';

interface DashboardStat {
  label: string;
  value: string;
  detail: string;
  trend: string;
  icon: string;
}

interface Appointment {
  time: string;
  customer: string;
  service: string;
  barber: string;
  price: number;
  status: AppointmentStatus;
  initials: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent {
  sidebarOpen = false;
  profileMenuOpen = false;
  notificationMenuOpen = false;
  activeStatus: 'All' | AppointmentStatus = 'All';

  readonly currentUser = {
    name: 'Salon Owner',
    role: 'Administrator',
    initials: 'MS'
  };

  constructor(
    private readonly router: Router,
    public readonly notificationService: NotificationService
  ) {}

  get greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 17) {
      return 'Good afternoon';
    }

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

  readonly stats: DashboardStat[] = [
    { label: 'Today\'s Bookings', value: '18', detail: '4 still upcoming', trend: '+12%', icon: 'bi-calendar2-check' },
    { label: 'Today\'s Revenue', value: 'Rs. 24,800', detail: 'Rs. 6,200 pending', trend: '+8.4%', icon: 'bi-cash-stack' },
    { label: 'Customers', value: '146', detail: '12 new this month', trend: '+18%', icon: 'bi-people' },
    { label: 'Active Barbers', value: '3', detail: 'All available today', trend: '100%', icon: 'bi-person-badge' }
  ];

  readonly appointments: Appointment[] = [
    { time: '09:00 AM', customer: 'Hamza Ali', service: 'Haircut', barber: 'Ahmed', price: 700, status: 'Confirmed', initials: 'HA' },
    { time: '10:00 AM', customer: 'Usman Tariq', service: 'Hair + Beard', barber: 'Ali', price: 1000, status: 'Confirmed', initials: 'UT' },
    { time: '11:30 AM', customer: 'Adeel Khan', service: '6 Step Face Massage', barber: 'Usman', price: 5000, status: 'Pending', initials: 'AK' },
    { time: '01:00 PM', customer: 'Saad Ahmed', service: 'Beard Trim', barber: 'Ahmed', price: 400, status: 'Confirmed', initials: 'SA' },
    { time: '03:30 PM', customer: 'Fahad Raza', service: 'Hair Coloring', barber: 'Ali', price: 2000, status: 'Completed', initials: 'FR' },
    { time: '05:00 PM', customer: 'Bilal Aslam', service: 'Hair Wash', barber: 'Usman', price: 300, status: 'Confirmed', initials: 'BA' }
  ];

  readonly topServices = [
    { name: 'Haircut', bookings: 62, percent: 88, revenue: 'Rs. 43,400' },
    { name: 'Hair + Beard', bookings: 38, percent: 67, revenue: 'Rs. 38,000' },
    { name: 'Beard Trim', bookings: 31, percent: 54, revenue: 'Rs. 12,400' },
    { name: 'Face Massage', bookings: 16, percent: 34, revenue: 'Rs. 80,000' }
  ];

  readonly recentCustomers = [
    { name: 'Hamza Ali', phone: '+92 300 1234567', visits: 8, spend: 'Rs. 8,400', initials: 'HA' },
    { name: 'Usman Tariq', phone: '+92 321 4567890', visits: 5, spend: 'Rs. 5,600', initials: 'UT' },
    { name: 'Adeel Khan', phone: '+92 333 9876543', visits: 3, spend: 'Rs. 7,100', initials: 'AK' },
    { name: 'Saad Ahmed', phone: '+92 305 7788990', visits: 6, spend: 'Rs. 4,900', initials: 'SA' }
  ];

  get filteredAppointments(): Appointment[] {
    return this.activeStatus === 'All'
      ? this.appointments
      : this.appointments.filter(item => item.status === this.activeStatus);
  }

  setStatus(status: 'All' | AppointmentStatus): void {
    this.activeStatus = status;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationMenuOpen = false;
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  toggleNotificationMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.profileMenuOpen = false;
    this.notificationMenuOpen = !this.notificationMenuOpen;
  }

  openNotification(notification: AdminNotification): void {
    this.notificationService.markAsRead(notification.id);
  }

  markAllNotificationsAsRead(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead();
  }

  viewAllNotifications(): void {
    this.notificationMenuOpen = false;
    void this.router.navigateByUrl('/admin/notifications');
  }

  goToNotifications(): void {
    this.closeSidebar();
    void this.router.navigateByUrl('/admin/notifications');
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  logout(): void {
    this.profileMenuOpen = false;

    // Ready for the real authentication phase: clear any persisted admin
    // session values if they exist, then return to the public booking site.
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');

    void this.router.navigateByUrl('/');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeProfileMenu();
    this.notificationMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfileMenu();
    this.notificationMenuOpen = false;
  }
}
