import { APP_INITIALIZER } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { LegacyCatalogMigrationService } from './app/core/legacy-catalog-migration.service';

function initializeCatalog(migration: LegacyCatalogMigrationService) {
  return () => migration.initialize();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeCatalog,
      deps: [LegacyCatalogMigrationService],
      multi: true
    }
  ]
})
  .catch(err => console.error(err));
