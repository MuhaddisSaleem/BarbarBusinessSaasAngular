import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';
import { BrandingMediaService } from '../admin/settings/branding-media.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  readonly instagramUrl = 'https://www.instagram.com/thetrimtownstudio/';
  readonly facebookUrl = 'https://www.facebook.com/trimtownstudio';
  readonly locationUrl = 'https://maps.app.goo.gl/qXg3irTRuPDktw9h7';
  readonly contactEmail = 'thetrimtown@gmail.com';

  constructor(
    private readonly settingsService: AdminSettingsService,
    public readonly brandingMedia: BrandingMediaService
  ) {}

  get businessName(): string {
    return this.settingsService.current.businessName || 'The Trim Town';
  }

  get businessNameUpper(): string {
    return this.businessName.toUpperCase();
  }

  get brandSubtitle(): string {
    return this.settingsService.current.brandSubtitle || 'Premium Grooming Studio';
  }

  get locationLabel(): string {
    const settings = this.settingsService.current;
    const location = [settings.address, settings.city].filter(Boolean).join(', ');
    return location || 'The Trim Town Studio, Bahawalpur';
  }


  get currentYear(): number {
    return new Date().getFullYear();
  }
}
