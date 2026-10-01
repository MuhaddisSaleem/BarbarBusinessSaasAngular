import { APP_INITIALIZER } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { LegacyCatalogMigrationService } from './app/core/legacy-catalog-migration.service';
import { authInterceptor } from './app/core/auth.interceptor';

function initializeCatalog(migration: LegacyCatalogMigrationService) {
  return () => migration.initialize();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeCatalog,
      deps: [LegacyCatalogMigrationService],
      multi: true
    }
  ]
})
  .catch(err => console.error(err));
