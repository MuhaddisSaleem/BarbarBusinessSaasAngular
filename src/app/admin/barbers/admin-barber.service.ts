import { Injectable } from '@angular/core';

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
  private readonly storageKey = 'royal-barbers.admin-barbers.v1';
  private barbers: AdminBarber[] = this.loadBarbers();

  get all(): AdminBarber[] {
    return this.barbers;
  }

  get active(): AdminBarber[] {
    return this.barbers.filter(item => item.accountStatus === 'Active');
  }

  get availableToday(): AdminBarber[] {
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

    if (!/^\+923\d{9}$/.test(normalizedPhone)) {
      return { success: false, message: 'Enter a valid Pakistan mobile number.' };
    }

    if (this.barbers.some(item => item.phone.replace(/\s/g, '') === normalizedPhone)) {
      return { success: false, message: 'A barber with this mobile number already exists.' };
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
        rating: input.rating || 0,
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

    return { success: true, message: input.name.trim() + ' added successfully.' };
  }

  updateBarber(
    id: number,
    changes: Pick<AdminBarber, 'name' | 'phone' | 'experience' | 'specialties' | 'workingHours'>
  ): BarberMutationResult {
    const barber = this.getById(id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    const normalizedPhone = changes.phone.replace(/\s/g, '');

    if (!changes.name.trim()) {
      return { success: false, message: 'Barber name is required.' };
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

    const previous = {
      name: barber.name,
      phone: barber.phone,
      experience: barber.experience,
      specialties: [...barber.specialties],
      workingHours: barber.workingHours
    };

    barber.name = changes.name.trim();
    barber.phone = changes.phone.trim();
    barber.experience = this.normalizeExperience(changes.experience);
    barber.specialties = changes.specialties.filter(Boolean);
    barber.workingHours = changes.workingHours.trim();

    if (!this.persist()) {
      barber.name = previous.name;
      barber.phone = previous.phone;
      barber.experience = previous.experience;
      barber.specialties = previous.specialties;
      barber.workingHours = previous.workingHours;
      return { success: false, message: 'Could not save the barber changes.' };
    }

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

    return {
      success: true,
      message: barber.name + ' is now ' + barber.accountStatus.toLowerCase() + '.'
    };
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

  private loadBarbers(): AdminBarber[] {
    if (typeof window === 'undefined') return [];

    try {
      const saved = window.localStorage.getItem(this.storageKey);
      if (!saved) return [];

      const parsed = JSON.parse(saved) as AdminBarber[];
      if (!Array.isArray(parsed)) return [];

      const demoPhones = new Set([
        '+923001122334',
        '+923214455667',
        '+923337788990'
      ]);

      const cleaned = parsed
        .filter(item => !demoPhones.has(String(item.phone || '').replace(/\s/g, '')))
        .map(item => ({
          ...item,
          image: item.image || 'assets/images/barber-placeholder.svg',
          rating: Number(item.rating || 0),
          experience: this.normalizeExperience(item.experience),
          specialties: Array.isArray(item.specialties) ? item.specialties : []
        }));

      if (cleaned.length !== parsed.length) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(cleaned));
      }

      return cleaned;
    } catch {
      return [];
    }
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
