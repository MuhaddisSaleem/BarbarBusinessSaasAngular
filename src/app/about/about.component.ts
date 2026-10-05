import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  constructor(private readonly settingsService: AdminSettingsService) {}

  get businessName(): string {
    return this.settingsService.current.businessName || 'The Trim Town';
  }

  get city(): string {
    return this.settingsService.current.city || 'Bahawalpur';
  }
}
