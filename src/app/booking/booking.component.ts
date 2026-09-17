import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Service { id: number; name: string; duration: number; price: number; image: string; }
interface Barber { id: number; name: string; rating: number; experience: string; image: string; }
interface BookingDate { date: Date; day: string; dateNumber: number; month: string; fullDate: string; }
interface CalendarCell { date: Date | null; dayNumber: number | null; fullDate: string | null; }
interface BookedAppointment { barberId: number; date: string; startTime: string; duration: number; }
interface BookingPerson { id: number; label: string; selectedServices: Service[]; selectedBarber: Barber | 'any' | null; }
interface ConfirmedAssignment { person: string; barber: string; time: string; }
interface PersonSchedule { personId: number; time: string; barber: Barber; suggested: boolean; }

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss', './group-booking.component.scss']
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
    { id: 1, name: 'Ahmed', rating: 4.9, experience: '5+ years', image: 'https://images.pexels.com/photos/4997508/pexels-photo-4997508.jpeg?auto=compress&cs=tinysrgb&w=700' },
    { id: 2, name: 'Ali', rating: 4.8, experience: '4+ years', image: 'https://images.pexels.com/photos/26903605/pexels-photo-26903605.jpeg?auto=compress&cs=tinysrgb&w=700' },
    { id: 3, name: 'Usman', rating: 4.7, experience: '3+ years', image: 'https://images.pexels.com/photos/18885730/pexels-photo-18885730.jpeg?auto=compress&cs=tinysrgb&w=700' }
  ];

  bookingMode: 'single' | 'group' = 'single';
  groupStrategy: 'parallel' | 'sequential' = 'parallel';
  participants: BookingPerson[] = [this.createPerson(1, 'You')];
  activeParticipantIndex = 0;
  private nextPersonId = 2;

  selectedDate: BookingDate | null = null;
  selectedTime: string | null = null;
  calendarDate = this.startOfMonth(new Date());
  calendarCells: CalendarCell[] = [];
  availableTimes: string[] = [];
  bookedAppointments: BookedAppointment[] = [];
  sequentialSchedule: PersonSchedule[] = [];

  customer = { name: '', phone: '', notes: '' };
  bookingConfirmed = false;
  confirmedAssignments: ConfirmedAssignment[] = [];

  ngOnInit(): void { this.buildCalendar(); }

  get activeParticipant(): BookingPerson { return this.participants[this.activeParticipantIndex]; }
  get selectedServices(): Service[] { return this.activeParticipant.selectedServices; }
  get selectedBarber(): Barber | 'any' | null { return this.activeParticipant.selectedBarber; }

  setBookingMode(mode: 'single' | 'group'): void {
    if (this.bookingMode === mode) return;
    this.bookingMode = mode;
    this.clearSelectedTime();
    if (mode === 'group') {
      if (this.participants.length === 1) this.participants.push(this.createPerson(this.nextPersonId++, 'Person 2'));
    } else {
      this.participants = [this.participants[0]];
      this.activeParticipantIndex = 0;
      this.groupStrategy = 'parallel';
    }
    this.generateAvailableTimes();
  }

  setGroupStrategy(strategy: 'parallel' | 'sequential'): void {
    if (this.groupStrategy === strategy) return;
    this.groupStrategy = strategy;
    this.clearSelectedTime();
    this.participants.forEach(person => person.selectedBarber = null);
    this.generateAvailableTimes();
  }

  addPerson(): void {
    if (this.participants.length >= 4) return;
    const person = this.createPerson(this.nextPersonId++, `Person ${this.participants.length + 1}`);
    if (this.groupStrategy === 'sequential' && this.participants[0]?.selectedBarber) person.selectedBarber = this.participants[0].selectedBarber;
    this.participants.push(person);
    this.activeParticipantIndex = this.participants.length - 1;
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  removePerson(index: number): void {
    if (index === 0 || this.participants.length <= 2) return;
    this.participants.splice(index, 1);
    this.participants.forEach((person, i) => person.label = i === 0 ? 'You' : `Person ${i + 1}`);
    this.activeParticipantIndex = Math.min(this.activeParticipantIndex, this.participants.length - 1);
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  selectParticipant(index: number): void { this.activeParticipantIndex = index; }

  toggleService(service: Service): void {
    const person = this.activeParticipant;
    if (this.isServiceSelected(service.id)) {
      person.selectedServices = person.selectedServices.filter(item => item.id !== service.id);
    } else if (service.id === 3) {
      person.selectedServices = person.selectedServices.filter(item => item.id !== 1 && item.id !== 2);
      person.selectedServices.push(service);
    } else if ((service.id === 1 || service.id === 2) && this.isServiceSelected(3)) {
      return;
    } else {
      person.selectedServices.push(service);
    }
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  isServiceSelected(serviceId: number): boolean { return this.activeParticipant.selectedServices.some(service => service.id === serviceId); }
  isServiceDisabled(service: Service): boolean { return this.isServiceSelected(3) && (service.id === 1 || service.id === 2); }

  selectBarber(barber: Barber | 'any'): void {
    if (this.bookingMode === 'group' && this.groupStrategy === 'sequential') {
      this.participants.forEach(person => person.selectedBarber = barber);
    } else {
      this.activeParticipant.selectedBarber = barber;
    }
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  selectCalendarDay(cell: CalendarCell): void {
    if (!cell.date || this.isPastDate(cell.date)) return;
    this.setSelectedDate(cell.date);
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  isPastDate(date: Date | null): boolean {
    if (!date) return false;
    return this.startOfDay(date).getTime() < this.startOfDay(new Date()).getTime();
  }

  get canGoPreviousMonth(): boolean { return this.calendarDate.getTime() > this.startOfMonth(new Date()).getTime(); }

  previousMonth(): void {
    if (!this.canGoPreviousMonth) return;
    const previous = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() - 1, 1);
    const currentMonth = this.startOfMonth(new Date());
    this.calendarDate = previous.getTime() < currentMonth.getTime() ? currentMonth : previous;
    this.buildCalendar();
  }

  nextMonth(): void {
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 1);
    this.buildCalendar();
  }

  private buildCalendar(): void {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: CalendarCell[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, dayNumber: null, fullDate: null });
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
    if (!this.selectedDate || this.isPastDate(this.selectedDate.date) || !this.allParticipantsReady) {
      this.availableTimes = [];
      return;
    }

    const slots: string[] = [];
    const today = this.startOfDay(new Date());
    const selectedDay = this.startOfDay(this.selectedDate.date);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const window of this.businessWindows) {
      for (let minutes = window.start; minutes < window.end; minutes += 30) {
        if (selectedDay.getTime() === today.getTime() && minutes <= nowMinutes) continue;
        const time = this.minutesToTime(minutes);
        const valid = this.bookingMode === 'group' && this.groupStrategy === 'sequential'
          ? !!this.buildSequentialSchedule(time)
          : !!this.resolveParallelBarbers(time);
        if (valid) slots.push(time);
      }
    }

    this.availableTimes = slots;
  }

  selectTime(time: string): void {
    this.selectedTime = time;
    this.sequentialSchedule = this.bookingMode === 'group' && this.groupStrategy === 'sequential'
      ? (this.buildSequentialSchedule(time) || [])
      : [];
  }

  isTimeSelectedForBooking(time: string): boolean {
    if (this.selectedTime === time) return true;
    return this.bookingMode === 'group' && this.groupStrategy === 'sequential' && this.sequentialSchedule.some(slot => slot.time === time);
  }

  getPersonBookingTime(index: number): string {
    if (!this.selectedTime) return '';
    if (this.bookingMode !== 'group' || this.groupStrategy !== 'sequential') return this.selectedTime;
    return this.sequentialSchedule.find(slot => slot.personId === this.participants[index]?.id)?.time || '';
  }

  isSuggestedPersonTime(index: number): boolean {
    if (this.bookingMode !== 'group' || this.groupStrategy !== 'sequential') return false;
    const person = this.participants[index];
    return !!this.sequentialSchedule.find(slot => slot.personId === person?.id)?.suggested;
  }

  getSuggestedTimeMessage(index: number): string {
    if (!this.isSuggestedPersonTime(index)) return '';
    return `Previous slot unavailable — suggested ${this.getPersonBookingTime(index)}`;
  }

  confirmBooking(): void {
    if (!this.canConfirmBooking() || !this.selectedTime || !this.selectedDate) return;
    const assignments = this.resolveBarberAssignments(this.selectedTime);
    if (!assignments) return;

    this.confirmedAssignments = [];
    this.participants.forEach((person, index) => {
      const barber = assignments.get(person.id);
      if (!barber) return;
      const personStartTime = this.getPersonBookingTime(index);
      this.bookedAppointments.push({ barberId: barber.id, date: this.selectedDate!.fullDate, startTime: personStartTime, duration: this.getPersonDuration(person) });
      this.confirmedAssignments.push({ person: person.label, barber: barber.name, time: personStartTime });
    });
    this.bookingConfirmed = true;
  }

  canConfirmBooking(): boolean {
    return !!(this.allParticipantsReady && this.selectedDate && !this.isPastDate(this.selectedDate.date) && this.selectedTime && this.customer.name.trim() && this.customer.phone.trim());
  }

  get allParticipantsReady(): boolean { return this.participants.every(person => person.selectedServices.length > 0 && !!person.selectedBarber); }
  get totalPrice(): number { return this.participants.reduce((total, person) => total + this.getPersonPrice(person), 0); }
  get totalDuration(): number { return this.getPersonDuration(this.activeParticipant); }
  get monthLabel(): string { return this.calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  get barberName(): string { return this.getPersonBarberName(this.activeParticipant); }

  get barberImage(): string {
    const barber = this.activeParticipant.selectedBarber;
    return !barber || barber === 'any' ? '' : barber.image;
  }

  get barberRating(): number | null {
    const barber = this.activeParticipant.selectedBarber;
    return !barber || barber === 'any' ? null : barber.rating;
  }

  get barberExperience(): string {
    const barber = this.activeParticipant.selectedBarber;
    return !barber || barber === 'any' ? '' : barber.experience;
  }

  get bookingEndTime(): string {
    if (!this.selectedTime) return '';
    if (this.bookingMode === 'group' && this.groupStrategy === 'sequential' && this.sequentialSchedule.length) {
      const last = this.sequentialSchedule[this.sequentialSchedule.length - 1];
      const person = this.participants.find(item => item.id === last.personId);
      return this.minutesToTime(this.timeToMinutes(last.time) + (person ? this.getPersonDuration(person) : 0));
    }
    const duration = Math.max(...this.participants.map(person => this.getPersonDuration(person)));
    return this.minutesToTime(this.timeToMinutes(this.selectedTime) + duration);
  }

  getPersonPrice(person: BookingPerson): number { return person.selectedServices.reduce((total, service) => total + service.price, 0); }
  getPersonDuration(person: BookingPerson): number { return person.selectedServices.reduce((total, service) => total + service.duration, 0); }

  getPersonBarberName(person: BookingPerson): string {
    if (!person.selectedBarber) return 'Select barber';
    if (person.selectedBarber === 'any') return 'Any available barber';
    return person.selectedBarber.name;
  }

  getPersonBarberImage(person: BookingPerson): string {
    if (!person.selectedBarber || person.selectedBarber === 'any') return '';
    return person.selectedBarber.image;
  }

  closeSuccess(): void {
    this.bookingConfirmed = false;
    this.generateAvailableTimes();
  }

  private clearSelectedTime(): void {
    this.selectedTime = null;
    this.sequentialSchedule = [];
  }

  private createPerson(id: number, label: string): BookingPerson {
    return { id, label, selectedServices: [], selectedBarber: null };
  }

  private get businessWindows(): { start: number; end: number }[] {
    return [
      { start: 8 * 60, end: 21 * 60 }
    ];
  }

  private resolveBarberAssignments(time: string): Map<number, Barber> | null {
    if (!this.selectedDate || this.isPastDate(this.selectedDate.date) || !this.allParticipantsReady) return null;

    if (this.bookingMode === 'group' && this.groupStrategy === 'sequential') {
      const schedule = this.buildSequentialSchedule(time);
      if (!schedule) return null;
      this.sequentialSchedule = schedule;
      const assignments = new Map<number, Barber>();
      schedule.forEach(slot => assignments.set(slot.personId, slot.barber));
      return assignments;
    }

    return this.resolveParallelBarbers(time);
  }

  private buildSequentialSchedule(firstTime: string): PersonSchedule[] | null {
    if (!this.selectedDate || !this.participants.length) return null;
    const firstChoice = this.participants[0].selectedBarber;
    if (!firstChoice) return null;
    const candidateBarbers = firstChoice === 'any' ? this.barbers : [firstChoice];

    for (const barber of candidateBarbers) {
      const schedule: PersonSchedule[] = [];
      let earliestStart = this.timeToMinutes(firstTime);
      let failed = false;

      for (let index = 0; index < this.participants.length; index++) {
        const person = this.participants[index];
        const duration = this.getPersonDuration(person);
        const slot = this.findNextAvailableSlot(barber.id, earliestStart, duration);
        if (slot === null) {
          failed = true;
          break;
        }
        const actualTime = this.minutesToTime(slot);
        schedule.push({ personId: person.id, time: actualTime, barber, suggested: index > 0 && slot > earliestStart });
        earliestStart = slot + duration;
      }

      if (!failed && schedule.length === this.participants.length && schedule[0].time === firstTime) return schedule;
    }

    return null;
  }

  private findNextAvailableSlot(barberId: number, earliestStart: number, duration: number): number | null {
    if (!this.selectedDate) return null;

    for (const window of this.businessWindows) {
      if (earliestStart >= window.end) continue;
      let start = Math.max(earliestStart, window.start);
      start = Math.ceil(start / 30) * 30;

      for (let minutes = start; minutes + duration <= window.end; minutes += 30) {
        const time = this.minutesToTime(minutes);
        if (this.isBarberAvailable(barberId, time, this.selectedDate.fullDate, duration)) return minutes;
      }
    }

    return null;
  }

  private resolveParallelBarbers(time: string): Map<number, Barber> | null {
    if (!this.selectedDate) return null;
    const assignments = new Map<number, Barber>();
    const usedBarberIds = new Set<number>();

    for (const person of this.participants) {
      const selected = person.selectedBarber;
      if (!selected || selected === 'any') continue;
      if (usedBarberIds.has(selected.id)) return null;
      if (!this.isBarberAvailable(selected.id, time, this.selectedDate.fullDate, this.getPersonDuration(person))) return null;
      assignments.set(person.id, selected);
      usedBarberIds.add(selected.id);
    }

    for (const person of this.participants) {
      if (person.selectedBarber !== 'any') continue;
      const availableBarber = this.barbers.find(barber => !usedBarberIds.has(barber.id) && this.isBarberAvailable(barber.id, time, this.selectedDate!.fullDate, this.getPersonDuration(person)));
      if (!availableBarber) return null;
      assignments.set(person.id, availableBarber);
      usedBarberIds.add(availableBarber.id);
    }

    return assignments;
  }

  private isBarberAvailable(barberId: number, requestedTime: string, date: string, duration: number): boolean {
    const requestedStart = this.timeToMinutes(requestedTime);
    const requestedEnd = requestedStart + duration;
    const barberBookings = this.bookedAppointments.filter(booking => booking.barberId === barberId && booking.date === date);
    return !barberBookings.some(booking => {
      const bookingStart = this.timeToMinutes(booking.startTime);
      return requestedStart < bookingStart + booking.duration && requestedEnd > bookingStart;
    });
  }

  private startOfDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  private startOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), 1); }

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
