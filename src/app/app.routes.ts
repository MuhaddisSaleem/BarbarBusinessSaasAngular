import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin/admin-dashboard.component';
import { CustomerBookingComponent } from './customer-booking/customer-booking.component';
import { AdminNotificationsComponent } from './admin/notifications/admin-notifications.component';
import { AdminBookingsComponent } from './admin/bookings/admin-bookings.component';

export const routes: Routes = [
  {
    path: '',
    component: CustomerBookingComponent,
    title: 'Royal Barbers | Book Appointment'
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    title: 'Royal Barbers | Admin Dashboard'
  },
  {
    path: 'admin/bookings',
    component: AdminBookingsComponent,
    title: 'Royal Barbers | Bookings'
  },
  {
    path: 'admin/notifications',
    component: AdminNotificationsComponent,
    title: 'Royal Barbers | Notifications'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
