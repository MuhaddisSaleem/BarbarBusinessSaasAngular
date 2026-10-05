import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminSettings, AdminSettingsService } from './admin-settings.service';
import { BrandingMediaService } from './branding-media.service';
import { AuthService } from '../../core/auth.service';

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
  brandingBusy = false;
  savingSettings = false;
  resettingSettings = false;

  newLoginEmail = '';
  emailCurrentPassword = '';
  emailVerificationCode = '';
  emailVerificationSent = false;
  emailSecurityBusy = false;

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  passwordSecurityBusy = false;

  readonly bookingIntervals = [10, 15, 20, 30, 45, 60];

  constructor(
    public readonly settingsService: AdminSettingsService,
    public readonly brandingMedia: BrandingMediaService,
    public readonly authService: AuthService
  ) {
    this.settings = this.withDeferredMessagingPaused(this.settingsService.current);
  }

  get currentLoginEmail(): string {
    return this.authService.currentUser?.email || 'Loading...';
  }

  get currentOwnerName(): string {
    return this.authService.currentUser?.fullName || 'The Trim Town Owner';
  }

  requestLoginEmailChange(): void {
    if (this.emailSecurityBusy) return;

    const email = this.newLoginEmail.trim();
    if (!email) {
      this.showSecurityFeedback(false, 'Enter the new login email address.');
      return;
    }

    if (!this.emailCurrentPassword) {
      this.showSecurityFeedback(false, 'Enter your current password to change the login email.');
      return;
    }

    this.emailSecurityBusy = true;
    this.authService.requestEmailChange(this.emailCurrentPassword, email).subscribe({
      next: response => {
        this.emailSecurityBusy = false;
        this.emailVerificationSent = response.success;

        if (response.success) {
          this.emailVerificationCode = '';
          this.showSecurityFeedback(true, response.message);
          return;
        }

        this.showSecurityFeedback(false, response.message);
      },
      error: error => {
        this.emailSecurityBusy = false;
        this.showSecurityFeedback(false, this.securityApiError(error, 'Could not send the verification code.'));
      }
    });
  }

  confirmLoginEmailChange(): void {
    if (this.emailSecurityBusy) return;

    const code = this.emailVerificationCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      this.showSecurityFeedback(false, 'Enter the 6-digit verification code.');
      return;
    }

    this.emailSecurityBusy = true;
    this.authService.confirmEmailChange(this.newLoginEmail, code).subscribe({
      next: response => {
        this.emailSecurityBusy = false;

        if (!response.success) {
          this.showSecurityFeedback(false, response.message);
          return;
        }

        this.newLoginEmail = '';
        this.emailCurrentPassword = '';
        this.emailVerificationCode = '';
        this.emailVerificationSent = false;
        this.showSecurityFeedback(true, response.message);
      },
      error: error => {
        this.emailSecurityBusy = false;
        this.showSecurityFeedback(false, this.securityApiError(error, 'Could not verify the new login email.'));
      }
    });
  }

  cancelLoginEmailChange(): void {
    if (this.emailSecurityBusy) return;
    this.newLoginEmail = '';
    this.emailCurrentPassword = '';
    this.emailVerificationCode = '';
    this.emailVerificationSent = false;
  }

  onEmailVerificationInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 6);
    this.emailVerificationCode = value;
    input.value = value;
  }

  changeAdminPassword(): void {
    if (this.passwordSecurityBusy) return;

    if (!this.currentPassword) {
      this.showSecurityFeedback(false, 'Enter your current password.');
      return;
    }

    if (this.newPassword.length < 8) {
      this.showSecurityFeedback(false, 'New password must contain at least 8 characters.');
      return;
    }

    if (!/[A-Za-z]/.test(this.newPassword) || !/\d/.test(this.newPassword)) {
      this.showSecurityFeedback(false, 'New password must include at least one letter and one number.');
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.showSecurityFeedback(false, 'New password and confirmation do not match.');
      return;
    }

    this.passwordSecurityBusy = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: response => {
        this.passwordSecurityBusy = false;

        if (!response.success) {
          this.showSecurityFeedback(false, response.message);
          return;
        }

        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';
        this.showSecurityFeedback(true, 'Password changed successfully. Use the new password the next time you sign in.');
      },
      error: error => {
        this.passwordSecurityBusy = false;
        this.showSecurityFeedback(false, this.securityApiError(error, 'Could not change the password.'));
      }
    });
  }

  saveSettings(): void {
    if (this.savingSettings || this.resettingSettings) return;

    this.savingSettings = true;
    const next = this.withDeferredMessagingPaused(this.settings);

    const handle = (result: { success: boolean; message: string }) => {
      this.savingSettings = false;
      this.feedbackType = result.success ? 'success' : 'error';
      this.feedbackMessage = result.message;

      if (result.success) {
        this.settings = this.withDeferredMessagingPaused(this.settingsService.current);
      }

      window.setTimeout(() => {
        if (this.feedbackMessage === result.message) this.feedbackMessage = '';
      }, 3500);
    };

    if (this.settingsService.saveThroughApi(next, handle)) return;
    handle(this.settingsService.save(next));
  }

  requestReset(): void {
    this.resetConfirmOpen = true;
  }

  closeReset(): void {
    this.resetConfirmOpen = false;
  }

  async confirmReset(): Promise<void> {
    if (this.savingSettings || this.resettingSettings) return;

    this.resettingSettings = true;

    const handle = async (result: { success: boolean; message: string }) => {
      if (!result.success) {
        this.resettingSettings = false;
        this.resetConfirmOpen = false;
        this.feedbackType = 'error';
        this.feedbackMessage = result.message;
        return;
      }

      this.settings = this.withDeferredMessagingPaused(this.settingsService.current);

      try {
        await this.brandingMedia.clearAll();
        this.feedbackType = 'success';
        this.feedbackMessage = 'Settings and landing page branding reset to defaults.';
      } catch {
        this.feedbackType = 'error';
        this.feedbackMessage = 'Settings were reset, but the saved logo or hero media could not be cleared.';
      }

      this.resettingSettings = false;
      this.resetConfirmOpen = false;
    };

    if (this.settingsService.resetThroughApi(result => { void handle(result); })) return;
    await handle(this.settingsService.reset());
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

  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.brandingBusy = true;
    const result = await this.brandingMedia.saveLogo(file);
    this.brandingBusy = false;
    this.showBrandingFeedback(result.success, result.message);
    input.value = '';
  }

  async onHeroMediaSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.brandingBusy = true;
    const result = await this.brandingMedia.saveHeroMedia(file);
    this.brandingBusy = false;
    this.showBrandingFeedback(result.success, result.message);
    input.value = '';
  }

  async removeLogo(): Promise<void> {
    try {
      await this.brandingMedia.clearLogo();
      this.showBrandingFeedback(true, 'Business logo removed.');
    } catch {
      this.showBrandingFeedback(false, 'Could not remove the saved business logo.');
    }
  }

  async removeHeroMedia(): Promise<void> {
    try {
      await this.brandingMedia.clearHeroMedia();
      this.showBrandingFeedback(true, 'Landing page hero media removed.');
    } catch {
      this.showBrandingFeedback(false, 'Could not remove the saved hero media.');
    }
  }

  copyBusinessPhoneToWhatsapp(): void {
    this.settings.whatsappNumber = this.settings.businessPhone;
  }

  private showSecurityFeedback(success: boolean, message: string): void {
    this.feedbackType = success ? 'success' : 'error';
    this.feedbackMessage = message;

    window.setTimeout(() => {
      if (this.feedbackMessage === message) this.feedbackMessage = '';
    }, 5000);
  }

  private securityApiError(error: unknown, fallback: string): string {
    return (error as any)?.error?.message || fallback;
  }

  private withDeferredMessagingPaused(settings: AdminSettings): AdminSettings {
    return {
      ...settings,
      sendWhatsappConfirmation: false,
      sendSmsFallback: false,
      sendAppointmentReminder: false
    };
  }

  private showBrandingFeedback(success: boolean, message: string): void {
    this.feedbackType = success ? 'success' : 'error';
    this.feedbackMessage = message;

    window.setTimeout(() => {
      if (this.feedbackMessage === message) this.feedbackMessage = '';
    }, 3500);
  }
}
