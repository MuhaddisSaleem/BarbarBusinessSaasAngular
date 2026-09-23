import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminShellComponent } from '../shared/admin-shell.component';
import { AdminService, AdminServiceService, ServiceStatus } from './admin-service.service';

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminShellComponent],
  templateUrl: './admin-services.component.html',
  styleUrl: './admin-services.component.scss'
})
export class AdminServicesComponent {
  searchTerm = '';
  selectedStatus: 'All' | ServiceStatus = 'All';

  addModalOpen = false;
  editModalOpen = false;
  deleteModalOpen = false;

  editCandidate: AdminService | null = null;
  deleteCandidate: AdminService | null = null;

  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  newService = this.emptyServiceForm();
  editService = this.emptyServiceForm();

  constructor(public readonly serviceService: AdminServiceService) {}

  get filteredServices(): AdminService[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.serviceService.all
      .filter(item => this.selectedStatus === 'All' || item.status === this.selectedStatus)
      .filter(item => !term || item.name.toLowerCase().includes(term));
  }

  get inactiveCount(): number {
    return this.serviceService.all.filter(item => item.status === 'Inactive').length;
  }

  openAddModal(): void {
    this.newService = this.emptyServiceForm();
    this.addModalOpen = true;
    this.feedbackMessage = '';
  }

  closeAddModal(): void {
    this.addModalOpen = false;
  }

  openEditModal(service: AdminService): void {
    this.editCandidate = service;
    this.editService = {
      name: service.name,
      duration: String(service.duration),
      originalPrice: String(service.originalPrice),
      hasDiscount: this.serviceService.hasDiscount(service),
      discountPrice: service.discountPrice === null ? '' : String(service.discountPrice),
      image: service.image,
      status: service.status
    };
    this.editModalOpen = true;
    this.feedbackMessage = '';
  }

  closeEditModal(): void {
    this.editModalOpen = false;
    this.editCandidate = null;
  }

  requestDelete(service: AdminService): void {
    this.deleteCandidate = service;
    this.deleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.deleteCandidate = null;
  }

  addService(): void {
    const payload = this.buildPayload(this.newService);
    const result = this.serviceService.addService(payload);

    this.showFeedback(result.success, result.message);
    if (result.success) this.closeAddModal();
  }

  saveService(): void {
    if (!this.editCandidate) return;

    const payload = this.buildPayload(this.editService);
    const result = this.serviceService.updateService(this.editCandidate.id, payload);

    this.showFeedback(result.success, result.message);
    if (result.success) this.closeEditModal();
  }

  confirmDelete(): void {
    if (!this.deleteCandidate) return;

    const result = this.serviceService.deleteService(this.deleteCandidate.id);
    this.showFeedback(result.success, result.message);

    if (result.success) this.closeDeleteModal();
  }

  toggleStatus(service: AdminService): void {
    const result = this.serviceService.toggleStatus(service.id);
    this.showFeedback(result.success, result.message);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'All';
  }

  async onImageSelected(event: Event, target: 'add' | 'edit'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showFeedback(false, 'Please select a valid image file.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showFeedback(false, 'Service image must be smaller than 5 MB.');
      input.value = '';
      return;
    }

    try {
      const dataUrl = await this.compressImage(file);

      if (target === 'add') {
        this.newService.image = dataUrl;
      } else {
        this.editService.image = dataUrl;
      }
    } catch {
      this.showFeedback(false, 'Could not process this image. Please try another image.');
      input.value = '';
    }
  }

  priceAfterDiscount(service: AdminService): number {
    return this.serviceService.effectivePrice(service);
  }

  discountPercent(service: AdminService): number {
    return this.serviceService.discountPercent(service);
  }

  private buildPayload(form: ReturnType<AdminServicesComponent['emptyServiceForm']>) {
    return {
      name: form.name,
      duration: Number(form.duration),
      originalPrice: Number(form.originalPrice),
      discountPrice: form.hasDiscount && form.discountPrice ? Number(form.discountPrice) : null,
      image: form.image,
      status: form.status
    };
  }

  private emptyServiceForm() {
    return {
      name: '',
      duration: '',
      originalPrice: '',
      hasDiscount: false,
      discountPrice: '',
      image: '',
      status: 'Active' as ServiceStatus
    };
  }

  private compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          const maxWidth = 1000;
          const maxHeight = 750;
          const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);

          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Canvas is not available.'));
            return;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };

        image.onerror = () => reject(new Error('Invalid image.'));
        image.src = String(reader.result || '');
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private showFeedback(success: boolean, message: string): void {
    this.feedbackType = success ? 'success' : 'error';
    this.feedbackMessage = message;

    window.setTimeout(() => {
      if (this.feedbackMessage === message) this.feedbackMessage = '';
    }, 3500);
  }
}
