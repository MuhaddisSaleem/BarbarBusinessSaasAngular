import { Component } from '@angular/core';
import { BookingComponent } from './booking/booking.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BookingComponent],
  template: '<app-booking></app-booking>'
})
export class AppComponent {}
