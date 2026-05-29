import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Core optimization enabling coalesced change detection ticks
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Configure standard routes maps supporting component inputs
    provideRouter(routes, withComponentInputBinding()),
    // Modern client enabling performance native fetch implementations
    provideHttpClient(withFetch())
  ]
};
