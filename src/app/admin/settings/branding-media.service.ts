import { Injectable, signal } from '@angular/core';

export type HeroMediaType = 'image' | 'video' | null;

interface StoredBrandMedia {
  key: 'logo' | 'hero';
  blob: Blob;
  mediaType: 'image' | 'video';
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BrandingMediaService {
  readonly logoUrl = signal('');
  readonly heroMediaUrl = signal('');
  readonly heroMediaType = signal<HeroMediaType>(null);

  private readonly databaseName = 'barber-saas-branding';
  private readonly storeName = 'media';
  private readonly databaseVersion = 1;
  private logoObjectUrl = '';
  private heroObjectUrl = '';

  constructor() {
    void this.loadAll();
  }

  async saveLogo(file: File): Promise<{ success: boolean; message: string }> {
    if (!file.type.startsWith('image/')) {
      return { success: false, message: 'Logo must be an image file.' };
    }

    if (file.size > 2 * 1024 * 1024) {
      return { success: false, message: 'Logo must be 2 MB or smaller.' };
    }

    try {
      await this.put({
        key: 'logo',
        blob: file,
        mediaType: 'image',
        updatedAt: new Date().toISOString()
      });
      this.applyLogoUrl(file);
      return { success: true, message: 'Business logo updated.' };
    } catch {
      return { success: false, message: 'Could not save the logo in this browser.' };
    }
  }

  async saveHeroMedia(file: File): Promise<{ success: boolean; message: string }> {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type === 'video/mp4' || file.type === 'video/webm';

    if (!isImage && !isVideo) {
      return { success: false, message: 'Hero media must be an image, MP4, or WebM video.' };
    }

    if (file.size > 2 * 1024 * 1024) {
      return { success: false, message: 'Hero media must be 2 MB or smaller.' };
    }

    try {
      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
      await this.put({
        key: 'hero',
        blob: file,
        mediaType,
        updatedAt: new Date().toISOString()
      });
      this.applyHeroUrl(file, mediaType);
      return {
        success: true,
        message: mediaType === 'video' ? 'Hero video updated.' : 'Hero banner updated.'
      };
    } catch {
      return { success: false, message: 'Could not save the hero media in this browser.' };
    }
  }

  async clearLogo(): Promise<void> {
    await this.remove('logo');
    this.revokeLogoUrl();
    this.logoUrl.set('');
  }

  async clearHeroMedia(): Promise<void> {
    await this.remove('hero');
    this.revokeHeroUrl();
    this.heroMediaUrl.set('');
    this.heroMediaType.set(null);
  }

  async clearAll(): Promise<void> {
    await Promise.all([this.clearLogo(), this.clearHeroMedia()]);
  }

  private async loadAll(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    try {
      const [logo, hero] = await Promise.all([
        this.get('logo'),
        this.get('hero')
      ]);

      if (logo?.blob) this.applyLogoUrl(logo.blob);
      if (hero?.blob) this.applyHeroUrl(hero.blob, hero.mediaType);
    } catch {
      // Branding media is optional; fall back to the built-in presentation.
    }
  }

  private applyLogoUrl(blob: Blob): void {
    this.revokeLogoUrl();
    this.logoObjectUrl = URL.createObjectURL(blob);
    this.logoUrl.set(this.logoObjectUrl);
  }

  private applyHeroUrl(blob: Blob, mediaType: 'image' | 'video'): void {
    this.revokeHeroUrl();
    this.heroObjectUrl = URL.createObjectURL(blob);
    this.heroMediaUrl.set(this.heroObjectUrl);
    this.heroMediaType.set(mediaType);
  }

  private revokeLogoUrl(): void {
    if (this.logoObjectUrl) {
      URL.revokeObjectURL(this.logoObjectUrl);
      this.logoObjectUrl = '';
    }
  }

  private revokeHeroUrl(): void {
    if (this.heroObjectUrl) {
      URL.revokeObjectURL(this.heroObjectUrl);
      this.heroObjectUrl = '';
    }
  }

  private async get(key: 'logo' | 'hero'): Promise<StoredBrandMedia | null> {
    const db = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const request = transaction.objectStore(this.storeName).get(key);

      request.onsuccess = () => resolve((request.result as StoredBrandMedia | undefined) || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  private async put(value: StoredBrandMedia): Promise<void> {
    const db = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).put(value);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  private async remove(key: 'logo' | 'hero'): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    const db = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).delete(key);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB is not available.'));
        return;
      }

      const request = window.indexedDB.open(this.databaseName, this.databaseVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
