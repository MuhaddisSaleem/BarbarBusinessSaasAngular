import { Injectable } from '@angular/core';
import { AdminBarberService } from '../barbers/admin-barber.service';
import { AdminServiceService } from '../services/admin-service.service';
import { AdminSettingsService } from '../settings/admin-settings.service';
import { NotificationService } from '../notifications/notification.service';

export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface AdminBooking {
  id: number;
  code: string;
  customerName: string;
  phone: string;
  service: string;
  duration: number;
  barber: string;
  date: string;
  time: string;
  amount: number;
  status: BookingStatus;
  source: 'Online' | 'Admin';
  notes?: string;
  groupSize?: number;
  serviceLocation?: 'Salon' | 'Home';
  serviceAddress?: string;
  specialService?: string;
}

export interface BookingMutationResult {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AdminBookingService {
  constructor(
    private readonly barberService: AdminBarberService,
    private readonly serviceService: AdminServiceService,
    private readonly settingsService: AdminSettingsService,
    private readonly notificationService: NotificationService
  ) {}

  get barbers(): string[] {
    return this.barberService.active.map(barber => barber.name);
  }

  get services() {
    return this.serviceService.active.map(service => ({
      name: service.name,
      duration: service.duration,
      amount: this.serviceService.effectivePrice(service)
    }));
  }

  availableBarbersForService(service: string, dateKey: string): string[] {
    const services = this.serviceNames(service);

    return this.barberService.active
      .filter(barber =>
        (!dateKey || this.barberService.isAvailableOnDate(barber.id, dateKey))
        && this.barberService.supportsServices(barber.id, services)
      )
      .map(barber => barber.name);
  }

  availableBarbersForBooking(booking: AdminBooking, dateKey: string): string[] {
    const services = this.bookingServiceNames(booking);

    return this.barberService.active
      .filter(barber =>
        (!dateKey || this.barberService.isAvailableOnDate(barber.id, dateKey))
        && this.barberService.supportsServices(barber.id, services)
      )
      .sort((a, b) => b.rating - a.rating || a.id - b.id)
      .map(barber => barber.name);
  }

  private readonly storageKey = 'royal-barbers.admin-bookings.v1';
  private readonly demoCleanupKey = 'royal-barbers.admin-bookings.demo-cleaned.v1';
  private bookings: AdminBooking[] = this.loadBookings();

  get all(): AdminBooking[] {
    return this.bookings;
  }

  getById(id: number): AdminBooking | undefined {
    return this.bookings.find(item => item.id === id);
  }

  updateStatus(id: number, status: BookingStatus): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };

    const previousStatus = booking.status;
    booking.status = status;

    if (!this.persist()) {
      booking.status = previousStatus;
      return { success: false, message: 'Could not save the booking status. Please try again.' };
    }

    if (previousStatus !== status) {
      this.notificationService.add({
        type: status === 'Cancelled' ? 'cancelled' : 'booking',
        title: status === 'Cancelled' ? 'Booking cancelled' : 'Booking status updated',
        message: booking.code + ' for ' + booking.customerName + ' is now ' + status.toLowerCase() + '.',
        icon: status === 'Cancelled' ? 'bi-x-circle' : (status === 'Completed' ? 'bi-check2-circle' : 'bi-calendar2-check'),
        url: '/admin/bookings?booking=' + booking.id
      });
    }

    return { success: true, message: 'Booking ' + booking.code + ' marked ' + status.toLowerCase() + '.' };
  }

  assignBarber(id: number, barber: string): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };
    const barberId = this.barberIdByName(barber);
    if (!barberId) return { success: false, message: 'Selected barber is not active.' };

    if (!this.barberService.isAvailableOnDate(barberId, booking.date)) {
      return { success: false, message: barber + ' is not available on this booking date.' };
    }

    if (!this.barberService.supportsServices(barberId, this.bookingServiceNames(booking))) {
      return { success: false, message: barber + ' does not provide all services in this booking.' };
    }

    if (this.hasConflict(barber, booking.date, booking.time, booking.duration, id)) {
      return { success: false, message: barber + ' already has an overlapping appointment at this time.' };
    }
    const previousBarber = booking.barber;
    booking.barber = barber;

    if (!this.persist()) {
      booking.barber = previousBarber;
      return { success: false, message: 'Could not save the barber assignment. Please try again.' };
    }

    if (previousBarber !== barber) {
      this.notificationService.add({
        type: 'booking',
        title: 'Barber reassigned',
        message: booking.code + ' moved from ' + previousBarber + ' to ' + barber + '.',
        icon: 'bi-person-gear',
        url: '/admin/bookings?booking=' + booking.id
      });
    }

    return { success: true, message: barber + ' assigned successfully.' };
  }

  reschedule(id: number, date: string, time: string): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };
    if (!date || !time) return { success: false, message: 'Please choose both a date and time.' };

    const scheduleValidation = this.validateSchedule(date, time, booking.duration);
    if (!scheduleValidation.success) return scheduleValidation;

    const barberId = this.barberIdByName(booking.barber);
    if (!barberId || !this.barberService.isAvailableOnDate(barberId, date)) {
      return { success: false, message: booking.barber + ' is not available on the selected date.' };
    }

    if (!this.barberService.supportsServices(barberId, this.bookingServiceNames(booking))) {
      return { success: false, message: booking.barber + ' no longer provides all services in this booking.' };
    }

    if (this.hasConflict(booking.barber, date, time, booking.duration, id)) {
      return { success: false, message: booking.barber + ' already has an overlapping appointment at this time.' };
    }
    const previousDate = booking.date;
    const previousTime = booking.time;
    booking.date = date;
    booking.time = time;

    if (!this.persist()) {
      booking.date = previousDate;
      booking.time = previousTime;
      return { success: false, message: 'Could not save the new appointment schedule. Please try again.' };
    }

    if (previousDate !== date || previousTime !== time) {
      this.notificationService.add({
        type: 'rescheduled',
        title: 'Booking rescheduled',
        message: booking.code + ' for ' + booking.customerName + ' moved to ' + date + ' at ' + time + '.',
        icon: 'bi-calendar2-week',
        url: '/admin/bookings?booking=' + booking.id
      });
    }

    return { success: true, message: 'Appointment rescheduled successfully.' };
  }

  cancel(id: number): BookingMutationResult {
    return this.updateStatus(id, 'Cancelled');
  }

  customerCancel(id: number): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };

    if (booking.status === 'Cancelled' || booking.status === 'Completed') {
      return { success: false, message: 'This booking can no longer be cancelled by the customer.' };
    }

    if (!this.settingsService.canCustomerCancel(booking.date, booking.time)) {
      return {
        success: false,
        message: 'The cancellation window has closed. Please contact the salon for assistance.'
      };
    }

    return this.updateStatus(id, 'Cancelled');
  }

  isPastLateArrivalGrace(booking: AdminBooking): boolean {
    return (booking.status === 'Pending' || booking.status === 'Confirmed')
      && this.settingsService.isPastLateArrivalGrace(booking.date, booking.time);
  }

  addOnlineBookings(
    inputs: Array<Omit<AdminBooking, 'id' | 'code' | 'status' | 'source'>>
  ): BookingMutationResult {
    if (!inputs.length) {
      return { success: false, message: 'No booking details were provided.' };
    }

    const staged: Array<Omit<AdminBooking, 'id' | 'code' | 'status' | 'source'>> = [];

    for (const input of inputs) {
      const scheduleValidation = this.validateSchedule(input.date, input.time, input.duration);
      if (!scheduleValidation.success) return scheduleValidation;

      const barberId = this.barberIdByName(input.barber);
      if (!barberId || !this.barberService.isAvailableOnDate(barberId, input.date)) {
        return { success: false, message: input.barber + ' is not available on this date.' };
      }

      if (!this.barberService.supportsServices(barberId, this.bookingServiceNames(input))) {
        return { success: false, message: input.barber + ' does not provide all selected services.' };
      }

      if (
        this.hasConflict(input.barber, input.date, input.time, input.duration)
        || staged.some(item => this.bookingsOverlap(item, input))
      ) {
        return {
          success: false,
          message: input.barber + ' already has an overlapping appointment at this time.'
        };
      }

      staged.push(input);
    }

    let nextId = Math.max(0, ...this.bookings.map(item => item.id)) + 1;
    const created: AdminBooking[] = staged.map(input => {
      const id = nextId++;
      return {
        ...input,
        id,
        code: this.bookingCode(id),
        status: input.serviceLocation === 'Home' && !!input.specialService?.trim()
          ? 'Pending'
          : (this.settingsService.current.autoConfirmBookings ? 'Confirmed' : 'Pending'),
        source: 'Online'
      };
    });

    const previousBookings = this.bookings;
    this.bookings = [...created.reverse(), ...this.bookings];

    if (!this.persist()) {
      this.bookings = previousBookings;
      return { success: false, message: 'Could not save the booking. Please try again.' };
    }

    if (this.settingsService.current.notifyOwnerOnNewBooking) {
      const first = created[0];
      this.notificationService.add({
        type: 'booking',
        title: created.length > 1 ? 'New group booking' : 'New online booking',
        message: created.length > 1
          ? first.customerName + ' booked ' + created.length + ' appointments for ' + first.date + '.'
          : first.customerName + ' booked ' + first.service
            + (first.serviceLocation === 'Home' ? ' as a home service' : '')
            + ' with ' + first.barber + ' for ' + first.date + ' at ' + first.time + '.',
        icon: 'bi-calendar2-plus',
        url: '/admin/bookings?booking=' + first.id
      });
    }

    return {
      success: true,
      message: created.length > 1
        ? created.length + ' appointments booked successfully.'
        : 'Booking created successfully.'
    };
  }

  addBooking(input: Omit<AdminBooking, 'id' | 'code' | 'status' | 'source'>): BookingMutationResult {
    const scheduleValidation = this.validateSchedule(input.date, input.time, input.duration);
    if (!scheduleValidation.success) return scheduleValidation;

    const barberId = this.barberIdByName(input.barber);
    if (!barberId || !this.barberService.isAvailableOnDate(barberId, input.date)) {
      return { success: false, message: input.barber + ' is not available on this date.' };
    }

    if (!this.barberService.supportsServices(barberId, this.bookingServiceNames(input))) {
      return { success: false, message: input.barber + ' does not provide this service.' };
    }

    if (this.hasConflict(input.barber, input.date, input.time, input.duration)) {
      return { success: false, message: input.barber + ' already has an overlapping appointment at this time.' };
    }

    const nextId = Math.max(0, ...this.bookings.map(item => item.id)) + 1;
    const previousBookings = this.bookings;
    this.bookings = [
      {
        ...input,
        id: nextId,
        code: this.bookingCode(nextId),
        status: 'Confirmed',
        source: 'Admin'
      },
      ...this.bookings
    ];

    if (!this.persist()) {
      this.bookings = previousBookings;
      return { success: false, message: 'Could not save the booking. Please try again.' };
    }

    const created = this.bookings[0];
    this.notificationService.add({
      type: 'booking',
      title: 'Admin booking created',
      message: created.customerName + ' booked ' + created.service + ' with ' + created.barber + ' for ' + created.date + ' at ' + created.time + '.',
      icon: 'bi-calendar2-plus',
      url: '/admin/bookings?booking=' + created.id
    });

    return { success: true, message: 'Booking created successfully.' };
  }

  private validateSchedule(dateKey: string, time: string, duration: number): BookingMutationResult {
    const date = new Date(dateKey + 'T12:00:00');
    const hours = this.settingsService.hoursForDate(date);

    if (!hours) {
      return { success: false, message: 'The salon is closed on the selected date.' };
    }

    const start = this.timeToMinutes(time);
    const end = start + duration;

    if (start < hours.start || end > hours.end) {
      return { success: false, message: 'This appointment falls outside the configured business hours.' };
    }

    return { success: true, message: '' };
  }

  private barberIdByName(name: string): number {
    return this.barberService.active.find(barber => barber.name === name)?.id || 0;
  }

  private bookingsOverlap(
    first: Pick<AdminBooking, 'barber' | 'date' | 'time' | 'duration'>,
    second: Pick<AdminBooking, 'barber' | 'date' | 'time' | 'duration'>
  ): boolean {
    if (first.barber !== second.barber || first.date !== second.date) return false;

    const firstStart = this.timeToMinutes(first.time);
    const firstEnd = firstStart + first.duration;
    const secondStart = this.timeToMinutes(second.time);
    const secondEnd = secondStart + second.duration;

    return firstStart < secondEnd && firstEnd > secondStart;
  }

  private hasConflict(barber: string, date: string, time: string, duration: number, ignoreId?: number): boolean {
    const start = this.timeToMinutes(time);
    const end = start + duration;
    return this.bookings.some(item => {
      if (item.id === ignoreId || item.status === 'Cancelled' || item.barber !== barber || item.date !== date) return false;
      const otherStart = this.timeToMinutes(item.time);
      const otherEnd = otherStart + item.duration;
      return start < otherEnd && end > otherStart;
    });
  }

  private loadBookings(): AdminBooking[] {
    if (typeof window === 'undefined') return [];

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        window.localStorage.setItem(this.demoCleanupKey, '1');
        return [];
      }

      const parsed = JSON.parse(raw) as AdminBooking[];
      if (!Array.isArray(parsed)) return [];

      const needsCleanup = window.localStorage.getItem(this.demoCleanupKey) !== '1';
      const demoCodes = new Set([
        'RB-2601','RB-2602','RB-2603','RB-2604','RB-2605','RB-2606',
        'RB-2607','RB-2608','RB-2609','RB-2610','RB-2611','RB-2612'
      ]);

      const cleaned: AdminBooking[] = parsed
        .filter(item =>
          item
          && Number.isFinite(Number(item.id))
          && (!needsCleanup || !demoCodes.has(String(item.code || '')))
        )
        .map((item): AdminBooking => ({
          ...item,
          id: Number(item.id),
          duration: Number(item.duration) || 0,
          amount: Number(item.amount) || 0,
          groupSize: Number(item.groupSize) || 1,
          status: this.isBookingStatus(item.status) ? item.status : 'Pending',
          source: item.source === 'Admin' ? 'Admin' : 'Online',
          notes: item.notes || '',
          serviceLocation: item.serviceLocation === 'Home' ? 'Home' : 'Salon',
          serviceAddress: item.serviceAddress || '',
          specialService: item.specialService || ''
        }));

      if (needsCleanup) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(cleaned));
        window.localStorage.setItem(this.demoCleanupKey, '1');
      }

      return cleaned;
    } catch {
      return [];
    }
  }

  private persist(): boolean {
    if (typeof window === 'undefined') return true;

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.bookings));
      return true;
    } catch {
      return false;
    }
  }

  private isBookingStatus(value: string): value is BookingStatus {
    return value === 'Pending'
      || value === 'Confirmed'
      || value === 'Completed'
      || value === 'Cancelled';
  }

  private bookingCode(id: number): string {
    const words = this.settingsService.current.businessName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const prefix = words.length > 1
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : (words[0]?.slice(0, 2).toUpperCase() || 'BK');

    return prefix + '-' + String(2600 + id);
  }

  private bookingServiceNames(
    booking: Pick<AdminBooking, 'service' | 'serviceLocation' | 'specialService'>
  ): string[] {
    if (
      booking.serviceLocation === 'Home'
      && booking.specialService?.trim()
      && booking.service === 'Custom Home Service'
    ) {
      return [];
    }

    return this.serviceNames(booking.service);
  }

  private serviceNames(service: string): string[] {
    return String(service || '')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
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
