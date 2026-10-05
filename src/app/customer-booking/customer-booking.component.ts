import { Component } from '@angular/core';
import { BookingComponent } from '../booking/booking.component';
import { HeaderComponent } from '../header/header.component';
import { HeroComponent } from '../hero/hero.component';
import { FooterComponent } from '../footer/footer.component';
import { AboutComponent } from '../about/about.component';

@Component({
  selector: 'app-customer-booking',
  standalone: true,
  imports: [HeaderComponent, HeroComponent, AboutComponent, BookingComponent, FooterComponent],
  template: `
    <app-header></app-header>
    <app-hero></app-hero>
    <app-about></app-about>
    <div id="booking">
      <app-booking></app-booking>
    </div>
    <app-footer></app-footer>
  `
})
export class CustomerBookingComponent {}
