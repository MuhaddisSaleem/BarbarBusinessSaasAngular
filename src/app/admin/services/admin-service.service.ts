import { Injectable } from '@angular/core';
import { NotificationService } from '../notifications/notification.service';

export type ServiceStatus = 'Active' | 'Inactive';

export interface AdminService {
  id: number;
  name: string;
  duration: number;
  originalPrice: number;
  discountPrice: number | null;
  homeServiceEnabled: boolean;
  homeOriginalPrice: number | null;
  homeDiscountPrice: number | null;
  image: string;
  status: ServiceStatus;
}

export interface ServiceMutationResult {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AdminServiceService {
  constructor(private readonly notificationService: NotificationService) {}

  private readonly storageKey = 'royal-barbers.admin-services.v1';
  private readonly demoCleanupKey = 'royal-barbers.admin-services.demo-cleaned.v1';
  private services: AdminService[] = this.loadServices();

  get all(): AdminService[] {
    return this.services;
  }

  get active(): AdminService[] {
    return this.services.filter(item => item.status === 'Active');
  }

  get discounted(): AdminService[] {
    return this.services.filter(item => this.hasDiscount(item) || this.hasHomeDiscount(item));
  }

  get homeActive(): AdminService[] {
    return this.active.filter(item => item.homeServiceEnabled && Number(item.homeOriginalPrice) > 0);
  }

  getById(id: number): AdminService | undefined {
    return this.services.find(item => item.id === id);
  }

  effectivePrice(service: AdminService): number {
    return this.hasDiscount(service) ? Number(service.discountPrice) : service.originalPrice;
  }

  effectiveHomePrice(service: AdminService): number {
    if (!service.homeServiceEnabled || !service.homeOriginalPrice) return 0;
    return this.hasHomeDiscount(service) ? Number(service.homeDiscountPrice) : Number(service.homeOriginalPrice);
  }

  hasHomeDiscount(service: AdminService): boolean {
    return service.homeServiceEnabled
      && service.homeOriginalPrice !== null
      && service.homeDiscountPrice !== null
      && service.homeDiscountPrice > 0
      && service.homeDiscountPrice < service.homeOriginalPrice;
  }

  homeDiscountPercent(service: AdminService): number {
    if (!this.hasHomeDiscount(service) || !service.homeOriginalPrice) return 0;
    return Math.round(((service.homeOriginalPrice - Number(service.homeDiscountPrice)) / service.homeOriginalPrice) * 100);
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
      homeServiceEnabled: input.homeServiceEnabled !== false,
      homeOriginalPrice: input.homeServiceEnabled ? Number(input.homeOriginalPrice) : null,
      homeDiscountPrice: input.homeServiceEnabled && input.homeDiscountPrice ? Number(input.homeDiscountPrice) : null,
      duration: Number(input.duration)
    };

    this.services = [...this.services, next];

    if (!this.persist()) {
      this.services = this.services.filter(item => item.id !== nextId);
      return { success: false, message: 'Could not save this service locally. Try a smaller image.' };
    }

    this.notificationService.add({
      type: 'system',
      title: 'Service added',
      message: next.name + ' was added at Rs. ' + this.effectivePrice(next).toLocaleString('en-US') + '.',
      icon: 'bi-scissors',
      url: '/admin/services'
    });

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
    service.homeServiceEnabled = changes.homeServiceEnabled !== false;
    service.homeOriginalPrice = service.homeServiceEnabled ? Number(changes.homeOriginalPrice) : null;
    service.homeDiscountPrice = service.homeServiceEnabled && changes.homeDiscountPrice ? Number(changes.homeDiscountPrice) : null;
    service.image = changes.image;
    service.status = changes.status;

    if (!this.persist()) {
      Object.assign(service, previous);
      return { success: false, message: 'Could not save the service changes.' };
    }

    this.notificationService.add({
      type: 'system',
      title: 'Service updated',
      message: service.name + ' details or pricing were updated.',
      icon: 'bi-pencil-square',
      url: '/admin/services'
    });

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

    this.notificationService.add({
      type: 'system',
      title: 'Service ' + (service.status === 'Active' ? 'activated' : 'hidden'),
      message: service.name + ' is now ' + service.status.toLowerCase() + '.',
      icon: service.status === 'Active' ? 'bi-eye' : 'bi-eye-slash',
      url: '/admin/services'
    });

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

    this.notificationService.add({
      type: 'system',
      title: 'Service deleted',
      message: service.name + ' was removed from the service list.',
      icon: 'bi-trash3',
      url: '/admin/services'
    });

    return { success: true, message: service.name + ' deleted successfully.' };
  }

  private validateService(input: Omit<AdminService, 'id'>): ServiceMutationResult {
    if (!input.name.trim()) return { success: false, message: 'Service name is required.' };
    if (!input.image) return { success: false, message: 'Service image is required.' };

    const duration = Number(input.duration);
    const originalPrice = Number(input.originalPrice);
    const discountPrice = input.discountPrice === null ? null : Number(input.discountPrice);
    const homeOriginalPrice = input.homeOriginalPrice === null ? null : Number(input.homeOriginalPrice);
    const homeDiscountPrice = input.homeDiscountPrice === null ? null : Number(input.homeDiscountPrice);

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

    if (input.homeServiceEnabled) {
      if (!Number.isFinite(homeOriginalPrice) || Number(homeOriginalPrice) <= 0) {
        return { success: false, message: 'Enter a valid home service amount.' };
      }

      if (
        homeDiscountPrice !== null
        && (!Number.isFinite(homeDiscountPrice) || homeDiscountPrice <= 0 || homeDiscountPrice >= Number(homeOriginalPrice))
      ) {
        return { success: false, message: 'Home discount amount must be greater than 0 and lower than the home service amount.' };
      }
    }

    return { success: true, message: '' };
  }

  private loadServices(): AdminService[] {
    if (typeof window === 'undefined') return [];

    try {
      const saved = window.localStorage.getItem(this.storageKey);
      if (!saved) {
        window.localStorage.setItem(this.demoCleanupKey, '1');
        return [];
      }

      const parsed = JSON.parse(saved) as AdminService[];
      if (!Array.isArray(parsed)) return [];

      const needsCleanup = window.localStorage.getItem(this.demoCleanupKey) !== '1';
      const demoServices = new Set([
        '1|Haircut',
        '2|Beard Trim',
        '3|Hair + Beard + Free Hair Massage',
        '4|Kids Haircut',
        '5|Hair Wash',
        '6|Hair Coloring',
        '7|6 Step Face Massage'
      ]);

      const cleaned = parsed
        .filter(item =>
          !needsCleanup
          || !demoServices.has(String(item.id) + '|' + String(item.name || ''))
        )
        .map(item => ({
          ...item,
          duration: Number(item.duration),
          originalPrice: Number(item.originalPrice),
          discountPrice: item.discountPrice === null ? null : Number(item.discountPrice),
          homeServiceEnabled: item.homeServiceEnabled !== false,
          homeOriginalPrice: item.homeOriginalPrice === undefined || item.homeOriginalPrice === null
            ? Number(item.originalPrice)
            : Number(item.homeOriginalPrice),
          homeDiscountPrice: item.homeDiscountPrice === undefined || item.homeDiscountPrice === null
            ? null
            : Number(item.homeDiscountPrice),
          image: item.image || 'assets/images/service-placeholder.svg',
          status: item.status || 'Active'
        }));

      if (needsCleanup) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(cleaned));
        window.localStorage.setItem(this.demoCleanupKey, '1');
      }

      return cleaned;
    } catch {
      return [];
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
