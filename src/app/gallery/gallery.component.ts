import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';

type GalleryCategory = 'All' | 'Interior' | 'Chairs' | 'Products' | 'Tools' | 'Atmosphere';

interface GalleryItem {
  strip: string;
  frame: number;
  alt: string;
  title: string;
  category: Exclude<GalleryCategory, 'All'>;
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
    this.photo(13, 'Wide view of The Trim Town barber shop floor', 'The Main Floor', 'Interior'),
    this.photo(2, 'Premium black and gold barber chair inside The Trim Town', 'The Signature Chair', 'Chairs'),
    this.photo(11, 'Professional barber scissors displayed at The Trim Town', 'Tools of the Craft', 'Tools'),
    this.photo(1, 'Dark sculptural wall art inside The Trim Town', 'Art & Character', 'Atmosphere'),
    this.photo(8, 'Professional grooming products displayed on a shelf', 'Professional Care', 'Products'),
    this.photo(3, 'Close view of a tufted barber chair', 'Crafted Comfort', 'Chairs'),
    this.photo(7, 'Barber stations and mirrors inside The Trim Town', 'Barber Stations', 'Interior'),
    this.photo(12, 'Blindfolded classical portrait wall art', 'The Trim Town Aesthetic', 'Atmosphere'),
    this.photo(6, 'Hair color and salon supplies arranged on shelving', 'Color Collection', 'Products'),
    this.photo(9, 'Hair treatment products under warm salon lighting', 'Premium Treatments', 'Products'),
    this.photo(10, 'Hair care products arranged against the brick interior', 'Hair Care Range', 'Products'),
    this.photo(5, 'Professional hair styling products held in display hands', 'Styling Essentials', 'Products'),
    this.photo(4, 'Professional facial and grooming equipment', 'Grooming Technology', 'Tools'),
    this.photo(14, 'Decorative shelving and plants inside The Trim Town', 'Thoughtful Details', 'Interior'),
    this.photo(15, 'Warm private grooming area inside The Trim Town', 'Private Grooming', 'Atmosphere'),
    this.photo(16, 'Waiting and grooming chairs inside the shop', 'Classic Lounge', 'Interior'),
    this.photo(17, 'Reception decor and shelving at The Trim Town', 'Welcome In', 'Interior'),
    this.photo(18, 'Warm brick interior and seating area', 'Warm Atmosphere', 'Interior'),
    this.photo(19, 'Private treatment beds beneath warm pendant lights', 'Treatment Space', 'Atmosphere'),
    this.photo(20, 'Premium seating and brick wall interior', 'Relax & Refresh', 'Interior')
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

  photoStyle(item: GalleryItem): Record<string, string> {
    return {
      'background-image': `url("${item.strip}")`,
      'background-size': '500% auto',
      'background-position': `${item.frame * 25}% center`,
      'background-repeat': 'no-repeat'
    };
  }

  formatCount(value: number): string {
    return String(value).padStart(2, '0');
  }

  trackByItem(_index: number, item: GalleryItem): string {
    return `${item.strip}-${item.frame}`;
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

  private photo(
    sourceNumber: number,
    alt: string,
    title: string,
    category: Exclude<GalleryCategory, 'All'>
  ): GalleryItem {
    const stripNumber = Math.floor((sourceNumber - 1) / 5) + 1;
    const frame = (sourceNumber - 1) % 5;

    return {
      strip: `assets/images/gallery/gallery-strip-${stripNumber}.webp`,
      frame,
      alt,
      title,
      category
    };
  }
}
