import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';

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
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss'
})
export class GalleryComponent {
  readonly categories: GalleryCategory[] = ['All', 'Interior', 'Chairs', 'Products', 'Tools', 'Atmosphere'];
  activeCategory: GalleryCategory = 'All';
  activeIndex = 0;
  lightboxOpen = false;

  readonly items: GalleryItem[] = [
    { src: 'https://images.pexels.com/photos/19664876/pexels-photo-19664876.jpeg?auto=compress&cs=tinysrgb&w=1600', alt: 'Premium barbershop interior', title: 'The Main Floor', category: 'Interior', position: 'center 52%' },
    { src: 'assets/images/services/haircut.webp', alt: 'Premium barber service at The Trim Town', title: 'The Signature Chair', category: 'Chairs', position: 'center' },
    { src: 'assets/images/services/beard-trim.webp', alt: 'Professional barber tools at The Trim Town', title: 'Tools of the Craft', category: 'Tools', position: 'center' },
    { src: 'assets/images/services/hair-beard-massage.webp', alt: 'The Trim Town grooming atmosphere', title: 'Details That Define Us', category: 'Atmosphere', position: 'center' },
    { src: 'assets/images/services/hair-color.webp', alt: 'Premium grooming products and service', title: 'Premium Products', category: 'Products', position: 'center' }
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
