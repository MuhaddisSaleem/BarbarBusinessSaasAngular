import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';

type GalleryCategory = 'All' | 'Interior' | 'Chairs' | 'Products' | 'Tools' | 'Atmosphere';

interface GalleryItem {
  src: string;
  alt: string;
  title: string;
  category: Exclude<GalleryCategory, 'All'>;
  position?: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss'
})
export class GalleryComponent {
  readonly categories: GalleryCategory[] = ['All', 'Interior', 'Chairs', 'Products', 'Tools', 'Atmosphere'];
  activeCategory: GalleryCategory = 'All';
  activeIndex = 0;
  lightboxOpen = false;

  readonly items: GalleryItem[] = [
    { src: 'assets/images/gallery/gallery-13.webp', alt: 'Wide view of The Trim Town barber shop floor', title: 'The Main Floor', category: 'Interior', position: 'center 55%' },
    { src: 'assets/images/gallery/gallery-02.webp', alt: 'Premium black and gold barber chair inside The Trim Town', title: 'The Signature Chair', category: 'Chairs' },
    { src: 'assets/images/gallery/gallery-11.webp', alt: 'Professional barber scissors displayed at The Trim Town', title: 'Tools of the Craft', category: 'Tools' },
    { src: 'assets/images/gallery/gallery-01.webp', alt: 'Dark sculptural wall art inside The Trim Town', title: 'Art & Character', category: 'Atmosphere' },
    { src: 'assets/images/gallery/gallery-08.webp', alt: 'Professional grooming products displayed on a shelf', title: 'Professional Care', category: 'Products' },
    { src: 'assets/images/gallery/gallery-03.webp', alt: 'Close view of a tufted barber chair', title: 'Crafted Comfort', category: 'Chairs' },
    { src: 'assets/images/gallery/gallery-07.webp', alt: 'Barber stations and mirrors inside The Trim Town', title: 'Barber Stations', category: 'Interior' },
    { src: 'assets/images/gallery/gallery-12.webp', alt: 'Blindfolded classical portrait wall art', title: 'The Trim Town Aesthetic', category: 'Atmosphere' },
    { src: 'assets/images/gallery/gallery-06.webp', alt: 'Hair color and salon supplies arranged on shelving', title: 'Color Collection', category: 'Products' },
    { src: 'assets/images/gallery/gallery-09.webp', alt: 'Hair treatment products under warm salon lighting', title: 'Premium Treatments', category: 'Products' },
    { src: 'assets/images/gallery/gallery-10.webp', alt: 'Hair care products arranged against the brick interior', title: 'Hair Care Range', category: 'Products' },
    { src: 'assets/images/gallery/gallery-05.webp', alt: 'Professional hair styling products held in display hands', title: 'Styling Essentials', category: 'Products' },
    { src: 'assets/images/gallery/gallery-04.webp', alt: 'Professional facial and grooming equipment', title: 'Grooming Technology', category: 'Tools' },
    { src: 'assets/images/gallery/gallery-14.webp', alt: 'Decorative shelving and plants inside The Trim Town', title: 'Thoughtful Details', category: 'Interior' },
    { src: 'assets/images/gallery/gallery-15.webp', alt: 'Warm private grooming area inside The Trim Town', title: 'Private Grooming', category: 'Atmosphere' },
    { src: 'assets/images/gallery/gallery-16.webp', alt: 'Waiting and grooming chairs inside the shop', title: 'Classic Lounge', category: 'Interior' },
    { src: 'assets/images/gallery/gallery-17.webp', alt: 'Reception decor and shelving at The Trim Town', title: 'Welcome In', category: 'Interior' },
    { src: 'assets/images/gallery/gallery-18.webp', alt: 'Warm brick interior and seating area', title: 'Warm Atmosphere', category: 'Interior' },
    { src: 'assets/images/gallery/gallery-19.webp', alt: 'Private treatment beds beneath warm pendant lights', title: 'Treatment Space', category: 'Atmosphere' },
    { src: 'assets/images/gallery/gallery-20.webp', alt: 'Premium seating and brick wall interior', title: 'Relax & Refresh', category: 'Interior' }
  ];

  get filteredItems(): GalleryItem[] {
    if (this.activeCategory === 'All') return this.items;
    return this.items.filter(item => item.category === this.activeCategory);
  }

  get activeItem(): GalleryItem | null {
    return this.filteredItems[this.activeIndex] ?? null;
  }

  selectCategory(category: GalleryCategory): void {
    if (this.activeCategory === category) return;
    this.activeCategory = category;
    this.activeIndex = 0;
    this.lightboxOpen = false;
  }

  selectSlide(index: number): void {
    if (index === this.activeIndex) {
      this.openLightbox();
      return;
    }
    this.activeIndex = index;
  }

  next(): void {
    const total = this.filteredItems.length;
    if (!total) return;
    this.activeIndex = (this.activeIndex + 1) % total;
  }

  previous(): void {
    const total = this.filteredItems.length;
    if (!total) return;
    this.activeIndex = (this.activeIndex - 1 + total) % total;
  }

  openLightbox(): void {
    if (!this.activeItem) return;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  cardClass(index: number): string {
    const total = this.filteredItems.length;
    if (!total) return 'is-hidden';

    let offset = index - this.activeIndex;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;

    switch (offset) {
      case 0: return 'is-active';
      case -1: return 'is-prev';
      case 1: return 'is-next';
      case -2: return 'is-prev-far';
      case 2: return 'is-next-far';
      default: return 'is-hidden';
    }
  }

  formatCount(value: number): string {
    return String(value).padStart(2, '0');
  }

  trackBySrc(_index: number, item: GalleryItem): string {
    return item.src;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.lightboxOpen && event.key === 'Escape') {
      this.closeLightbox();
      return;
    }

    if (event.key === 'ArrowRight') this.next();
    if (event.key === 'ArrowLeft') this.previous();
  }
}
