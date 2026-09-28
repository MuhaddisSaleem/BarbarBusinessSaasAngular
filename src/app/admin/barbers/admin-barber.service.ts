import { Injectable } from '@angular/core';
import { NotificationService } from '../notifications/notification.service';

export type BarberAvailability = 'Available Today' | 'Not Available Today' | 'On Leave' | 'Vacation';
export type BarberAccountStatus = 'Active' | 'Inactive';

export interface AdminBarber {
  id: number;
  name: string;
  phone: string;
  experience: string;
  specialties: string[];
  workingHours: string;
  image: string;
  rating: number;
  availability: BarberAvailability;
  accountStatus: BarberAccountStatus;
  leaveFrom?: string;
  leaveTo?: string;
  note?: string;
}

export interface BarberMutationResult {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AdminBarberService {
  constructor(private readonly notificationService: NotificationService) {}

  private readonly storageKey = 'royal-barbers.admin-barbers.v1';
  private readonly demoCleanupKey = 'royal-barbers.admin-barbers.demo-cleaned.v1';
  private barbers: AdminBarber[] = this.loadBarbers();

  get all(): AdminBarber[] {
    this.normalizeExpiredLeave();
    return this.barbers;
  }

  get active(): AdminBarber[] {
    this.normalizeExpiredLeave();
    return this.barbers.filter(item => item.accountStatus === 'Active');
  }

  get availableToday(): AdminBarber[] {
    this.normalizeExpiredLeave();
    const today = this.todayKey();
    return this.active.filter(item => this.isAvailableOnDate(item.id, today));
  }

  getById(id: number): AdminBarber | undefined {
    return this.barbers.find(item => item.id === id);
  }

  addBarber(input: Omit<AdminBarber, 'id'>): BarberMutationResult {
    const normalizedPhone = input.phone.replace(/\s/g, '');

    if (!input.name.trim()) {
      return { success: false, message: 'Barber name is required.' };
    }

    if (
      this.barbers.some(
        item => item.name.trim().toLowerCase() === input.name.trim().toLowerCase()
      )
    ) {
      return { success: false, message: 'A barber with this name already exists.' };
    }

    if (!/^\+923\d{9}$/.test(normalizedPhone)) {
      return { success: false, message: 'Enter a valid Pakistan mobile number.' };
    }

    if (this.barbers.some(item => item.phone.replace(/\s/g, '') === normalizedPhone)) {
      return { success: false, message: 'A barber with this mobile number already exists.' };
    }

    if (!this.workingWindow(input.workingHours)) {
      return { success: false, message: 'Enter working hours like 8:00 AM - 9:00 PM.' };
    }

    const nextId = this.barbers.length ? Math.max(...this.barbers.map(item => item.id)) + 1 : 1;

    this.barbers = [
      ...this.barbers,
      {
        ...input,
        id: nextId,
        name: input.name.trim(),
        phone: input.phone.trim(),
        experience: this.normalizeExperience(input.experience),
        image: input.image || 'assets/images/barber-placeholder.svg',
        rating: this.normalizeRating(input.rating),
        specialties: input.specialties.filter(Boolean)
      }
    ];

    if (!this.persist()) {
      this.barbers = this.barbers.filter(item => item.id !== nextId);
      return {
        success: false,
        message: 'Could not save the barber locally. Try a smaller profile image.'
      };
    }

    const added = this.getById(nextId);
    this.notificationService.add({
      type: 'system',
      title: 'Barber added',
      message: (added?.name || input.name.trim()) + ' was added to the barber team.',
      icon: 'bi-person-plus',
      url: '/admin/barbers'
    });

    return { success: true, message: input.name.trim() + ' added successfully.' };
  }

  updateBarber(
    id: number,
    changes: Pick<AdminBarber, 'name' | 'phone' | 'experience' | 'specialties' | 'workingHours' | 'image'>
  ): BarberMutationResult {
    const barber = this.getById(id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    const normalizedPhone = changes.phone.replace(/\s/g, '');

    if (!changes.name.trim()) {
      return { success: false, message: 'Barber name is required.' };
    }

    if (
      this.barbers.some(
        item => item.id !== id && item.name.trim().toLowerCase() === changes.name.trim().toLowerCase()
      )
    ) {
      return { success: false, message: 'Another barber already uses this name.' };
    }

    if (!/^\+923\d{9}$/.test(normalizedPhone)) {
      return { success: false, message: 'Enter a valid Pakistan mobile number.' };
    }

    if (
      this.barbers.some(
        item => item.id !== id && item.phone.replace(/\s/g, '') === normalizedPhone
      )
    ) {
      return { success: false, message: 'Another barber already uses this mobile number.' };
    }

    if (!changes.specialties.length) {
      return { success: false, message: 'Select at least one specialty.' };
    }

    if (!this.workingWindow(changes.workingHours)) {
      return { success: false, message: 'Enter working hours like 8:00 AM - 9:00 PM.' };
    }

    const previous = {
      name: barber.name,
      phone: barber.phone,
      experience: barber.experience,
      specialties: [...barber.specialties],
      workingHours: barber.workingHours,
      image: barber.image
    };

    barber.name = changes.name.trim();
    barber.phone = changes.phone.trim();
    barber.experience = this.normalizeExperience(changes.experience);
    barber.specialties = changes.specialties.filter(Boolean);
    barber.workingHours = changes.workingHours.trim();
    barber.image = changes.image || barber.image || 'assets/images/barber-placeholder.svg';

    if (!this.persist()) {
      barber.name = previous.name;
      barber.phone = previous.phone;
      barber.experience = previous.experience;
      barber.specialties = previous.specialties;
      barber.workingHours = previous.workingHours;
      barber.image = previous.image;
      return { success: false, message: 'Could not save the barber changes.' };
    }

    this.notificationService.add({
      type: 'system',
      title: 'Barber profile updated',
      message: barber.name + ' profile details were updated.',
      icon: 'bi-person-gear',
      url: '/admin/barbers'
    });

    return { success: true, message: barber.name + ' updated successfully.' };
  }

  deleteBarber(id: number): BarberMutationResult {
    const barber = this.getById(id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    const previous = [...this.barbers];
    this.barbers = this.barbers.filter(item => item.id !== id);

    if (!this.persist()) {
      this.barbers = previous;
      return { success: false, message: 'Could not save the barber change.' };
    }

    this.notificationService.add({
      type: 'system',
      title: 'Barber removed',
      message: barber.name + ' was removed from the barber team.',
      icon: 'bi-person-dash',
      url: '/admin/barbers'
    });

    return { success: true, message: barber.name + ' removed from the barber list.' };
  }

  updateAvailability(id: number, availability: BarberAvailability): BarberMutationResult {
    const barber = this.getById(id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    const previous = { ...barber };
    barber.availability = availability;

    if (availability === 'Available Today' || availability === 'Not Available Today') {
      barber.leaveFrom = undefined;
      barber.leaveTo = undefined;
      barber.note = '';
    }

    if (!this.persist()) {
      Object.assign(barber, previous);
      return { success: false, message: 'Could not save the barber availability.' };
    }

    if (previous.availability !== availability) {
      this.notificationService.add({
        type: 'system',
        title: 'Barber availability changed',
        message: barber.name + ' is now marked "' + availability + '".',
        icon: availability === 'Available Today' ? 'bi-person-check' : 'bi-person-x',
        url: '/admin/barbers'
      });
    }

    return { success: true, message: barber.name + ' availability updated.' };
  }

  updateLeave(
    id: number,
    availability: 'On Leave' | 'Vacation',
    leaveFrom: string,
    leaveTo: string,
    note = ''
  ): BarberMutationResult {
    const barber = this.getById(id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    if (!leaveFrom || !leaveTo) {
      return { success: false, message: 'Select both leave start and end dates.' };
    }

    if (leaveTo < leaveFrom) {
      return { success: false, message: 'Leave end date cannot be before the start date.' };
    }

    const previous = { ...barber };
    barber.availability = availability;
    barber.leaveFrom = leaveFrom;
    barber.leaveTo = leaveTo;
    barber.note = note.trim();

    if (!this.persist()) {
      Object.assign(barber, previous);
      return { success: false, message: 'Could not save the leave information.' };
    }

    this.notificationService.add({
      type: 'system',
      title: availability === 'Vacation' ? 'Barber vacation scheduled' : 'Barber leave scheduled',
      message: barber.name + ' is ' + availability.toLowerCase() + ' from ' + leaveFrom + ' to ' + leaveTo + '.',
      icon: 'bi-calendar2-x',
      url: '/admin/barbers'
    });

    return { success: true, message: barber.name + ' marked ' + availability.toLowerCase() + '.' };
  }

  toggleAccountStatus(id: number): BarberMutationResult {
    const barber = this.getById(id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    const previous = { ...barber };
    barber.accountStatus = barber.accountStatus === 'Active' ? 'Inactive' : 'Active';

    if (barber.accountStatus === 'Inactive') {
      barber.availability = 'Not Available Today';
    } else {
      barber.availability = 'Available Today';
    }

    if (!this.persist()) {
      Object.assign(barber, previous);
      return { success: false, message: 'Could not save the barber status.' };
    }

    this.notificationService.add({
      type: 'system',
      title: 'Barber account ' + (barber.accountStatus === 'Active' ? 'activated' : 'deactivated'),
      message: barber.name + ' is now ' + barber.accountStatus.toLowerCase() + '.',
      icon: barber.accountStatus === 'Active' ? 'bi-person-check' : 'bi-person-slash',
      url: '/admin/barbers'
    });

    return {
      success: true,
      message: barber.name + ' is now ' + barber.accountStatus.toLowerCase() + '.'
    };
  }

  renameSpecialty(previousName: string, nextName: string): BarberMutationResult {
    const from = previousName.trim();
    const to = nextName.trim();
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
      return { success: true, message: '' };
    }

    const snapshots = this.barbers.map(barber => ({
      id: barber.id,
      specialties: [...barber.specialties]
    }));

    let changed = false;
    this.barbers.forEach(barber => {
      const next = barber.specialties.map(specialty =>
        specialty.trim().toLowerCase() === from.toLowerCase() ? to : specialty
      );

      const unique = Array.from(new Map(
        next.map(specialty => [specialty.trim().toLowerCase(), specialty.trim()])
      ).values()).filter(Boolean);

      if (JSON.stringify(unique) !== JSON.stringify(barber.specialties)) {
        barber.specialties = unique;
        changed = true;
      }
    });

    if (changed && !this.persist()) {
      snapshots.forEach(snapshot => {
        const barber = this.getById(snapshot.id);
        if (barber) barber.specialties = snapshot.specialties;
      });
      return { success: false, message: 'Could not update barber specialties for the renamed service.' };
    }

    return { success: true, message: '' };
  }

  removeSpecialty(serviceName: string): BarberMutationResult {
    const target = serviceName.trim().toLowerCase();
    if (!target) return { success: true, message: '' };

    const snapshots = this.barbers.map(barber => ({
      id: barber.id,
      specialties: [...barber.specialties]
    }));

    let changed = false;
    this.barbers.forEach(barber => {
      const next = barber.specialties.filter(
        specialty => specialty.trim().toLowerCase() !== target
      );

      if (next.length !== barber.specialties.length) {
        barber.specialties = next;
        changed = true;
      }
    });

    if (changed && !this.persist()) {
      snapshots.forEach(snapshot => {
        const barber = this.getById(snapshot.id);
        if (barber) barber.specialties = snapshot.specialties;
      });
      return { success: false, message: 'Could not update barber specialties for the deleted service.' };
    }

    return { success: true, message: '' };
  }

  isWorkingAt(id: number, time: string, duration: number): boolean {
    const barber = this.getById(id);
    if (!barber || barber.accountStatus !== 'Active') return false;

    const window = this.workingWindow(barber.workingHours);
    if (!window) return true;

    const start = this.timeToMinutes(time);
    if (!Number.isFinite(start) || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
      return false;
    }

    return start >= window.start && start + Number(duration) <= window.end;
  }

  supportsServices(id: number, serviceNames: string[]): boolean {
    const barber = this.getById(id);
    if (!barber || barber.accountStatus !== 'Active') return false;

    const required = serviceNames
      .map(name => name.trim().toLowerCase())
      .filter(Boolean);

    if (!required.length) return true;

    const specialties = new Set(
      barber.specialties.map(name => name.trim().toLowerCase()).filter(Boolean)
    );

    return required.every(name => specialties.has(name));
  }

  eligibleForBooking(id: number, dateKey: string, serviceNames: string[]): boolean {
    return this.isAvailableOnDate(id, dateKey) && this.supportsServices(id, serviceNames);
  }

  isAvailableOnDate(id: number, dateKey: string): boolean {
    const barber = this.getById(id);
    if (!barber || barber.accountStatus !== 'Active') return false;

    if (barber.availability === 'Available Today') return true;

    if (barber.availability === 'Not Available Today') {
      return dateKey !== this.todayKey();
    }

    if (barber.leaveFrom && barber.leaveTo) {
      return dateKey < barber.leaveFrom || dateKey > barber.leaveTo;
    }

    return false;
  }

  availabilityLabelForDate(id: number, dateKey: string): string {
    const barber = this.getById(id);
    if (!barber || barber.accountStatus !== 'Active') return 'Unavailable';

    if (this.isAvailableOnDate(id, dateKey)) return '';

    if (barber.availability === 'Vacation') return 'On Vacation';
    if (barber.availability === 'On Leave') return 'On Leave';
    return 'Not Available Today';
  }

  private normalizeExpiredLeave(): void {
    const today = this.todayKey();
    let changed = false;

    this.barbers.forEach(barber => {
      if (
        barber.accountStatus === 'Active'
        && (barber.availability === 'On Leave' || barber.availability === 'Vacation')
        && barber.leaveTo
        && barber.leaveTo < today
      ) {
        barber.availability = 'Available Today';
        barber.leaveFrom = undefined;
        barber.leaveTo = undefined;
        barber.note = '';
        changed = true;
      }
    });

    if (changed) this.persist();
  }

  private loadBarbers(): AdminBarber[] {
    if (typeof window === 'undefined') return [];

    try {
      const saved = window.localStorage.getItem(this.storageKey);
      if (!saved) {
        window.localStorage.setItem(this.demoCleanupKey, '1');
        return [];
      }

      const parsed = JSON.parse(saved) as AdminBarber[];
      if (!Array.isArray(parsed)) return [];

      const needsCleanup = window.localStorage.getItem(this.demoCleanupKey) !== '1';
      const demoPhones = new Set([
        '+923001122334',
        '+923214455667',
        '+923337788990'
      ]);

      const cleaned = parsed
        .filter(item =>
          !needsCleanup
          || !demoPhones.has(String(item.phone || '').replace(/\s/g, ''))
        )
        .map(item => ({
          ...item,
          image: item.image || 'assets/images/barber-placeholder.svg',
          rating: this.normalizeRating(item.rating),
          experience: this.normalizeExperience(item.experience),
          specialties: Array.isArray(item.specialties) ? item.specialties.filter(Boolean) : [],
          workingHours: String(item.workingHours || '').trim(),
          availability: this.normalizeAvailability(item.availability),
          accountStatus: item.accountStatus === 'Inactive' ? 'Inactive' : 'Active',
          leaveFrom: item.leaveFrom || undefined,
          leaveTo: item.leaveTo || undefined,
          note: String(item.note || '')
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

  private normalizeAvailability(value: BarberAvailability): BarberAvailability {
    return value === 'Not Available Today'
      || value === 'On Leave'
      || value === 'Vacation'
      ? value
      : 'Available Today';
  }

  private normalizeRating(value: number): number {
    const rating = Number(value);
    if (!Number.isFinite(rating) || rating <= 0) return 5;
    return Math.min(5, Math.max(1, Number(rating.toFixed(1))));
  }

  private normalizeExperience(value: string): string {
    const raw = String(value || '').trim();

    if (!raw) return 'New';

    if (/\byears?\b/i.test(raw)) {
      return raw;
    }

    const numeric = raw.match(/\d+(?:\.\d+)?/);
    if (numeric) {
      return numeric[0] + '+ years';
    }

    return raw;
  }

  private workingWindow(value: string): { start: number; end: number } | null {
    const normalized = String(value || '')
      .replace(/[–—]/g, '-')
      .replace(/\s+to\s+/i, ' - ')
      .trim();

    const match = normalized.match(
      /^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i
    );

    if (!match) return null;

    const start = this.timeToMinutes(match[1]);
    const end = this.timeToMinutes(match[2]);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { start, end };
  }

  private timeToMinutes(value: string): number {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return Number.NaN;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return Number.NaN;
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return hour * 60 + minute;
  }

  private persist(): boolean {
    if (typeof window === 'undefined') return true;

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.barbers));
      return true;
    } catch {
      return false;
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
}
