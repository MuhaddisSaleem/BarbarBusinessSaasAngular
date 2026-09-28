import { Injectable } from '@angular/core';
import { AdminBooking, AdminBookingService } from '../bookings/admin-booking.service';

export type CustomerType = 'New' | 'Returning';

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  bookingCount: number;
  completedVisits: number;
  cancelledCount: number;
  totalSpend: number;
  lastVisit: string | null;
  nextBooking: AdminBooking | null;
  customerType: CustomerType;
  firstBookingDate: string;
  lastBookingDate: string;
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class AdminCustomerService {
  private readonly noteStorageKey = 'royal-barbers.customer-notes.v1';

  constructor(private readonly bookingService: AdminBookingService) {}

  get all(): AdminCustomer[] {
    const groups = new Map<string, AdminBooking[]>();

    for (const booking of this.bookingService.all) {
      const key = this.normalizePhone(booking.phone);
      const current = groups.get(key) || [];
      current.push(booking);
      groups.set(key, current);
    }

    const notes = this.loadNotes();

    return Array.from(groups.entries())
      .map(([phoneKey, bookings]) => this.buildCustomer(phoneKey, bookings, notes[phoneKey] || ''))
      .sort((a, b) => b.lastBookingDate.localeCompare(a.lastBookingDate));
  }

  getById(id: string): AdminCustomer | undefined {
    return this.all.find(item => item.id === id);
  }

  bookingsForCustomer(customer: AdminCustomer): AdminBooking[] {
    return this.bookingService.all
      .filter(item => this.normalizePhone(item.phone) === customer.id)
      .sort((a, b) =>
        b.date.localeCompare(a.date) || this.timeToMinutes(b.time) - this.timeToMinutes(a.time)
      );
  }

  saveNote(customerId: string, note: string): { success: boolean; message: string } {
    const notes = this.loadNotes();
    notes[customerId] = note.trim();

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.noteStorageKey, JSON.stringify(notes));
      } catch {
        return { success: false, message: 'Could not save the customer note in this browser.' };
      }
    }

    return { success: true, message: 'Customer note saved.' };
  }

  private buildCustomer(
    phoneKey: string,
    bookings: AdminBooking[],
    note: string
  ): AdminCustomer {
    const sorted = [...bookings].sort((a, b) =>
      a.date.localeCompare(b.date) || this.timeToMinutes(a.time) - this.timeToMinutes(b.time)
    );

    const nonCancelled = sorted.filter(item => this.bookingService.blocksSlot(item));
    const completed = sorted.filter(item => item.status === 'Completed');
    const now = new Date();
    const nowKey = this.todayKey();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const upcoming = nonCancelled
      .filter(item =>
        (item.status === 'Pending' || item.status === 'Confirmed')
        && (
          item.date > nowKey
          || (item.date === nowKey && this.timeToMinutes(item.time) >= nowMinutes)
        )
      )
      .sort((a, b) =>
        a.date.localeCompare(b.date) || this.timeToMinutes(a.time) - this.timeToMinutes(b.time)
      )[0] || null;

    const completedSorted = completed
      .slice()
      .sort((a, b) =>
        b.date.localeCompare(a.date) || this.timeToMinutes(b.time) - this.timeToMinutes(a.time)
      );

    const latest = sorted[sorted.length - 1];
    const first = sorted[0];

    return {
      id: phoneKey,
      name: latest?.customerName || first?.customerName || 'Customer',
      phone: latest?.phone || first?.phone || '',
      bookingCount: nonCancelled.length,
      completedVisits: completed.length,
      cancelledCount: sorted.filter(item => item.status === 'Cancelled').length,
      totalSpend: completed.reduce((sum, item) => sum + item.amount, 0),
      lastVisit: completedSorted[0]?.date || null,
      nextBooking: upcoming,
      customerType: nonCancelled.length > 1 ? 'Returning' : 'New',
      firstBookingDate: first?.date || '',
      lastBookingDate: latest?.date || '',
      notes: note
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private loadNotes(): Record<string, string> {
    if (typeof window === 'undefined') return {};

    try {
      const raw = window.localStorage.getItem(this.noteStorageKey);
      return raw ? JSON.parse(raw) as Record<string, string> : {};
    } catch {
      return {};
    }
  }

  private todayKey(): string {
    const date = new Date();
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
