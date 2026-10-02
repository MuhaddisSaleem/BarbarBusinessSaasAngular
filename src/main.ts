import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { LegacyCatalogMigrationService } from './app/core/legacy-catalog-migration.service';
import { authInterceptor } from './app/core/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
})
  .then(appRef => {
    // Render the application immediately. Catalog/database synchronization happens
    // after bootstrap so a slow API can never hold the entire page on a black screen.
    const migration = appRef.injector.get(LegacyCatalogMigrationService);
    void migration.initialize();
  })
  .catch(err => console.error(err));
