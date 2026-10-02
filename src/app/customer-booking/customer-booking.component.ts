import { Component } from '@angular/core';
import { BookingComponent } from '../booking/booking.component';
import { HeaderComponent } from '../header/header.component';
import { HeroComponent } from '../hero/hero.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-customer-booking',
  standalone: true,
  imports: [HeaderComponent, HeroComponent, BookingComponent, FooterComponent],
  template: `
    <app-header></app-header>
    <app-hero></app-hero>
    <div id="booking">
      <app-booking></app-booking>
    </div>
    <app-footer></app-footer>
  `
})
export class CustomerBookingComponent {}
