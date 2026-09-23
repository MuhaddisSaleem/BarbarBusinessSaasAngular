import { Injectable } from '@angular/core';
import { AdminBarberService } from '../barbers/admin-barber.service';
import { AdminServiceService } from '../services/admin-service.service';
import { AdminSettingsService } from '../settings/admin-settings.service';

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
    private readonly settingsService: AdminSettingsService
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

  private bookings: AdminBooking[] = [
    this.createSeed(1, 'RB-2601', 'Hamza Ali', '+92 300 1234567', 'Haircut', 30, 'Ahmed', 0, '09:00 AM', 700, 'Confirmed', 'Online'),
    this.createSeed(2, 'RB-2602', 'Usman Tariq', '+92 321 4567890', 'Hair + Beard + Free Hair Massage', 45, 'Ali', 0, '10:00 AM', 1000, 'Confirmed', 'Online'),
    this.createSeed(3, 'RB-2603', 'Adeel Khan', '+92 333 9876543', '6 Step Face Massage', 60, 'Usman', 0, '11:30 AM', 5000, 'Pending', 'Online'),
    this.createSeed(4, 'RB-2604', 'Saad Ahmed', '+92 305 7788990', 'Beard Trim', 20, 'Ahmed', 0, '02:30 PM', 400, 'Confirmed', 'Admin'),
    this.createSeed(5, 'RB-2605', 'Fahad Raza', '+92 302 4455667', 'Hair Coloring', 60, 'Ali', -1, '03:30 PM', 2000, 'Completed', 'Online'),
    this.createSeed(6, 'RB-2606', 'Bilal Aslam', '+92 309 1122334', 'Hair Wash', 15, 'Usman', 0, '05:00 PM', 300, 'Cancelled', 'Online'),
    this.createSeed(7, 'RB-2607', 'Danish Iqbal', '+92 312 9080706', 'Haircut', 30, 'Ahmed', 1, '09:30 AM', 700, 'Confirmed', 'Online'),
    this.createSeed(8, 'RB-2608', 'Talha Javed', '+92 334 2109876', 'Beard Trim', 20, 'Ali', 1, '11:00 AM', 400, 'Pending', 'Online'),
    this.createSeed(9, 'RB-2609', 'Hassan Rauf', '+92 301 7772311', 'Kids Haircut', 30, 'Usman', 2, '12:00 PM', 600, 'Confirmed', 'Admin'),
    this.createSeed(10, 'RB-2610', 'Owais Shah', '+92 315 6622110', 'Hair + Beard + Free Hair Massage', 45, 'Ahmed', 3, '04:00 PM', 1000, 'Confirmed', 'Online', 'Customer requested a low fade.'),
    this.createSeed(11, 'RB-2611', 'Muneeb Akram', '+92 300 8844211', 'Haircut', 30, 'Ali', -2, '01:00 PM', 700, 'Completed', 'Online'),
    this.createSeed(12, 'RB-2612', 'Zain Malik', '+92 321 5522440', '6 Step Face Massage', 60, 'Usman', 4, '06:00 PM', 5000, 'Pending', 'Online', '', 2)
  ];

  get all(): AdminBooking[] {
    return this.bookings;
  }

  getById(id: number): AdminBooking | undefined {
    return this.bookings.find(item => item.id === id);
  }

  updateStatus(id: number, status: BookingStatus): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };
    booking.status = status;
    return { success: true, message: 'Booking ' + booking.code + ' marked ' + status.toLowerCase() + '.' };
  }

  assignBarber(id: number, barber: string): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };
    if (this.hasConflict(barber, booking.date, booking.time, booking.duration, id)) {
      return { success: false, message: barber + ' already has an overlapping appointment at this time.' };
    }
    booking.barber = barber;
    return { success: true, message: barber + ' assigned successfully.' };
  }

  reschedule(id: number, date: string, time: string): BookingMutationResult {
    const booking = this.getById(id);
    if (!booking) return { success: false, message: 'Booking not found.' };
    if (!date || !time) return { success: false, message: 'Please choose both a date and time.' };
    if (this.hasConflict(booking.barber, date, time, booking.duration, id)) {
      return { success: false, message: booking.barber + ' already has an overlapping appointment at this time.' };
    }
    booking.date = date;
    booking.time = time;
    return { success: true, message: 'Appointment rescheduled successfully.' };
  }

  cancel(id: number): BookingMutationResult {
    return this.updateStatus(id, 'Cancelled');
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
        code: 'RB-' + String(2600 + id),
        status: 'Confirmed',
        source: 'Online'
      };
    });

    this.bookings = [...created.reverse(), ...this.bookings];

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

    if (this.hasConflict(input.barber, input.date, input.time, input.duration)) {
      return { success: false, message: input.barber + ' already has an overlapping appointment at this time.' };
    }

    const nextId = Math.max(...this.bookings.map(item => item.id)) + 1;
    this.bookings = [
      {
        ...input,
        id: nextId,
        code: 'RB-' + String(2600 + nextId),
        status: 'Confirmed',
        source: 'Admin'
      },
      ...this.bookings
    ];
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

  private createSeed(
    id: number, code: string, customerName: string, phone: string, service: string, duration: number,
    barber: string, dayOffset: number, time: string, amount: number, status: BookingStatus,
    source: 'Online' | 'Admin', notes = '', groupSize = 1
  ): AdminBooking {
    return {
      id, code, customerName, phone, service, duration, barber,
      date: this.dateKey(dayOffset), time, amount, status, source, notes, groupSize
    };
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
