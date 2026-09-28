import { Injectable } from '@angular/core';

export type NotificationType =
  | 'booking'
  | 'payment'
  | 'cancelled'
  | 'rescheduled'
  | 'reminder'
  | 'system';

export interface AdminNotification {
  id: number;
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
  private readonly storageKey = 'royal-barbers.admin-notifications.v1';
  private readonly maxItems = 100;
  private items: AdminNotification[] = this.loadNotifications();

  get notifications(): AdminNotification[] {
    return this.items;
  }

  get unreadCount(): number {
    return this.items.filter(item => item.unread).length;
  }

  get previewNotifications(): AdminNotification[] {
    return this.items.slice(0, 5);
  }

  add(input: CreateNotificationInput): AdminNotification {
    const now = new Date();
    const notification: AdminNotification = {
      id: this.nextId(),
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

    this.items = [notification, ...this.items].slice(0, this.maxItems);
    this.persist();
    return notification;
  }

  markAsRead(id: number): void {
    const item = this.items.find(notification => notification.id === id);
    if (!item || !item.unread) return;

    item.unread = false;
    this.persist();
  }

  markAllAsRead(): void {
    if (!this.items.some(item => item.unread)) return;

    this.items.forEach(item => item.unread = false);
    this.persist();
  }

  clearAll(): void {
    this.items = [];
    this.persist();
  }

  private loadNotifications(): AdminNotification[] {
    if (typeof window === 'undefined') return [];

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as AdminNotification[];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(item => item && Number.isFinite(Number(item.id)))
        .map(item => ({
          ...item,
          id: Number(item.id),
          type: this.isNotificationType(item.type) ? item.type : 'system',
          title: String(item.title || ''),
          message: String(item.message || ''),
          time: String(item.time || ''),
          dateLabel: String(item.dateLabel || ''),
          createdAt: String(item.createdAt || new Date(0).toISOString()),
          icon: String(item.icon || 'bi-bell'),
          unread: Boolean(item.unread),
          url: item.url ? String(item.url) : undefined
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, this.maxItems);
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch {
      // Notifications should never block the business action that created them.
    }
  }

  private nextId(): number {
    const maxId = Math.max(0, ...this.items.map(item => Number(item.id) || 0));
    return Math.max(Date.now(), maxId + 1);
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
