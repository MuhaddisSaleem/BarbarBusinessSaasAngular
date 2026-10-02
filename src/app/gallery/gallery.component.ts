import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';

interface GalleryImage {
  src: string;
  alt: string;
  className: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss'
})
export class GalleryComponent {
  selectedIndex: number | null = null;

  readonly images: GalleryImage[] = [
    { src: 'assets/images/gallery/gallery1.jpg', alt: 'The Trim Town studio interior', className: 'tile-1' },
    { src: 'assets/images/gallery/gallery2.jpg', alt: 'The Trim Town interior detail', className: 'tile-2' },
    { src: 'assets/images/gallery/gallery3.jpg', alt: 'The Trim Town grooming area', className: 'tile-3' },
    { src: 'assets/images/gallery/gallery4.jpg', alt: 'The Trim Town studio atmosphere', className: 'tile-4' },
    { src: 'assets/images/gallery/gallery5.jpg', alt: 'The Trim Town premium interior', className: 'tile-5' },
    { src: 'assets/images/gallery/gallery6.jpg', alt: 'The Trim Town barber station', className: 'tile-6' },
    { src: 'assets/images/gallery/gallery7.jpg', alt: 'The Trim Town studio details', className: 'tile-7' },
    { src: 'assets/images/gallery/gallery8.jpg', alt: 'The Trim Town grooming experience', className: 'tile-8' },
    { src: 'assets/images/gallery/gallery9.jpg', alt: 'The Trim Town interior view', className: 'tile-9' },
    { src: 'assets/images/gallery/gallery10.jpg', alt: 'The Trim Town salon space', className: 'tile-10' }
  ];

  get selectedImage(): GalleryImage | null {
    return this.selectedIndex === null ? null : this.images[this.selectedIndex];
  }

  openImage(index: number): void {
    this.selectedIndex = index;
    document.body.style.overflow = 'hidden';
  }

  closeImage(): void {
    this.selectedIndex = null;
    document.body.style.overflow = '';
  }

  previousImage(): void {
    if (this.selectedIndex === null) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.images.length) % this.images.length;
  }

  nextImage(): void {
    if (this.selectedIndex === null) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.images.length;
  }

  trackBySrc(_index: number, item: GalleryImage): string {
    return item.src;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.selectedIndex === null) return;

    if (event.key === 'Escape') this.closeImage();
    if (event.key === 'ArrowLeft') this.previousImage();
    if (event.key === 'ArrowRight') this.nextImage();
  }
}
