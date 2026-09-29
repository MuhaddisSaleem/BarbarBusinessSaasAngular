import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminBooking, AdminBookingService, WalkInSlot } from './admin-booking.service';

@Component({
  selector: 'app-walk-in-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './walk-in-booking.component.html',
  styleUrl: './walk-in-booking.component.scss'
})
export class WalkInBookingComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<AdminBooking>();
  customerName = '';
  phone = '';
  notes = '';
  serviceIds: number[] = [];
  slots: WalkInSlot[] = [];
  selectedSlot: WalkInSlot | null = null;
  error = '';
  saving = false;

  constructor(public readonly bookingService: AdminBookingService) {}

  ngOnInit(): void { this.refresh(); }
  get summary() { return this.bookingService.walkInSummary(this.serviceIds); }
  get todayLabel(): string {
    return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  @HostListener('window:storage', ['$event'])
  onStorage(event: StorageEvent): void {
    const keys = ['royal-barbers.admin-barbers.v1', 'royal-barbers.admin-services.v1',
      'royal-barbers.admin-settings.v1', 'royal-barbers.admin-bookings.v1'];
    if (event.storageArea === window.localStorage && (!event.key || keys.includes(event.key))) this.refresh();
  }

  @HostListener('document:keydown.escape')
  close(): void { if (!this.saving) this.closed.emit(); }

  trackService(_index: number, service: { id: number }): number { return service.id; }

  toggleService(id: number): void {
    this.serviceIds = this.serviceIds.includes(id)
      ? this.serviceIds.filter(value => value !== id) : [...this.serviceIds, id];
    this.error = '';
    this.slots = this.bookingService.getWalkInSlots(this.serviceIds);
    this.selectedSlot = this.slots[0] || null;
  }

  refresh(): void {
    const hadSelection = !!this.selectedSlot;
    this.bookingService.refreshWalkInData();
    this.serviceIds = this.serviceIds.filter(id => this.bookingService.walkInServices.some(service => service.id === id));
    this.slots = this.bookingService.getWalkInSlots(this.serviceIds);
    this.selectedSlot = null;
    this.error = hadSelection ? 'Availability refreshed. Please choose a barber and time again.' : '';
  }

  chooseSlot(slot: WalkInSlot): void { this.selectedSlot = slot; this.error = ''; }

  submit(): void {
    if (this.saving) return;
    if (!this.customerName.trim()) { this.error = 'Enter the customer name.'; return; }
    const slot = this.selectedSlot;
    if (!slot || !this.summary) { this.error = 'Choose services and an available barber.'; return; }
    const reviewedSummary = JSON.stringify(this.summary);
    this.saving = true;
    this.bookingService.refreshWalkInData();
    if (JSON.stringify(this.summary) !== reviewedSummary) {
      this.saving = false;
      this.slots = this.bookingService.getWalkInSlots(this.serviceIds);
      this.selectedSlot = null;
      this.error = 'The selected services or price changed. Review the total and choose a time again.';
      return;
    }
    const result = this.bookingService.addWalkInBooking({
      customerName: this.customerName, phone: this.phone, notes: this.notes,
      serviceIds: this.serviceIds, barber: slot.barber, date: slot.date, time: slot.time
    });
    if (result.success && result.booking) {
      this.saved.emit(result.booking);
      return;
    }
    this.saving = false;
    this.error = result.message;
    this.slots = this.bookingService.getWalkInSlots(this.serviceIds);
    this.selectedSlot = null;
  }
}
