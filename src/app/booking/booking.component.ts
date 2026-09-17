import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Service {
  id: number;
  name: string;
  duration: number;
  price: number;
  image: string;
}

interface Barber {
  id: number;
  name: string;
  rating: number;
  experience: string;
  image: string;
}

interface BookingDate {
  date: Date;
  day: string;
  dateNumber: number;
  month: string;
  fullDate: string;
}

interface BookedAppointment {
  barberId: number;
  date: string;
  startTime: string;
  duration: number;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit {
  services: Service[] = [
    { id: 1, name: 'Haircut', duration: 30, price: 700, image: 'assets/images/services/haircut.jpg' },
    { id: 2, name: 'Beard Trim', duration: 20, price: 400, image: 'assets/images/services/beard.jpg' },
    { id: 3, name: 'Hair + Beard', duration: 45, price: 1000, image: 'assets/images/services/hair-beard.jpg' },
    { id: 4, name: 'Kids Haircut', duration: 30, price: 600, image: 'assets/images/services/kids.jpg' },
    { id: 5, name: 'Hair Wash', duration: 15, price: 300, image: 'assets/images/services/hair-wash.jpg' },
    { id: 6, name: 'Hair Coloring', duration: 60, price: 2000, image: 'assets/images/services/hair-color.jpg' }
  ];

  barbers: Barber[] = [
    { id: 1, name: 'Ahmed', rating: 4.9, experience: '5+ years', image: 'assets/images/barbers/ahmed.jpg' },
    { id: 2, name: 'Ali', rating: 4.8, experience: '4+ years', image: 'assets/images/barbers/ali.jpg' },
    { id: 3, name: 'Usman', rating: 4.7, experience: '3+ years', image: 'assets/images/barbers/usman.jpg' }
  ];

  selectedService: Service | null = null;
  selectedBarber: Barber | 'any' | null = null;
  selectedDate: BookingDate | null = null;
  selectedTime: string | null = null;

  bookingDates: BookingDate[] = [];
  availableTimes: string[] = [];
  bookedAppointments: BookedAppointment[] = [];

  customer = { name: '', phone: '', notes: '' };
  bookingConfirmed = false;
  confirmedBarberName = '';

  ngOnInit(): void {
    this.generateBookingDates();
    this.createDemoBookings();
  }

  selectService(service: Service): void {
    this.selectedService = service;
    this.selectedTime = null;
    if (this.selectedDate && this.selectedBarber) this.generateAvailableTimes();
  }

  selectBarber(barber: Barber | 'any'): void {
    this.selectedBarber = barber;
    this.selectedTime = null;
    if (this.selectedDate && this.selectedService) this.generateAvailableTimes();
  }

  generateBookingDates(): void {
    const today = new Date();
    this.bookingDates = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      this.bookingDates.push({
        date,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateNumber: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        fullDate: this.formatDate(date)
      });
    }
  }

  selectDate(date: BookingDate): void {
    this.selectedDate = date;
    this.selectedTime = null;
    if (this.selectedService && this.selectedBarber) this.generateAvailableTimes();
  }

  generateAvailableTimes(): void {
    if (!this.selectedService || !this.selectedBarber || !this.selectedDate) {
      this.availableTimes = [];
      return;
    }

    const slots: string[] = [];
    const openingMinutes = 10 * 60;
    const closingMinutes = 22 * 60;
    const slotInterval = 30;
    const serviceDuration = this.selectedService.duration;

    for (let minutes = openingMinutes; minutes + serviceDuration <= closingMinutes; minutes += slotInterval) {
      const time = this.minutesToTime(minutes);
      if (this.isTimeAvailable(time)) slots.push(time);
    }

    this.availableTimes = slots;
  }

  isTimeAvailable(time: string): boolean {
    if (!this.selectedDate || !this.selectedService || !this.selectedBarber) return false;

    if (this.selectedBarber === 'any') {
      return this.barbers.some(barber =>
        this.isBarberAvailable(barber.id, time, this.selectedDate!.fullDate, this.selectedService!.duration)
      );
    }

    return this.isBarberAvailable(
      this.selectedBarber.id,
      time,
      this.selectedDate.fullDate,
      this.selectedService.duration
    );
  }

  isBarberAvailable(barberId: number, requestedTime: string, date: string, duration: number): boolean {
    const requestedStart = this.timeToMinutes(requestedTime);
    const requestedEnd = requestedStart + duration;

    const barberBookings = this.bookedAppointments.filter(
      booking => booking.barberId === barberId && booking.date === date
    );

    return !barberBookings.some(booking => {
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = bookingStart + booking.duration;
      return requestedStart < bookingEnd && requestedEnd > bookingStart;
    });
  }

  selectTime(time: string): void {
    this.selectedTime = time;
  }

  confirmBooking(): void {
    if (!this.canConfirmBooking()) return;

    let assignedBarber: Barber | null = null;

    if (this.selectedBarber === 'any') {
      assignedBarber = this.barbers.find(barber =>
        this.isBarberAvailable(
          barber.id,
          this.selectedTime!,
          this.selectedDate!.fullDate,
          this.selectedService!.duration
        )
      ) || null;
    } else {
      assignedBarber = this.selectedBarber;
    }

    if (!assignedBarber) return;

    this.bookedAppointments.push({
      barberId: assignedBarber.id,
      date: this.selectedDate!.fullDate,
      startTime: this.selectedTime!,
      duration: this.selectedService!.duration
    });

    this.confirmedBarberName = assignedBarber.name;
    this.bookingConfirmed = true;
  }

  canConfirmBooking(): boolean {
    return !!(
      this.selectedService &&
      this.selectedBarber &&
      this.selectedDate &&
      this.selectedTime &&
      this.customer.name.trim() &&
      this.customer.phone.trim()
    );
  }

  get barberName(): string {
    if (!this.selectedBarber) return 'Not selected';
    if (this.selectedBarber === 'any') return 'Any Available Barber';
    return this.selectedBarber.name;
  }

  get bookingEndTime(): string {
    if (!this.selectedTime || !this.selectedService) return '';
    return this.minutesToTime(this.timeToMinutes(this.selectedTime) + this.selectedService.duration);
  }

  get currentStep(): number {
    if (!this.selectedService) return 1;
    if (!this.selectedBarber) return 2;
    if (!this.selectedDate || !this.selectedTime) return 3;
    if (!this.customer.name.trim() || !this.customer.phone.trim()) return 4;
    return 5;
  }

  closeSuccess(): void {
    this.bookingConfirmed = false;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private timeToMinutes(time: string): number {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);

    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  private minutesToTime(totalMinutes: number): string {
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const modifier = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${hours}:${minutes.toString().padStart(2, '0')} ${modifier}`;
  }

  private createDemoBookings(): void {
    if (!this.bookingDates.length) return;

    const date = this.bookingDates[0].fullDate;
    this.bookedAppointments = [
      { barberId: 1, date, startTime: '11:00 AM', duration: 30 },
      { barberId: 1, date, startTime: '2:00 PM', duration: 60 },
      { barberId: 2, date, startTime: '12:00 PM', duration: 30 },
      { barberId: 3, date, startTime: '5:00 PM', duration: 45 }
    ];
  }
}
