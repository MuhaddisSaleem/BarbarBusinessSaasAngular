import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { AdminBooking, BookingMutationResult } from '../admin/bookings/admin-booking.service';

export interface BookingApiMutationResult extends BookingMutationResult {
  booking?: AdminBooking;
}

export interface AvailabilityApiResult {
  available: boolean;
  message: string;
  eligibleBarbers: string[];
}

@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private readonly baseUrl = '/api/bookings';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<AdminBooking[]> {
    return this.http.get<AdminBooking[]>(this.baseUrl);
  }

  createOnline(bookings: Array<Omit<AdminBooking, 'id' | 'code' | 'status' | 'source'>>): Observable<BookingApiMutationResult> {
    return this.http.post<BookingApiMutationResult>(this.baseUrl + '/online', bookings);
  }

  createWalkIn(booking: Omit<AdminBooking, 'id' | 'code' | 'status' | 'source'>): Observable<BookingApiMutationResult> {
    return this.http.post<BookingApiMutationResult>(this.baseUrl + '/walk-in', booking);
  }

  createAdmin(booking: Omit<AdminBooking, 'id' | 'code' | 'status' | 'source'>): Observable<BookingApiMutationResult> {
    return this.http.post<BookingApiMutationResult>(this.baseUrl + '/admin', booking);
  }

  updateStatus(id: number, status: string): Observable<BookingApiMutationResult> {
    return this.http.patch<BookingApiMutationResult>(this.baseUrl + '/' + id + '/status', { status });
  }

  assignBarber(id: number, barber: string): Observable<BookingApiMutationResult> {
    return this.http.patch<BookingApiMutationResult>(this.baseUrl + '/' + id + '/barber', { barber });
  }

  reschedule(id: number, date: string, time: string): Observable<BookingApiMutationResult> {
    return this.http.patch<BookingApiMutationResult>(this.baseUrl + '/' + id + '/schedule', { date, time });
  }

  updateSpecialServicePrice(id: number, amount: number): Observable<BookingApiMutationResult> {
    return this.http.patch<BookingApiMutationResult>(this.baseUrl + '/' + id + '/special-service-price', { amount });
  }

  cancel(id: number): Observable<BookingApiMutationResult> {
    return this.http.delete<BookingApiMutationResult>(this.baseUrl + '/' + id);
  }

  checkAvailability(payload: {
    service: string;
    date: string;
    time: string;
    duration: number;
    barber?: string;
    ignoreBookingId?: number;
  }): Observable<AvailabilityApiResult> {
    return this.http.post<AvailabilityApiResult>(this.baseUrl + '/availability', payload);
  }
}
