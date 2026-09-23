import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './admin/admin-dashboard.component';
import { CustomerBookingComponent } from './customer-booking/customer-booking.component';
import { AdminNotificationsComponent } from './admin/notifications/admin-notifications.component';
import { AdminBookingsComponent } from './admin/bookings/admin-bookings.component';
import { AdminCalendarComponent } from './admin/calendar/admin-calendar.component';
import { AdminBarbersComponent } from './admin/barbers/admin-barbers.component';
import { AdminServicesComponent } from './admin/services/admin-services.component';
import { AdminCustomersComponent } from './admin/customers/admin-customers.component';

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
    path: 'admin/calendar',
    component: AdminCalendarComponent,
    title: 'Royal Barbers | Schedule'
  },
  {
    path: 'admin/barbers',
    component: AdminBarbersComponent,
    title: 'Royal Barbers | Barbers'
  },
  {
    path: 'admin/services',
    component: AdminServicesComponent,
    title: 'Royal Barbers | Services'
  },
  {
    path: 'admin/customers',
    component: AdminCustomersComponent,
    title: 'Royal Barbers | Customers'
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
