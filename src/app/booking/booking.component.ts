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

interface CalendarCell {
  date: Date | null;
  dayNumber: number | null;
  fullDate: string | null;
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
  readonly serviceImages = {
    haircut: 'https://images.pexels.com/photos/7447132/pexels-photo-7447132.jpeg?auto=compress&cs=tinysrgb&w=900',
    beard: 'https://images.pexels.com/photos/3998419/pexels-photo-3998419.jpeg?auto=compress&cs=tinysrgb&w=900',
    hairBeard: 'https://images.pexels.com/photos/4625630/pexels-photo-4625630.jpeg?auto=compress&cs=tinysrgb&w=900',
    kids: 'https://images.pexels.com/photos/16098672/pexels-photo-16098672.jpeg?auto=compress&cs=tinysrgb&w=900',
    wash: 'https://images.pexels.com/photos/3998413/pexels-photo-3998413.jpeg?auto=compress&cs=tinysrgb&w=900',
    color: 'https://images.pexels.com/photos/9992819/pexels-photo-9992819.jpeg?auto=compress&cs=tinysrgb&w=900',
    faceMassage: 'https://images.pexels.com/photos/3997993/pexels-photo-3997993.jpeg?auto=compress&cs=tinysrgb&w=900'
  };

  services: Service[] = [
    { id: 1, name: 'Haircut', duration: 30, price: 700, image: this.serviceImages.haircut },
    { id: 2, name: 'Beard Trim', duration: 20, price: 400, image: this.serviceImages.beard },
    { id: 3, name: 'Hair + Beard + Free Hair Massage', duration: 45, price: 1000, image: this.serviceImages.hairBeard },
    { id: 4, name: 'Kids Haircut', duration: 30, price: 600, image: this.serviceImages.kids },
    { id: 5, name: 'Hair Wash', duration: 15, price: 300, image: this.serviceImages.wash },
    { id: 6, name: 'Hair Coloring', duration: 60, price: 2000, image: this.serviceImages.color },
    { id: 7, name: '6 Step Face Massage', duration: 60, price: 5000, image: this.serviceImages.faceMassage }
  ];

  barbers: Barber[] = [
    {
      id: 1,
      name: 'Ahmed',
      rating: 4.9,
      experience: '5+ years',
      image: 'https://images.pexels.com/photos/4997508/pexels-photo-4997508.jpeg?auto=compress&cs=tinysrgb&w=700'
    },
    {
      id: 2,
      name: 'Ali',
      rating: 4.8,
      experience: '4+ years',
      image: 'https://images.pexels.com/photos/26903605/pexels-photo-26903605.jpeg?auto=compress&cs=tinysrgb&w=700'
    },
    {
      id: 3,
      name: 'Usman',
      rating: 4.7,
      experience: '3+ years',
      image: 'https://images.pexels.com/photos/18885730/pexels-photo-18885730.jpeg?auto=compress&cs=tinysrgb&w=700'
    }
  ];

  // Customers can choose multiple services. Nothing is preselected.
  selectedServices: Service[] = [];
  selectedBarber: Barber | 'any' | null = null;
  selectedDate: BookingDate | null = null;
  selectedTime: string | null = null;

  calendarDate = new Date(2026, 8, 1);
  calendarCells: CalendarCell[] = [];
  availableTimes: string[] = [];
  bookedAppointments: BookedAppointment[] = [];

  customer = {
    name: '',
    phone: '',
    notes: ''
  };

  bookingConfirmed = false;
  confirmedBarberName = '';

  ngOnInit(): void {
    this.buildCalendar();
  }

  toggleService(service: Service): void {
    const alreadySelected = this.isServiceSelected(service.id);

    if (alreadySelected) {
      this.selectedServices = this.selectedServices.filter(item => item.id !== service.id);
    } else {
      // The Hair + Beard combo already contains haircut and beard, so those
      // individual services cannot be booked together with the combo.
      if (service.id === 3) {
        this.selectedServices = this.selectedServices.filter(item => item.id !== 1 && item.id !== 2);
        this.selectedServices.push(service);
      } else if ((service.id === 1 || service.id === 2) && this.isServiceSelected(3)) {
        return;
      } else {
        this.selectedServices.push(service);
      }
    }

    this.selectedTime = null;
    this.generateAvailableTimes();
  }

  isServiceSelected(serviceId: number): boolean {
    return this.selectedServices.some(service => service.id === serviceId);
  }

  isServiceDisabled(service: Service): boolean {
    return this.isServiceSelected(3) && (service.id === 1 || service.id === 2);
  }

  selectBarber(barber: Barber | 'any'): void {
    this.selectedBarber = barber;
    this.selectedTime = null;
    this.generateAvailableTimes();
  }

  selectCalendarDay(cell: CalendarCell): void {
    if (!cell.date) return;
    this.setSelectedDate(cell.date);
    this.selectedTime = null;
    this.generateAvailableTimes();
  }

  previousMonth(): void {
    this.calendarDate = new Date(
      this.calendarDate.getFullYear(),
      this.calendarDate.getMonth() - 1,
      1
    );
    this.buildCalendar();
  }

  nextMonth(): void {
    this.calendarDate = new Date(
      this.calendarDate.getFullYear(),
      this.calendarDate.getMonth() + 1,
      1
    );
    this.buildCalendar();
  }

  private buildCalendar(): void {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: CalendarCell[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ date: null, dayNumber: null, fullDate: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push({ date, dayNumber: day, fullDate: this.formatDate(date) });
    }

    this.calendarCells = cells;
  }

  private setSelectedDate(date: Date): void {
    this.selectedDate = {
      date,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNumber: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      fullDate: this.formatDate(date)
    };
  }

  generateAvailableTimes(): void {
    if (!this.selectedServices.length || !this.selectedBarber || !this.selectedDate) {
      this.availableTimes = [];
      return;
    }

    const windows = [
      { start: 10 * 60, end: 15 * 60 },
      { start: 17 * 60, end: 19 * 60 + 30 }
    ];

    const slots: string[] = [];
    const interval = 30;
    const duration = this.totalDuration;

    windows.forEach(window => {
      for (let minutes = window.start; minutes + duration <= window.end; minutes += interval) {
        const time = this.minutesToTime(minutes);
        if (this.isTimeAvailable(time)) slots.push(time);
      }
    });

    this.availableTimes = slots;
  }

  isTimeAvailable(time: string): boolean {
    if (!this.selectedDate || !this.selectedServices.length || !this.selectedBarber) {
      return false;
    }

    if (this.selectedBarber === 'any') {
      return this.barbers.some(barber =>
        this.isBarberAvailable(barber.id, time, this.selectedDate!.fullDate, this.totalDuration)
      );
    }

    return this.isBarberAvailable(
      this.selectedBarber.id,
      time,
      this.selectedDate.fullDate,
      this.totalDuration
    );
  }

  isBarberAvailable(
    barberId: number,
    requestedTime: string,
    date: string,
    duration: number
  ): boolean {
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
          this.totalDuration
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
      duration: this.totalDuration
    });

    this.confirmedBarberName = assignedBarber.name;
    this.bookingConfirmed = true;
  }

  canConfirmBooking(): boolean {
    return !!(
      this.selectedServices.length &&
      this.selectedBarber &&
      this.selectedDate &&
      this.selectedTime &&
      this.customer.name.trim() &&
      this.customer.phone.trim()
    );
  }

  get totalPrice(): number {
    return this.selectedServices.reduce((total, service) => total + service.price, 0);
  }

  get totalDuration(): number {
    return this.selectedServices.reduce((total, service) => total + service.duration, 0);
  }

  get selectedServiceNames(): string {
    return this.selectedServices.map(service => service.name).join(', ');
  }

  get monthLabel(): string {
    return this.calendarDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  get barberName(): string {
    if (!this.selectedBarber) return 'Select barber';
    if (this.selectedBarber === 'any') return 'Any Barber';
    return this.selectedBarber.name;
  }

  get barberImage(): string {
    if (!this.selectedBarber || this.selectedBarber === 'any') return '';
    return this.selectedBarber.image;
  }

  get barberRating(): number | null {
    if (!this.selectedBarber || this.selectedBarber === 'any') return null;
    return this.selectedBarber.rating;
  }

  get barberExperience(): string {
    if (!this.selectedBarber || this.selectedBarber === 'any') return '';
    return this.selectedBarber.experience;
  }

  get bookingEndTime(): string {
    if (!this.selectedTime || !this.selectedServices.length) return '';
    return this.minutesToTime(this.timeToMinutes(this.selectedTime) + this.totalDuration);
  }

  closeSuccess(): void {
    this.bookingConfirmed = false;
    this.generateAvailableTimes();
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
}
