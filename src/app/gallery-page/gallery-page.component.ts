import { Component } from '@angular/core';
import { GalleryComponent } from '../gallery/gallery.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-gallery-page',
  standalone: true,
  imports: [HeaderComponent, GalleryComponent],
  template: `
    <app-header></app-header>
    <main>
      <app-gallery></app-gallery>
    </main>
  `
})
export class GalleryPageComponent {}
