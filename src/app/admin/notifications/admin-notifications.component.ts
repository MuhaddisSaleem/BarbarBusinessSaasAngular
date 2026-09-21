import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AdminNotification, NotificationService } from './notification.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss'
})
export class AdminNotificationsComponent {
  sidebarOpen = false;
  activeFilter: 'all' | 'unread' = 'all';

  readonly currentUser = {
    name: 'Salon Owner',
    role: 'Administrator',
    initials: 'MS'
  };

  constructor(
    private readonly router: Router,
    public readonly notificationService: NotificationService
  ) {}

  get notifications(): AdminNotification[] {
    return this.activeFilter === 'unread'
      ? this.notificationService.notifications.filter(item => item.unread)
      : this.notificationService.notifications;
  }

  get currentDateLabel(): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.activeFilter = filter;
  }

  openNotification(notification: AdminNotification): void {
    this.notificationService.markAsRead(notification.id);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  goToDashboard(): void {
    void this.router.navigateByUrl('/admin');
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }
}
