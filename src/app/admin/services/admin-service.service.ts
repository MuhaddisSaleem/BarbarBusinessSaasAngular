import { Injectable } from '@angular/core';

export type ServiceStatus = 'Active' | 'Inactive';

export interface AdminService {
  id: number;
  name: string;
  duration: number;
  originalPrice: number;
  discountPrice: number | null;
  image: string;
  status: ServiceStatus;
}

export interface ServiceMutationResult {
  success: boolean;
  message: string;
}

const DEFAULT_SERVICES: AdminService[] = [
  { id: 1, name: 'Haircut', duration: 30, originalPrice: 700, discountPrice: null, image: 'assets/images/services/haircut.webp', status: 'Active' },
  { id: 2, name: 'Beard Trim', duration: 20, originalPrice: 400, discountPrice: null, image: 'assets/images/services/beard-trim.webp', status: 'Active' },
  { id: 3, name: 'Hair + Beard + Free Hair Massage', duration: 45, originalPrice: 1000, discountPrice: null, image: 'assets/images/services/hair-beard-massage.webp', status: 'Active' },
  { id: 4, name: 'Kids Haircut', duration: 30, originalPrice: 600, discountPrice: null, image: 'assets/images/services/kids-haircut.webp', status: 'Active' },
  { id: 5, name: 'Hair Wash', duration: 15, originalPrice: 300, discountPrice: null, image: 'assets/images/services/hair-wash.webp', status: 'Active' },
  { id: 6, name: 'Hair Coloring', duration: 60, originalPrice: 2000, discountPrice: null, image: 'assets/images/services/hair-color.webp', status: 'Active' },
  { id: 7, name: '6 Step Face Massage', duration: 60, originalPrice: 5000, discountPrice: null, image: 'assets/images/services/face-massage.webp', status: 'Active' }
];

@Injectable({ providedIn: 'root' })
export class AdminServiceService {
  private readonly storageKey = 'royal-barbers.admin-services.v1';
  private services: AdminService[] = this.loadServices();

  get all(): AdminService[] {
    return this.services;
  }

  get active(): AdminService[] {
    return this.services.filter(item => item.status === 'Active');
  }

  get discounted(): AdminService[] {
    return this.services.filter(item => this.hasDiscount(item));
  }

  getById(id: number): AdminService | undefined {
    return this.services.find(item => item.id === id);
  }

  effectivePrice(service: AdminService): number {
    return this.hasDiscount(service) ? Number(service.discountPrice) : service.originalPrice;
  }

  hasDiscount(service: AdminService): boolean {
    return service.discountPrice !== null
      && service.discountPrice > 0
      && service.discountPrice < service.originalPrice;
  }

  discountPercent(service: AdminService): number {
    if (!this.hasDiscount(service)) return 0;
    return Math.round(((service.originalPrice - Number(service.discountPrice)) / service.originalPrice) * 100);
  }

  addService(input: Omit<AdminService, 'id'>): ServiceMutationResult {
    const validation = this.validateService(input);
    if (!validation.success) return validation;

    if (this.services.some(item => item.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
      return { success: false, message: 'A service with this name already exists.' };
    }

    const nextId = this.services.length ? Math.max(...this.services.map(item => item.id)) + 1 : 1;
    const next: AdminService = {
      ...input,
      id: nextId,
      name: input.name.trim(),
      originalPrice: Number(input.originalPrice),
      discountPrice: input.discountPrice ? Number(input.discountPrice) : null,
      duration: Number(input.duration)
    };

    this.services = [...this.services, next];

    if (!this.persist()) {
      this.services = this.services.filter(item => item.id !== nextId);
      return { success: false, message: 'Could not save this service locally. Try a smaller image.' };
    }

    return { success: true, message: next.name + ' added successfully.' };
  }

  updateService(id: number, changes: Omit<AdminService, 'id'>): ServiceMutationResult {
    const service = this.getById(id);
    if (!service) return { success: false, message: 'Service not found.' };

    const validation = this.validateService(changes);
    if (!validation.success) return validation;

    if (
      this.services.some(
        item => item.id !== id && item.name.trim().toLowerCase() === changes.name.trim().toLowerCase()
      )
    ) {
      return { success: false, message: 'Another service already uses this name.' };
    }

    const previous = { ...service };
    service.name = changes.name.trim();
    service.duration = Number(changes.duration);
    service.originalPrice = Number(changes.originalPrice);
    service.discountPrice = changes.discountPrice ? Number(changes.discountPrice) : null;
    service.image = changes.image;
    service.status = changes.status;

    if (!this.persist()) {
      Object.assign(service, previous);
      return { success: false, message: 'Could not save the service changes.' };
    }

    return { success: true, message: service.name + ' updated successfully.' };
  }

  toggleStatus(id: number): ServiceMutationResult {
    const service = this.getById(id);
    if (!service) return { success: false, message: 'Service not found.' };

    const previous = service.status;
    service.status = service.status === 'Active' ? 'Inactive' : 'Active';

    if (!this.persist()) {
      service.status = previous;
      return { success: false, message: 'Could not save the service status.' };
    }

    return {
      success: true,
      message: service.name + ' is now ' + service.status.toLowerCase() + '.'
    };
  }

  deleteService(id: number): ServiceMutationResult {
    const service = this.getById(id);
    if (!service) return { success: false, message: 'Service not found.' };

    const previous = [...this.services];
    this.services = this.services.filter(item => item.id !== id);

    if (!this.persist()) {
      this.services = previous;
      return { success: false, message: 'Could not delete this service.' };
    }

    return { success: true, message: service.name + ' deleted successfully.' };
  }

  private validateService(input: Omit<AdminService, 'id'>): ServiceMutationResult {
    if (!input.name.trim()) return { success: false, message: 'Service name is required.' };
    if (!input.image) return { success: false, message: 'Service image is required.' };

    const duration = Number(input.duration);
    const originalPrice = Number(input.originalPrice);
    const discountPrice = input.discountPrice === null ? null : Number(input.discountPrice);

    if (!Number.isFinite(duration) || duration <= 0) {
      return { success: false, message: 'Enter a valid service duration.' };
    }

    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      return { success: false, message: 'Enter a valid original amount.' };
    }

    if (
      discountPrice !== null
      && (!Number.isFinite(discountPrice) || discountPrice <= 0 || discountPrice >= originalPrice)
    ) {
      return { success: false, message: 'Discount amount must be greater than 0 and lower than the original amount.' };
    }

    return { success: true, message: '' };
  }

  private loadServices(): AdminService[] {
    if (typeof window === 'undefined') {
      return DEFAULT_SERVICES.map(item => ({ ...item }));
    }

    try {
      const saved = window.localStorage.getItem(this.storageKey);
      if (!saved) return DEFAULT_SERVICES.map(item => ({ ...item }));

      const parsed = JSON.parse(saved) as AdminService[];
      if (!Array.isArray(parsed)) return DEFAULT_SERVICES.map(item => ({ ...item }));

      return parsed.map(item => ({
        ...item,
        duration: Number(item.duration),
        originalPrice: Number(item.originalPrice),
        discountPrice: item.discountPrice === null ? null : Number(item.discountPrice),
        image: item.image || 'assets/images/service-placeholder.svg',
        status: item.status || 'Active'
      }));
    } catch {
      return DEFAULT_SERVICES.map(item => ({ ...item }));
    }
  }

  private persist(): boolean {
    if (typeof window === 'undefined') return true;

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.services));
      return true;
    } catch {
      return false;
    }
  }
}
