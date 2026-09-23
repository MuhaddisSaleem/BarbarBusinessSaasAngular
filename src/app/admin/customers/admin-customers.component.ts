import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminBooking } from '../bookings/admin-booking.service';
import { AdminCustomer, AdminCustomerService, CustomerType } from './admin-customer.service';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-customers.component.html',
  styleUrl: './admin-customers.component.scss'
})
export class AdminCustomersComponent {
  searchTerm = '';
  selectedType: 'All' | CustomerType = 'All';

  selectedCustomer: AdminCustomer | null = null;
  customerBookings: AdminBooking[] = [];
  drawerOpen = false;
  noteDraft = '';
  feedbackMessage = '';

  constructor(
    public readonly customerService: AdminCustomerService,
    private readonly router: Router
  ) {}

  get customers(): AdminCustomer[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.customerService.all
      .filter(item => this.selectedType === 'All' || item.customerType === this.selectedType)
      .filter(item => {
        if (!term) return true;

        return [
          item.name,
          item.phone
        ].some(value => value.toLowerCase().includes(term));
      });
  }

  get totalCustomers(): number {
    return this.customerService.all.length;
  }

  get returningCustomers(): number {
    return this.customerService.all.filter(item => item.customerType === 'Returning').length;
  }

  get customersWithUpcomingBooking(): number {
    return this.customerService.all.filter(item => !!item.nextBooking).length;
  }

  get totalCompletedSpend(): number {
    return this.customerService.all.reduce((sum, item) => sum + item.totalSpend, 0);
  }

  openCustomer(customer: AdminCustomer): void {
    const fresh = this.customerService.getById(customer.id) || customer;
    this.selectedCustomer = fresh;
    this.customerBookings = this.customerService.bookingsForCustomer(fresh);
    this.noteDraft = fresh.notes;
    this.drawerOpen = true;
    this.feedbackMessage = '';
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedCustomer = null;
    this.customerBookings = [];
    this.noteDraft = '';
    this.feedbackMessage = '';
  }

  saveNote(): void {
    if (!this.selectedCustomer) return;

    this.customerService.saveNote(this.selectedCustomer.id, this.noteDraft);
    this.selectedCustomer = this.customerService.getById(this.selectedCustomer.id) || this.selectedCustomer;
    this.feedbackMessage = 'Customer note saved.';

    window.setTimeout(() => {
      if (this.feedbackMessage === 'Customer note saved.') this.feedbackMessage = '';
    }, 2500);
  }

  openBookings(customer: AdminCustomer): void {
    void this.router.navigate(['/admin/bookings'], {
      queryParams: { customer: customer.phone }
    });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedType = 'All';
  }

  whatsappLink(phone: string): string {
    return 'https://wa.me/' + phone.replace(/\D/g, '');
  }

  statusClass(status: string): string {
    return status.toLowerCase();
  }
}
