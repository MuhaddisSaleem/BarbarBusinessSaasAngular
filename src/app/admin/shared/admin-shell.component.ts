import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AdminNotification, NotificationService } from '../notifications/notification.service';
import { AdminBookingService } from '../bookings/admin-booking.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent {
  @Input() eyebrow = 'ADMIN CENTER';
  @Input() title = 'Royal Barbers';

  sidebarOpen = false;
  profileMenuOpen = false;
  notificationMenuOpen = false;

  readonly currentUser = {
    name: 'Salon Owner',
    role: 'Administrator',
    initials: 'MS'
  };

  constructor(
    public readonly router: Router,
    public readonly notificationService: NotificationService,
    public readonly bookingService: AdminBookingService
  ) {}

  get currentPath(): string {
    return this.router.url.split('?')[0];
  }

  isActive(path: string): boolean {
    return path === '/admin'
      ? this.currentPath === '/admin'
      : this.currentPath.startsWith(path);
  }

  navigate(path: string): void {
    this.sidebarOpen = false;
    this.notificationMenuOpen = false;
    this.profileMenuOpen = false;
    void this.router.navigateByUrl(path);
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
    this.navigate('/admin/notifications');
  }

  logout(): void {
    this.profileMenuOpen = false;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    void this.router.navigateByUrl('/');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.profileMenuOpen = false;
    this.notificationMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.profileMenuOpen = false;
    this.notificationMenuOpen = false;
    this.sidebarOpen = false;
  }
}
