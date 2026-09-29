import { APP_INITIALIZER } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AdminBookingService } from './app/admin/bookings/admin-booking.service';

function initializeBookings(bookingService: AdminBookingService) {
  return () => bookingService.initialize();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBookings,
      deps: [AdminBookingService],
      multi: true
    }
  ]
})
  .catch(err => console.error(err));
