import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import type { AdminService, ServiceMutationResult } from '../admin/services/admin-service.service';
import type { AdminBarber, BarberMutationResult } from '../admin/barbers/admin-barber.service';
import type { AdminSettings, SettingsSaveResult } from '../admin/settings/admin-settings.service';

export interface ApiMutationResult<T> {
  success: boolean;
  message: string;
  item?: T;
}

export interface LegacyCatalogImportResult {
  success: boolean;
  imported: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly servicesUrl = '/api/services';
  private readonly barbersUrl = '/api/barbers';
  private readonly settingsUrl = '/api/settings';
  private readonly bootstrapUrl = '/api/bootstrap/legacy-catalog';

  serviceSnapshot: AdminService[] = [];
  barberSnapshot: AdminBarber[] = [];
  settingsSnapshot: AdminSettings | null = null;

  constructor(private readonly http: HttpClient) {}

  getServices(): Observable<AdminService[]> {
    return this.http.get<AdminService[]>(this.servicesUrl);
  }

  addService(service: Omit<AdminService, 'id'>): Observable<ApiMutationResult<AdminService>> {
    return this.http.post<ApiMutationResult<AdminService>>(this.servicesUrl, service);
  }

  updateService(id: number, service: Omit<AdminService, 'id'>): Observable<ApiMutationResult<AdminService>> {
    return this.http.put<ApiMutationResult<AdminService>>(this.servicesUrl + '/' + id, service);
  }

  toggleServiceStatus(id: number): Observable<ApiMutationResult<AdminService>> {
    return this.http.patch<ApiMutationResult<AdminService>>(this.servicesUrl + '/' + id + '/status', {});
  }

  deleteService(id: number): Observable<ServiceMutationResult> {
    return this.http.delete<ServiceMutationResult>(this.servicesUrl + '/' + id);
  }

  getBarbers(): Observable<AdminBarber[]> {
    return this.http.get<AdminBarber[]>(this.barbersUrl);
  }

  addBarber(barber: Omit<AdminBarber, 'id'>): Observable<ApiMutationResult<AdminBarber>> {
    return this.http.post<ApiMutationResult<AdminBarber>>(this.barbersUrl, barber);
  }

  updateBarber(
    id: number,
    barber: Pick<AdminBarber, 'name' | 'phone' | 'experience' | 'specialties' | 'workingHours' | 'image'>
  ): Observable<ApiMutationResult<AdminBarber>> {
    const current = this.barberSnapshot.find(item => item.id === id);
    return this.http.put<ApiMutationResult<AdminBarber>>(this.barbersUrl + '/' + id, {
      ...current,
      ...barber,
      rating: current?.rating ?? 5,
      availability: current?.availability ?? 'Available Today',
      accountStatus: current?.accountStatus ?? 'Active',
      leaveFrom: current?.leaveFrom ?? null,
      leaveTo: current?.leaveTo ?? null,
      note: current?.note ?? ''
    });
  }

  updateBarberAvailability(id: number, availability: string): Observable<ApiMutationResult<AdminBarber>> {
    return this.http.patch<ApiMutationResult<AdminBarber>>(
      this.barbersUrl + '/' + id + '/availability',
      { availability }
    );
  }

  updateBarberLeave(
    id: number,
    availability: 'On Leave' | 'Vacation',
    leaveFrom: string,
    leaveTo: string,
    note: string
  ): Observable<ApiMutationResult<AdminBarber>> {
    return this.http.put<ApiMutationResult<AdminBarber>>(this.barbersUrl + '/' + id + '/leave', {
      availability,
      leaveFrom,
      leaveTo,
      note
    });
  }

  toggleBarberStatus(id: number): Observable<ApiMutationResult<AdminBarber>> {
    return this.http.patch<ApiMutationResult<AdminBarber>>(this.barbersUrl + '/' + id + '/status', {});
  }

  deleteBarber(id: number): Observable<BarberMutationResult> {
    return this.http.delete<BarberMutationResult>(this.barbersUrl + '/' + id);
  }

  getSettings(): Observable<AdminSettings> {
    return this.http.get<AdminSettings>(this.settingsUrl);
  }

  saveSettings(settings: AdminSettings): Observable<ApiMutationResult<AdminSettings>> {
    return this.http.put<ApiMutationResult<AdminSettings>>(this.settingsUrl, settings);
  }

  resetSettings(): Observable<ApiMutationResult<AdminSettings>> {
    return this.http.post<ApiMutationResult<AdminSettings>>(this.settingsUrl + '/reset', {});
  }

  importLegacyCatalog(payload: {
    services?: AdminService[];
    barbers?: AdminBarber[];
    settings?: AdminSettings;
  }): Observable<LegacyCatalogImportResult> {
    return this.http.post<LegacyCatalogImportResult>(this.bootstrapUrl, payload);
  }

  async preload(): Promise<void> {
    const state = await firstValueFrom(forkJoin({
      services: this.getServices(),
      barbers: this.getBarbers(),
      settings: this.getSettings()
    }));

    this.serviceSnapshot = state.services;
    this.barberSnapshot = state.barbers;
    this.settingsSnapshot = state.settings;
  }
}
