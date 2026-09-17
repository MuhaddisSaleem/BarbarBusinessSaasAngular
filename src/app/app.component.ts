import { Component } from '@angular/core';
import { BookingComponent } from './booking/booking.component';
import { HeroComponent } from './hero/hero.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeroComponent, BookingComponent],
  template: `
    <app-hero></app-hero>
    <div id="booking">
      <app-booking></app-booking>
    </div>
  `
})
export class AppComponent {}
