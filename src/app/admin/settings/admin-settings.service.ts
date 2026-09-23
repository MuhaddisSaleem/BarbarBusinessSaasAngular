import { Injectable } from '@angular/core';

export interface BusinessHoursDay {
  key: string;
  label: string;
  enabled: boolean;
  open: string;
  close: string;
}

export interface AdminSettings {
  businessName: string;
  businessPhone: string;
  whatsappNumber: string;
  email: string;
  address: string;
  city: string;
  currency: string;
  timezone: string;

  bookingInterval: number;
  maxAdvanceDays: number;
  cancellationHours: number;
  lateArrivalMinutes: number;
  allowSameDayBooking: boolean;
  autoConfirmBookings: boolean;

  sendWhatsappConfirmation: boolean;
  sendSmsFallback: boolean;
  sendAppointmentReminder: boolean;
  reminderHoursBefore: number;
  notifyOwnerOnNewBooking: boolean;

  businessHours: BusinessHoursDay[];
}

export interface SettingsSaveResult {
  success: boolean;
  message: string;
}

const DEFAULT_HOURS: BusinessHoursDay[] = [
  { key: 'monday', label: 'Monday', enabled: true, open: '08:00', close: '21:00' },
  { key: 'tuesday', label: 'Tuesday', enabled: true, open: '08:00', close: '21:00' },
  { key: 'wednesday', label: 'Wednesday', enabled: true, open: '08:00', close: '21:00' },
  { key: 'thursday', label: 'Thursday', enabled: true, open: '08:00', close: '21:00' },
  { key: 'friday', label: 'Friday', enabled: true, open: '08:00', close: '21:00' },
  { key: 'saturday', label: 'Saturday', enabled: true, open: '08:00', close: '21:00' },
  { key: 'sunday', label: 'Sunday', enabled: true, open: '08:00', close: '21:00' }
];

const DEFAULT_SETTINGS: AdminSettings = {
  businessName: 'Royal Barbers',
  businessPhone: '+92 300 1234567',
  whatsappNumber: '+92 300 1234567',
  email: '',
  address: '',
  city: 'Bahawalpur',
  currency: 'PKR',
  timezone: 'Asia/Karachi',

  bookingInterval: 30,
  maxAdvanceDays: 30,
  cancellationHours: 2,
  lateArrivalMinutes: 10,
  allowSameDayBooking: true,
  autoConfirmBookings: true,

  sendWhatsappConfirmation: true,
  sendSmsFallback: false,
  sendAppointmentReminder: true,
  reminderHoursBefore: 2,
  notifyOwnerOnNewBooking: true,

  businessHours: DEFAULT_HOURS
};

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly storageKey = 'royal-barbers.admin-settings.v1';
  private settings = this.loadSettings();

  get current(): AdminSettings {
    return this.clone(this.settings);
  }

  get bookingInterval(): number {
    return Math.max(5, Number(this.settings.bookingInterval) || 30);
  }

  get maxAdvanceDays(): number {
    return Math.max(1, Number(this.settings.maxAdvanceDays) || 30);
  }

  isBookingDateAllowed(date: Date): boolean {
    const candidate = this.startOfDay(date);
    const today = this.startOfDay(new Date());

    if (candidate.getTime() < today.getTime()) return false;
    if (!this.settings.allowSameDayBooking && candidate.getTime() === today.getTime()) return false;

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + this.maxAdvanceDays);
    if (candidate.getTime() > maxDate.getTime()) return false;

    return !!this.hoursForDate(candidate);
  }

  hoursForDate(date: Date): { start: number; end: number } | null {
    const dayKey = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    ][date.getDay()];

    const day = this.settings.businessHours.find(item => item.key === dayKey);
    if (!day?.enabled) return null;

    const start = this.clockToMinutes(day.open);
    const end = this.clockToMinutes(day.close);

    if (start === null || end === null || end <= start) return null;
    return { start, end };
  }

  save(next: AdminSettings): SettingsSaveResult {
    const validation = this.validate(next);
    if (!validation.success) return validation;

    const normalized: AdminSettings = {
      ...next,
      businessName: next.businessName.trim(),
      businessPhone: next.businessPhone.trim(),
      whatsappNumber: next.whatsappNumber.trim(),
      email: next.email.trim(),
      address: next.address.trim(),
      city: next.city.trim(),
      bookingInterval: Number(next.bookingInterval),
      maxAdvanceDays: Number(next.maxAdvanceDays),
      cancellationHours: Number(next.cancellationHours),
      lateArrivalMinutes: Number(next.lateArrivalMinutes),
      reminderHoursBefore: Number(next.reminderHoursBefore),
      businessHours: next.businessHours.map(day => ({
        ...day,
        open: day.open,
        close: day.close
      }))
    };

    this.settings = normalized;

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(normalized));
      } catch {
        return { success: false, message: 'Could not save settings in this browser.' };
      }
    }

    return { success: true, message: 'Settings saved successfully.' };
  }

  reset(): AdminSettings {
    this.settings = this.clone(DEFAULT_SETTINGS);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    }

    return this.current;
  }

  private validate(settings: AdminSettings): SettingsSaveResult {
    if (!settings.businessName.trim()) {
      return { success: false, message: 'Business name is required.' };
    }

    if (!this.validPakistanPhone(settings.businessPhone)) {
      return { success: false, message: 'Enter a valid Pakistan business phone number.' };
    }

    if (!this.validPakistanPhone(settings.whatsappNumber)) {
      return { success: false, message: 'Enter a valid Pakistan WhatsApp number.' };
    }

    if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
      return { success: false, message: 'Enter a valid email address.' };
    }

    if (Number(settings.bookingInterval) < 5) {
      return { success: false, message: 'Booking interval must be at least 5 minutes.' };
    }

    if (Number(settings.maxAdvanceDays) < 1) {
      return { success: false, message: 'Advance booking window must be at least 1 day.' };
    }

    for (const day of settings.businessHours.filter(item => item.enabled)) {
      if (!day.open || !day.close || day.close <= day.open) {
        return {
          success: false,
          message: day.label + ' closing time must be later than opening time.'
        };
      }
    }

    return { success: true, message: '' };
  }

  private clockToMinutes(value: string): number | null {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private validPakistanPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return /^(?:92)?3\d{9}$/.test(digits);
  }

  private loadSettings(): AdminSettings {
    if (typeof window === 'undefined') return this.clone(DEFAULT_SETTINGS);

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return this.clone(DEFAULT_SETTINGS);

      const parsed = JSON.parse(raw) as Partial<AdminSettings>;
      return {
        ...this.clone(DEFAULT_SETTINGS),
        ...parsed,
        businessHours: Array.isArray(parsed.businessHours)
          ? parsed.businessHours.map((day, index) => ({
              ...DEFAULT_HOURS[index],
              ...day
            }))
          : DEFAULT_HOURS.map(day => ({ ...day }))
      };
    } catch {
      return this.clone(DEFAULT_SETTINGS);
    }
  }

  private clone(settings: AdminSettings): AdminSettings {
    return {
      ...settings,
      businessHours: settings.businessHours.map(day => ({ ...day }))
    };
  }
}
