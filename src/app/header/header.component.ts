import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';
import { BrandingMediaService } from '../admin/settings/branding-media.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  constructor(
    private readonly settingsService: AdminSettingsService,
    public readonly brandingMedia: BrandingMediaService,
    private readonly router: Router
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

  get isAboutPage(): boolean {
    return this.router.url.split('?')[0].startsWith('/about');
  }

  get isGalleryPage(): boolean {
    return this.router.url.split('?')[0].startsWith('/gallery');
  }
}
