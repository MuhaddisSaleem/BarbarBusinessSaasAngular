import { Routes } from '@angular/router';
import { CustomerBookingComponent } from './customer-booking/customer-booking.component';

export const routes: Routes = [
  {
    path: '',
    component: CustomerBookingComponent,
    title: 'Royal Barbers | Book Appointment'
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    title: 'Royal Barbers | Admin Dashboard'
  },
  {
    path: 'admin/bookings',
    loadComponent: () =>
      import('./admin/bookings/admin-bookings.component').then(m => m.AdminBookingsComponent),
    title: 'Royal Barbers | Bookings'
  },
  {
    path: 'admin/calendar',
    loadComponent: () =>
      import('./admin/calendar/admin-calendar.component').then(m => m.AdminCalendarComponent),
    title: 'Royal Barbers | Schedule'
  },
  {
    path: 'admin/barbers',
    loadComponent: () =>
      import('./admin/barbers/admin-barbers.component').then(m => m.AdminBarbersComponent),
    title: 'Royal Barbers | Barbers'
  },
  {
    path: 'admin/services',
    loadComponent: () =>
      import('./admin/services/admin-services.component').then(m => m.AdminServicesComponent),
    title: 'Royal Barbers | Services'
  },
  {
    path: 'admin/customers',
    loadComponent: () =>
      import('./admin/customers/admin-customers.component').then(m => m.AdminCustomersComponent),
    title: 'Royal Barbers | Customers'
  },
  {
    path: 'admin/notifications',
    loadComponent: () =>
      import('./admin/notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent),
    title: 'Royal Barbers | Notifications'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
