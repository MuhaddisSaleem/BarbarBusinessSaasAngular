import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminBarberService } from '../admin/barbers/admin-barber.service';
import { AdminServiceService } from '../admin/services/admin-service.service';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';
import { AdminBookingService } from '../admin/bookings/admin-booking.service';

interface Service { id: number; name: string; duration: number; price: number; originalPrice: number; discountPrice: number | null; image: string; }
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
  get services(): Service[] {
    return this.serviceService.active.map(service => ({
      id: service.id,
      name: service.name,
      duration: service.duration,
      price: this.serviceService.effectivePrice(service),
      originalPrice: service.originalPrice,
      discountPrice: service.discountPrice,
      image: service.image
    }));
  }

  get barbers(): Barber[] {
    return this.barberService.active.map(barber => ({
      id: barber.id,
      name: barber.name,
      rating: barber.rating,
      experience: barber.experience,
      image: barber.image || 'assets/images/barber-placeholder.svg'
    }));
  }

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
  phoneTouched = false;
  bookingValidationMessage = '';
  bookingConfirmed = false;
  confirmedAssignments: ConfirmedAssignment[] = [];

  constructor(
    private readonly barberService: AdminBarberService,
    private readonly serviceService: AdminServiceService,
    private readonly settingsService: AdminSettingsService,
    private readonly bookingService: AdminBookingService
  ) {}

  ngOnInit(): void {
    this.buildCalendar();
  }

  get activeParticipant(): BookingPerson { return this.participants[this.activeParticipantIndex]; }
  get selectedServices(): Service[] { return this.activeParticipant.selectedServices; }
  get selectedBarber(): Barber | 'any' | null { return this.activeParticipant.selectedBarber; }
  get isPakistanPhoneValid(): boolean { return /^3\d{9}$/.test(this.customer.phone); }
  get allServicesSelected(): boolean { return this.participants.every(person => person.selectedServices.length > 0); }
  get allBarbersSelected(): boolean { return this.participants.every(person => !!person.selectedBarber); }
  get allParticipantsReady(): boolean { return this.allServicesSelected && this.allBarbersSelected; }
  get customerDetailsComplete(): boolean { return this.customer.name.trim().length > 0 && this.isPakistanPhoneValid; }
  get totalPrice(): number { return this.participants.reduce((total, person) => total + this.getPersonPrice(person), 0); }
  get totalDuration(): number { return this.getPersonDuration(this.activeParticipant); }
  get monthLabel(): string { return this.calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  get canGoPreviousMonth(): boolean { return this.calendarDate.getTime() > this.startOfMonth(new Date()).getTime(); }

  get canGoNextMonth(): boolean {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + this.settingsService.maxAdvanceDays);
    return this.calendarDate.getTime() < this.startOfMonth(maxDate).getTime();
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');

    // The UI already shows +92. Accept pasted Pakistani formats as well.
    if (digits.startsWith('92')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);

    this.customer.phone = digits.slice(0, 10);
    input.value = this.customer.phone;
    this.phoneTouched = true;
    this.clearValidationMessage();
  }

  onPhoneBlur(): void { this.phoneTouched = true; }
  clearValidationMessage(): void { this.bookingValidationMessage = ''; }

  setBookingMode(mode: 'single' | 'group'): void {
    if (this.bookingMode === mode) return;

    this.bookingMode = mode;
    this.clearValidationMessage();
    this.clearSelectedTime();

    if (mode === 'group') {
      if (this.participants.length === 1) {
        this.participants.push(this.createPerson(this.nextPersonId++, 'Person 2'));
      }
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
    this.clearValidationMessage();
    this.clearSelectedTime();
    this.participants.forEach(person => person.selectedBarber = null);
    this.generateAvailableTimes();
  }

  addPerson(): void {
    if (this.participants.length >= 4) return;

    const person = this.createPerson(this.nextPersonId++, `Person ${this.participants.length + 1}`);
    if (this.groupStrategy === 'sequential' && this.participants[0]?.selectedBarber) {
      person.selectedBarber = this.participants[0].selectedBarber;
    }

    this.participants.push(person);
    this.activeParticipantIndex = this.participants.length - 1;
    this.clearValidationMessage();
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  removePerson(index: number): void {
    if (index === 0 || this.participants.length <= 2) return;

    this.participants.splice(index, 1);
    this.participants.forEach((person, i) => person.label = i === 0 ? 'You' : `Person ${i + 1}`);
    this.activeParticipantIndex = Math.min(this.activeParticipantIndex, this.participants.length - 1);
    this.clearValidationMessage();
    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  selectParticipant(index: number): void {
    if (index < 0 || index >= this.participants.length) return;
    this.activeParticipantIndex = index;
  }

  toggleService(service: Service): void {
    this.clearValidationMessage();
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

  isServiceSelected(serviceId: number): boolean {
    return this.activeParticipant.selectedServices.some(service => service.id === serviceId);
  }

  isServiceDisabled(service: Service): boolean {
    return this.isServiceSelected(3) && (service.id === 1 || service.id === 2);
  }

  selectBarber(barber: Barber | 'any'): void {
    this.clearValidationMessage();

    if (barber !== 'any' && this.isBarberUnavailable(barber)) {
      const label = this.getBarberAvailabilityLabel(barber) || 'Not available';
      this.bookingValidationMessage = barber.name + ' is ' + label.toLowerCase() + ' for this date.';
      return;
    }

    if (this.bookingMode === 'group' && this.groupStrategy === 'sequential') {
      this.participants.forEach(person => person.selectedBarber = barber);
    } else {
      this.activeParticipant.selectedBarber = barber;
    }

    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  selectCalendarDay(cell: CalendarCell): void {
    if (!cell.date || this.isDateDisabled(cell.date)) return;

    this.clearValidationMessage();
    this.setSelectedDate(cell.date);

    this.participants.forEach(person => {
      if (person.selectedBarber && person.selectedBarber !== 'any' && this.isBarberUnavailable(person.selectedBarber)) {
        person.selectedBarber = null;
      }
    });

    this.clearSelectedTime();
    this.generateAvailableTimes();
  }

  isPastDate(date: Date | null): boolean {
    if (!date) return false;
    return this.startOfDay(date).getTime() < this.startOfDay(new Date()).getTime();
  }

  isDateDisabled(date: Date | null): boolean {
    if (!date) return false;
    return !this.settingsService.isBookingDateAllowed(date);
  }

  isBarberUnavailable(barber: Barber): boolean {
    return !this.barberService.isAvailableOnDate(barber.id, this.barberStatusDate);
  }

  getBarberAvailabilityLabel(barber: Barber): string {
    return this.barberService.availabilityLabelForDate(barber.id, this.barberStatusDate);
  }

  private get barberStatusDate(): string {
    return this.selectedDate?.fullDate || this.formatDate(new Date());
  }

  previousMonth(): void {
    if (!this.canGoPreviousMonth) return;

    const previous = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() - 1, 1);
    const currentMonth = this.startOfMonth(new Date());
    this.calendarDate = previous.getTime() < currentMonth.getTime() ? currentMonth : previous;
    this.buildCalendar();
  }

  nextMonth(): void {
    if (!this.canGoNextMonth) return;
    this.calendarDate = new Date(this.calendarDate.getFullYear(), this.calendarDate.getMonth() + 1, 1);
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
    if (!this.selectedDate || this.isDateDisabled(this.selectedDate.date) || !this.allParticipantsReady) {
      this.availableTimes = [];
      return;
    }

    const slots: string[] = [];
    const today = this.startOfDay(new Date());
    const selectedDay = this.startOfDay(this.selectedDate.date);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const window of this.businessWindows) {
      for (let minutes = window.start; minutes < window.end; minutes += this.settingsService.bookingInterval) {
        if (selectedDay.getTime() === today.getTime() && minutes <= nowMinutes) continue;

        const time = this.minutesToTime(minutes);
        const valid = this.bookingMode === 'group' && this.groupStrategy === 'sequential'
          ? !!this.buildSequentialSchedule(time)
          : !!this.resolveParallelBarbers(time);

        if (valid) slots.push(time);
      }
    }

    this.availableTimes = slots;

    // Never keep a stale selection after services/barber/date availability changes.
    if (this.selectedTime && !this.availableTimes.includes(this.selectedTime)) {
      this.clearSelectedTime();
    }
  }

  selectTime(time: string): void {
    if (!this.availableTimes.includes(time)) return;

    this.clearValidationMessage();
    this.selectedTime = time;
    this.sequentialSchedule = this.bookingMode === 'group' && this.groupStrategy === 'sequential'
      ? (this.buildSequentialSchedule(time) || [])
      : [];
  }

  isTimeSelectedForBooking(time: string): boolean {
    if (this.selectedTime === time) return true;
    return this.bookingMode === 'group'
      && this.groupStrategy === 'sequential'
      && this.sequentialSchedule.some(slot => slot.time === time);
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
    if (this.bookingConfirmed) return;
    if (!this.validateBookingBeforeConfirm() || !this.selectedTime || !this.selectedDate) return;

    // Re-check against the latest availability immediately before confirming.
    this.generateAvailableTimes();
    if (!this.selectedTime || !this.availableTimes.includes(this.selectedTime)) {
      this.showValidationError('This time slot is no longer available. Please choose another time.', 'date-time-section');
      return;
    }

    const assignments = this.resolveBarberAssignments(this.selectedTime);
    if (!assignments) {
      this.clearSelectedTime();
      this.generateAvailableTimes();
      this.showValidationError('This time slot is no longer available. Please choose another time.', 'date-time-section');
      return;
    }

    this.bookingValidationMessage = '';

    const phone = '+92 ' + this.customer.phone.slice(0, 3) + ' ' + this.customer.phone.slice(3);
    const onlineBookings = this.participants.map((person, index) => {
      const barber = assignments.get(person.id);
      const time = this.getPersonBookingTime(index);

      return {
        customerName: this.customer.name.trim(),
        phone,
        service: person.selectedServices.map(service => service.name).join(', '),
        duration: this.getPersonDuration(person),
        barber: barber?.name || '',
        date: this.selectedDate!.fullDate,
        time,
        amount: this.getPersonPrice(person),
        notes: this.customer.notes.trim(),
        groupSize: this.participants.length
      };
    });

    if (onlineBookings.some(item => !item.barber || !item.time)) {
      this.showValidationError('We could not complete the barber assignment. Please choose another time.', 'date-time-section');
      return;
    }

    const bookingResult = this.bookingService.addOnlineBookings(onlineBookings);
    if (!bookingResult.success) {
      this.clearSelectedTime();
      this.generateAvailableTimes();
      this.showValidationError(bookingResult.message, 'date-time-section');
      return;
    }

    this.confirmedAssignments = [];

    this.participants.forEach((person, index) => {
      const barber = assignments.get(person.id);
      if (!barber) return;

      const personStartTime = this.getPersonBookingTime(index);
      this.bookedAppointments.push({
        barberId: barber.id,
        date: this.selectedDate!.fullDate,
        startTime: personStartTime,
        duration: this.getPersonDuration(person)
      });
      this.confirmedAssignments.push({ person: person.label, barber: barber.name, time: personStartTime });
    });

    this.bookingConfirmed = this.confirmedAssignments.length === this.participants.length;
  }

  private validateBookingBeforeConfirm(): boolean {
    const missingServiceIndex = this.participants.findIndex(person => !person.selectedServices.length);
    if (missingServiceIndex !== -1) {
      this.activeParticipantIndex = missingServiceIndex;
      const person = this.participants[missingServiceIndex];
      return this.showValidationError(`Please select at least one service for ${person.label}.`, 'service-section');
    }

    const missingBarberIndex = this.participants.findIndex(person => !person.selectedBarber);
    if (missingBarberIndex !== -1) {
      this.activeParticipantIndex = missingBarberIndex;
      const person = this.participants[missingBarberIndex];
      return this.showValidationError(`Please choose a barber for ${person.label}.`, 'barber-section');
    }

    if (!this.selectedDate) {
      return this.showValidationError('Please select an appointment date.', 'date-time-section');
    }

    if (this.isDateDisabled(this.selectedDate.date)) {
      return this.showValidationError('This date is not available under the current salon booking settings.', 'date-time-section');
    }

    if (!this.selectedTime || !this.availableTimes.includes(this.selectedTime)) {
      this.clearSelectedTime();
      return this.showValidationError('Please select an available appointment time.', 'date-time-section');
    }

    if (!this.customer.name.trim()) {
      return this.showValidationError('Please enter your full name.', 'customer-details-section', 'customer-name-input');
    }

    if (!this.customer.phone.trim()) {
      this.phoneTouched = true;
      return this.showValidationError('Please enter your Pakistan mobile number.', 'customer-details-section', 'customer-phone-input');
    }

    if (!this.isPakistanPhoneValid) {
      this.phoneTouched = true;
      return this.showValidationError('Please enter a valid Pakistan mobile number, e.g. +92 300 1234567.', 'customer-details-section', 'customer-phone-input');
    }

    this.bookingValidationMessage = '';
    return true;
  }

  private showValidationError(message: string, sectionId: string, focusId?: string): false {
    this.bookingValidationMessage = message;

    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (focusId) {
        setTimeout(() => document.getElementById(focusId)?.focus(), 450);
      }
    });

    return false;
  }

  canConfirmBooking(): boolean {
    return !!(
      this.allParticipantsReady
      && this.selectedDate
      && !this.isDateDisabled(this.selectedDate.date)
      && this.selectedTime
      && this.availableTimes.includes(this.selectedTime)
      && this.customerDetailsComplete
    );
  }

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

  getPersonPrice(person: BookingPerson): number {
    return person.selectedServices.reduce((total, selected) => {
      const current = this.services.find(service => service.id === selected.id);
      return total + (current?.price ?? selected.price);
    }, 0);
  }

  hasServiceDiscount(service: Service): boolean {
    return service.discountPrice !== null
      && service.discountPrice > 0
      && service.discountPrice < service.originalPrice;
  }

  getServiceDiscountPercent(service: Service): number {
    if (!this.hasServiceDiscount(service)) return 0;
    return Math.round(((service.originalPrice - Number(service.discountPrice)) / service.originalPrice) * 100);
  }

  getPersonDuration(person: BookingPerson): number {
    return person.selectedServices.reduce((total, service) => total + service.duration, 0);
  }

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
    this.resetBookingForm();
  }

  private resetBookingForm(): void {
    this.bookingMode = 'single';
    this.groupStrategy = 'parallel';
    this.participants = [this.createPerson(1, 'You')];
    this.activeParticipantIndex = 0;
    this.nextPersonId = 2;
    this.selectedDate = null;
    this.clearSelectedTime();
    this.calendarDate = this.startOfMonth(new Date());
    this.customer = { name: '', phone: '', notes: '' };
    this.phoneTouched = false;
    this.bookingValidationMessage = '';
    this.confirmedAssignments = [];
    this.availableTimes = [];
    this.buildCalendar();
  }

  private clearSelectedTime(): void {
    this.selectedTime = null;
    this.sequentialSchedule = [];
  }

  private createPerson(id: number, label: string): BookingPerson {
    return { id, label, selectedServices: [], selectedBarber: null };
  }

  private get businessWindows(): { start: number; end: number }[] {
    const date = this.selectedDate?.date || new Date();
    const hours = this.settingsService.hoursForDate(date);
    return hours ? [hours] : [];
  }

  private resolveBarberAssignments(time: string): Map<number, Barber> | null {
    if (!this.selectedDate || this.isDateDisabled(this.selectedDate.date) || !this.allParticipantsReady) return null;

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
        schedule.push({
          personId: person.id,
          time: actualTime,
          barber,
          suggested: index > 0 && slot > earliestStart
        });
        earliestStart = slot + duration;
      }

      if (!failed && schedule.length === this.participants.length && schedule[0].time === firstTime) {
        return schedule;
      }
    }

    return null;
  }

  private findNextAvailableSlot(barberId: number, earliestStart: number, duration: number): number | null {
    if (!this.selectedDate) return null;

    for (const window of this.businessWindows) {
      if (earliestStart >= window.end) continue;

      let start = Math.max(earliestStart, window.start);
      const interval = this.settingsService.bookingInterval;
      start = Math.ceil(start / interval) * interval;

      for (let minutes = start; minutes + duration <= window.end; minutes += interval) {
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

      const availableBarber = this.barbers.find(barber =>
        !usedBarberIds.has(barber.id)
        && this.isBarberAvailable(barber.id, time, this.selectedDate!.fullDate, this.getPersonDuration(person))
      );

      if (!availableBarber) return null;
      assignments.set(person.id, availableBarber);
      usedBarberIds.add(availableBarber.id);
    }

    return assignments.size === this.participants.length ? assignments : null;
  }

  private isBarberAvailable(barberId: number, requestedTime: string, date: string, duration: number): boolean {
    if (!this.barberService.isAvailableOnDate(barberId, date)) return false;

    const requestedStart = this.timeToMinutes(requestedTime);
    const requestedEnd = requestedStart + duration;

    // A service must both start and finish inside the configured business hours.
    const insideBusinessHours = this.businessWindows.some(window =>
      requestedStart >= window.start && requestedEnd <= window.end
    );
    if (!insideBusinessHours) return false;

    const localBookings = this.bookedAppointments.filter(booking =>
      booking.barberId === barberId && booking.date === date
    );

    const barberName = this.barbers.find(barber => barber.id === barberId)?.name;
    const adminBookings = barberName
      ? this.bookingService.all.filter(booking =>
          booking.status !== 'Cancelled'
          && booking.barber === barberName
          && booking.date === date
        )
      : [];

    const localConflict = localBookings.some(booking => {
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = bookingStart + booking.duration;
      return requestedStart < bookingEnd && requestedEnd > bookingStart;
    });

    if (localConflict) return false;

    return !adminBookings.some(booking => {
      const bookingStart = this.timeToMinutes(booking.time);
      const bookingEnd = bookingStart + booking.duration;
      return requestedStart < bookingEnd && requestedEnd > bookingStart;
    });
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
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
