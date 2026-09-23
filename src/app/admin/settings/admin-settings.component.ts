import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminSettings, AdminSettingsService } from './admin-settings.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss'
})
export class AdminSettingsComponent {
  settings: AdminSettings;
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';
  resetConfirmOpen = false;

  readonly bookingIntervals = [10, 15, 20, 30, 45, 60];

  constructor(public readonly settingsService: AdminSettingsService) {
    this.settings = this.settingsService.current;
  }

  saveSettings(): void {
    const result = this.settingsService.save(this.settings);
    this.feedbackType = result.success ? 'success' : 'error';
    this.feedbackMessage = result.message;

    if (result.success) {
      this.settings = this.settingsService.current;
    }

    window.setTimeout(() => {
      if (this.feedbackMessage === result.message) this.feedbackMessage = '';
    }, 3500);
  }

  requestReset(): void {
    this.resetConfirmOpen = true;
  }

  closeReset(): void {
    this.resetConfirmOpen = false;
  }

  confirmReset(): void {
    this.settings = this.settingsService.reset();
    this.resetConfirmOpen = false;
    this.feedbackType = 'success';
    this.feedbackMessage = 'Settings reset to the default salon configuration.';
  }

  onPhoneInput(event: Event, field: 'businessPhone' | 'whatsappNumber'): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');

    if (digits.startsWith('92')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);

    digits = digits.slice(0, 10);
    this.settings[field] = digits ? '+92 ' + digits.slice(0, 3) + ' ' + digits.slice(3) : '';
    input.value = this.settings[field];
  }

  onReminderHoursInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 2);

    if (!digits) {
      this.settings.reminderHoursBefore = 0;
      input.value = '';
      return;
    }

    const hours = Math.min(72, Math.max(1, Number(digits)));
    this.settings.reminderHoursBefore = hours;
    input.value = String(hours);
  }

  copyBusinessPhoneToWhatsapp(): void {
    this.settings.whatsappNumber = this.settings.businessPhone;
  }
}
