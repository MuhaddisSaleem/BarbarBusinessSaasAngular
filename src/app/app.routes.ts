import { Routes } from '@angular/router';
import { CustomerBookingComponent } from './customer-booking/customer-booking.component';

export const routes: Routes = [
  {
    path: '',
    component: CustomerBookingComponent,
    title: 'Book Appointment'
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    title: 'Admin Dashboard'
  },
  {
    path: 'admin/bookings',
    loadComponent: () =>
      import('./admin/bookings/admin-bookings.component').then(m => m.AdminBookingsComponent),
    title: 'Bookings'
  },
  {
    path: 'admin/calendar',
    loadComponent: () =>
      import('./admin/calendar/admin-calendar.component').then(m => m.AdminCalendarComponent),
    title: 'Schedule'
  },
  {
    path: 'admin/barbers',
    loadComponent: () =>
      import('./admin/barbers/admin-barbers.component').then(m => m.AdminBarbersComponent),
    title: 'Barbers'
  },
  {
    path: 'admin/services',
    loadComponent: () =>
      import('./admin/services/admin-services.component').then(m => m.AdminServicesComponent),
    title: 'Services'
  },
  {
    path: 'admin/customers',
    loadComponent: () =>
      import('./admin/customers/admin-customers.component').then(m => m.AdminCustomersComponent),
    title: 'Customers'
  },
  {
    path: 'admin/reports',
    loadComponent: () =>
      import('./admin/reports/admin-reports.component').then(m => m.AdminReportsComponent),
    title: 'Revenue & Reports'
  },
  {
    path: 'admin/settings',
    loadComponent: () =>
      import('./admin/settings/admin-settings.component').then(m => m.AdminSettingsComponent),
    title: 'Settings'
  },
  {
    path: 'admin/notifications',
    loadComponent: () =>
      import('./admin/notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent),
    title: 'Notifications'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
