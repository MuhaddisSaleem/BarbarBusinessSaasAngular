import { Injectable } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import {
  CreateNotificationApiRequest,
  NotificationApiRecord,
  NotificationApiService
} from '../../core/notification-api.service';

export type NotificationType =
  | 'booking'
  | 'payment'
  | 'cancelled'
  | 'rescheduled'
  | 'reminder'
  | 'system';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  dateLabel: string;
  createdAt: string;
  icon: string;
  unread: boolean;
  url?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly maxItems = 100;
  private items: AdminNotification[] = [];
  private localCounter = 0;

  loading = false;
  errorMessage = '';

  constructor(
    private readonly api: NotificationApiService,
    private readonly auth: AuthService
  ) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('royal-barbers.admin-notifications.v1');
    }

    this.auth.currentUser$.subscribe(user => {
      if (user && this.auth.isAuthenticated()) {
        this.refresh();
      } else {
        this.items = [];
        this.loading = false;
        this.errorMessage = '';
      }
    });
  }

  get notifications(): AdminNotification[] {
    return this.items;
  }

  get unreadCount(): number {
    return this.items.filter(item => item.unread).length;
  }

  get previewNotifications(): AdminNotification[] {
    return this.items.slice(0, 5);
  }

  refresh(): void {
    if (!this.auth.isAuthenticated()) {
      this.items = [];
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.api.getAll().subscribe({
      next: notifications => {
        this.items = (Array.isArray(notifications) ? notifications : [])
          .map(item => this.normalize(item))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, this.maxItems);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load notifications.';
      }
    });
  }

  add(input: CreateNotificationInput): AdminNotification {
    const optimistic = this.createOptimistic(input);

    if (!this.auth.isAuthenticated()) {
      return optimistic;
    }

    this.items = [optimistic, ...this.items].slice(0, this.maxItems);
    this.errorMessage = '';

    const request: CreateNotificationApiRequest = {
      type: input.type,
      title: input.title.trim(),
      message: input.message.trim(),
      icon: input.icon,
      url: input.url
    };

    this.api.create(request).subscribe({
      next: result => {
        if (!result.success || !result.notification) {
          this.removeOptimistic(optimistic.id);
          this.errorMessage = result.message || 'Could not save notification.';
          return;
        }

        const persisted = this.normalize(result.notification);
        const pending = this.items.find(item => item.id === optimistic.id);
        const optimisticWasRead = pending?.unread === false;

        this.items = [
          persisted,
          ...this.items.filter(item => item.id !== optimistic.id && item.id !== persisted.id)
        ]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, this.maxItems);

        if (optimisticWasRead) {
          this.markAsRead(persisted.id);
        }
      },
      error: () => {
        this.removeOptimistic(optimistic.id);
        this.errorMessage = 'The business action succeeded, but its notification could not be saved.';
      }
    });

    return optimistic;
  }

  markAsRead(id: string): void {
    const item = this.items.find(notification => notification.id === id);
    if (!item || !item.unread) return;

    item.unread = false;

    if (id.startsWith('local-') || !this.auth.isAuthenticated()) return;

    this.api.markAsRead(id).subscribe({
      error: () => {
        item.unread = true;
        this.errorMessage = 'Could not mark the notification as read.';
      }
    });
  }

  markAllAsRead(): void {
    const unread = this.items.filter(item => item.unread);
    if (!unread.length) return;

    unread.forEach(item => item.unread = false);

    if (!this.auth.isAuthenticated()) return;

    this.api.markAllAsRead().subscribe({
      error: () => {
        unread.forEach(item => item.unread = true);
        this.errorMessage = 'Could not mark all notifications as read.';
      }
    });
  }

  clearAll(): void {
    if (!this.items.length) return;

    const previous = [...this.items];
    this.items = [];

    if (!this.auth.isAuthenticated()) return;

    this.api.clearAll().subscribe({
      error: () => {
        this.items = previous;
        this.errorMessage = 'Could not clear notifications.';
      }
    });
  }

  private createOptimistic(input: CreateNotificationInput): AdminNotification {
    const now = new Date();
    this.localCounter += 1;

    return {
      id: 'local-' + now.getTime() + '-' + this.localCounter,
      type: input.type,
      title: input.title.trim(),
      message: input.message.trim(),
      time: this.formatTime(now),
      dateLabel: this.formatDate(now),
      createdAt: now.toISOString(),
      icon: input.icon,
      unread: true,
      url: input.url
    };
  }

  private normalize(item: NotificationApiRecord): AdminNotification {
    const createdAt = new Date(item.createdAt);
    const safeDate = Number.isFinite(createdAt.getTime()) ? createdAt : new Date();

    return {
      id: String(item.id),
      type: this.isNotificationType(item.type) ? item.type : 'system',
      title: String(item.title || ''),
      message: String(item.message || ''),
      time: this.formatTime(safeDate),
      dateLabel: this.formatDate(safeDate),
      createdAt: safeDate.toISOString(),
      icon: String(item.icon || 'bi-bell'),
      unread: Boolean(item.unread),
      url: item.url ? String(item.url) : undefined
    };
  }

  private removeOptimistic(id: string): void {
    this.items = this.items.filter(item => item.id !== id);
  }

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  private isNotificationType(value: string): value is NotificationType {
    return value === 'booking'
      || value === 'payment'
      || value === 'cancelled'
      || value === 'rescheduled'
      || value === 'reminder'
      || value === 'system';
  }
}
