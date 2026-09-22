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
  private barbers: AdminBarber[] = [
    {
      id: 1,
      name: 'Ahmed',
      phone: '+92 300 1122334',
      experience: '5+ years',
      specialties: ['Haircut', 'Beard Trim', 'Fade'],
      workingHours: '8:00 AM – 9:00 PM',
      availability: 'Available Today',
      accountStatus: 'Active'
    },
    {
      id: 2,
      name: 'Ali',
      phone: '+92 321 4455667',
      experience: '4+ years',
      specialties: ['Haircut', 'Hair Coloring', 'Styling'],
      workingHours: '8:00 AM – 9:00 PM',
      availability: 'Available Today',
      accountStatus: 'Active'
    },
    {
      id: 3,
      name: 'Usman',
      phone: '+92 333 7788990',
      experience: '3+ years',
      specialties: ['Hair + Beard', 'Face Massage', 'Hair Wash'],
      workingHours: '8:00 AM – 9:00 PM',
      availability: 'Available Today',
      accountStatus: 'Active'
    }
  ];

  get all(): AdminBarber[] {
    return this.barbers;
  }

  get active(): AdminBarber[] {
    return this.barbers.filter(item => item.accountStatus === 'Active');
  }

  get availableToday(): AdminBarber[] {
    return this.barbers.filter(item =>
      item.accountStatus === 'Active' && item.availability === 'Available Today'
    );
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
        specialties: input.specialties.filter(Boolean)
      }
    ];

    return { success: true, message: input.name.trim() + ' added successfully.' };
  }

  updateAvailability(id: number, availability: BarberAvailability): BarberMutationResult {
    const barber = this.barbers.find(item => item.id === id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    barber.availability = availability;

    if (availability === 'Available Today' || availability === 'Not Available Today') {
      barber.leaveFrom = undefined;
      barber.leaveTo = undefined;
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
    const barber = this.barbers.find(item => item.id === id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    if (!leaveFrom || !leaveTo) {
      return { success: false, message: 'Select both leave start and end dates.' };
    }

    if (leaveTo < leaveFrom) {
      return { success: false, message: 'Leave end date cannot be before the start date.' };
    }

    barber.availability = availability;
    barber.leaveFrom = leaveFrom;
    barber.leaveTo = leaveTo;
    barber.note = note.trim();

    return { success: true, message: barber.name + ' marked ' + availability.toLowerCase() + '.' };
  }

  toggleAccountStatus(id: number): BarberMutationResult {
    const barber = this.barbers.find(item => item.id === id);
    if (!barber) return { success: false, message: 'Barber not found.' };

    barber.accountStatus = barber.accountStatus === 'Active' ? 'Inactive' : 'Active';

    if (barber.accountStatus === 'Inactive') {
      barber.availability = 'Not Available Today';
    }

    return {
      success: true,
      message: barber.name + ' is now ' + barber.accountStatus.toLowerCase() + '.'
    };
  }
}
