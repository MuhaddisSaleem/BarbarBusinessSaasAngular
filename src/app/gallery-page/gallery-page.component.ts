import { Component } from '@angular/core';
import { GalleryComponent } from '../gallery/gallery.component';
import { HeaderComponent } from '../header/header.component';
import { StudioPictureGalleryComponent } from '../studio-picture-gallery/studio-picture-gallery.component';

@Component({
  selector: 'app-gallery-page',
  standalone: true,
  imports: [HeaderComponent, GalleryComponent, StudioPictureGalleryComponent],
  template: `
    <app-header></app-header>
    <main>
      <app-gallery></app-gallery>
      <!-- <app-studio-picture-gallery></app-studio-picture-gallery> -->
    </main>
  `
})
export class GalleryPageComponent {}
