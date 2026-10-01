import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { LegacyCatalogMigrationService } from '../core/legacy-catalog-migration.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss'
})
export class AdminLoginComponent {
  email = '';
  password = '';
  rememberMe = true;
  showPassword = false;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly migration: LegacyCatalogMigrationService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/admin');
    }
  }

  login(): void {
    if (this.loading) return;

    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'Enter your email and password.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.auth.login(this.email, this.password, this.rememberMe).subscribe({
      next: async response => {
        if (!response.success) {
          this.loading = false;
          this.errorMessage = response.message || 'Unable to sign in.';
          return;
        }

        // A legacy browser migration may have been deferred until authentication existed.
        await this.migration.initialize();

        const requested = this.route.snapshot.queryParamMap.get('returnUrl') || '/admin';
        const destination =
          requested.startsWith('/admin') && requested !== '/admin/login'
            ? requested
            : '/admin';

        this.loading = false;
        await this.router.navigateByUrl(destination);
      },
      error: error => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message
          || (error?.status === 0
            ? 'The admin API is unavailable. Make sure the backend is running.'
            : 'Invalid email or password.');
      }
    });
  }

  openBookingSite(): void {
    void this.router.navigateByUrl('/');
  }
}
