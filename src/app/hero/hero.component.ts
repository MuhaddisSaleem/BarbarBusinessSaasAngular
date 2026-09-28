import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AdminBarberService } from '../admin/barbers/admin-barber.service';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';
import { BrandingMediaService } from '../admin/settings/branding-media.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  constructor(
    private readonly settingsService: AdminSettingsService,
    private readonly barberService: AdminBarberService,
    public readonly brandingMedia: BrandingMediaService
  ) {}

  get businessName(): string {
    return this.settingsService.current.businessName || 'Salon';
  }

  get businessNameUpper(): string {
    return this.businessName.toUpperCase();
  }

  get brandSubtitle(): string {
    return this.settingsService.current.brandSubtitle || '';
  }

  get heroEyebrow(): string {
    return this.settingsService.current.heroEyebrow || '';
  }

  get heroHeadline(): string {
    return (this.settingsService.current.heroHeadline || this.businessName).toUpperCase();
  }

  get heroTagline(): string {
    return this.settingsService.current.heroTagline || '';
  }

  get locationLabel(): string {
    const settings = this.settingsService.current;
    return [settings.address, settings.city].filter(Boolean).join(', ') || 'Location not configured';
  }

  get activeBarberCount(): number {
    return this.barberService.active.length;
  }

  get averageRatingLabel(): string {
    const ratings = this.barberService.active
      .map(barber => Number(barber.rating))
      .filter(rating => Number.isFinite(rating) && rating > 0);

    if (!ratings.length) return '—';

    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return average.toFixed(1);
  }

  get todayClosingLabel(): string {
    const hours = this.settingsService.hoursForDate(new Date());
    return hours ? this.minutesToTime(hours.end) : 'Closed today';
  }

  private minutesToTime(totalMinutes: number): string {
    let hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' ' + period;
  }
}
