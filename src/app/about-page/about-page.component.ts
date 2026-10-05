import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { AboutComponent } from '../about/about.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [HeaderComponent, AboutComponent, FooterComponent],
  template: `
    <app-header></app-header>
    <main>
      <app-about></app-about>
    </main>
    <app-footer></app-footer>
  `
})
export class AboutPageComponent {}
