import { Injectable } from '@angular/core';

export type NotificationType = 'booking' | 'payment' | 'cancelled' | 'rescheduled' | 'reminder' | 'system';

export interface AdminNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  dateLabel: string;
  icon: string;
  unread: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly items: AdminNotification[] = [];

  get notifications(): AdminNotification[] {
    return this.items;
  }

  get unreadCount(): number {
    return this.items.filter(item => item.unread).length;
  }

  get previewNotifications(): AdminNotification[] {
    return this.items.slice(0, 5);
  }

  markAsRead(id: number): void {
    const item = this.items.find(notification => notification.id === id);
    if (item) item.unread = false;
  }

  markAllAsRead(): void {
    this.items.forEach(item => item.unread = false);
  }
}
