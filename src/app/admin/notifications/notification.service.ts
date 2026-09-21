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
  private readonly items: AdminNotification[] = [
    {
      id: 1,
      type: 'booking',
      title: 'New booking received',
      message: 'Hamza Ali booked a Haircut with Ahmed for 6:00 PM.',
      time: '2 min ago',
      dateLabel: 'Today',
      icon: 'bi-calendar2-check',
      unread: true
    },
    {
      id: 2,
      type: 'payment',
      title: 'Payment received',
      message: 'Rs. 1,000 received for Usman Tariq’s Hair + Beard appointment.',
      time: '18 min ago',
      dateLabel: 'Today',
      icon: 'bi-cash-stack',
      unread: true
    },
    {
      id: 3,
      type: 'rescheduled',
      title: 'Appointment rescheduled',
      message: 'Saad Ahmed moved his Beard Trim appointment from 1:00 PM to 2:30 PM.',
      time: '42 min ago',
      dateLabel: 'Today',
      icon: 'bi-calendar2-week',
      unread: true
    },
    {
      id: 4,
      type: 'cancelled',
      title: 'Booking cancelled',
      message: 'Bilal Aslam cancelled his 5:00 PM Hair Wash appointment.',
      time: '1 hr ago',
      dateLabel: 'Today',
      icon: 'bi-calendar2-x',
      unread: false
    },
    {
      id: 5,
      type: 'reminder',
      title: 'Upcoming appointment',
      message: 'Adeel Khan’s 6 Step Face Massage starts in 30 minutes with Usman.',
      time: '1 hr ago',
      dateLabel: 'Today',
      icon: 'bi-alarm',
      unread: false
    },
    {
      id: 6,
      type: 'booking',
      title: 'Group booking received',
      message: 'A new 2-person booking was created for tomorrow at 11:00 AM.',
      time: 'Yesterday, 7:18 PM',
      dateLabel: 'Yesterday',
      icon: 'bi-people',
      unread: false
    },
    {
      id: 7,
      type: 'system',
      title: 'Barber schedule updated',
      message: 'Ali’s working hours were updated for Tuesday and Wednesday.',
      time: 'Yesterday, 5:46 PM',
      dateLabel: 'Yesterday',
      icon: 'bi-person-badge',
      unread: false
    },
    {
      id: 8,
      type: 'payment',
      title: 'Pending payment reminder',
      message: 'Rs. 6,200 is still pending across today’s appointments.',
      time: 'Yesterday, 3:20 PM',
      dateLabel: 'Yesterday',
      icon: 'bi-wallet2',
      unread: false
    },
    {
      id: 9,
      type: 'system',
      title: 'Weekly summary ready',
      message: 'Your weekly bookings and revenue summary is ready to review.',
      time: '20 Sep, 9:00 AM',
      dateLabel: 'Earlier',
      icon: 'bi-bar-chart-line',
      unread: false
    }
  ];

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
