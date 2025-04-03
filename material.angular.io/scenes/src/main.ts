import {importProvidersFrom} from '@angular/core';

import {AppComponent} from './app/app.component';
import {MatNativeDateModule, MATERIAL_ANIMATIONS} from '@angular/material/core';
import {routes} from './app/app-routes';
import {BrowserModule, bootstrapApplication} from '@angular/platform-browser';
import {DOCUMENT} from '@angular/common';
import {SceneOverlayContainer} from './app/scene-overlay-container';
import {Platform} from '@angular/cdk/platform';
import {OverlayContainer} from '@angular/cdk/overlay';
import {provideRouter} from '@angular/router';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, MatNativeDateModule),
    {
      provide: OverlayContainer,
      useFactory: (doc: any, platform: Platform) => new SceneOverlayContainer(doc, platform),
      deps: [DOCUMENT, Platform],
    },
    {
      provide: MATERIAL_ANIMATIONS,
      useValue: {animationsDisabled: true},
    },
    provideRouter(routes),
  ],
}).catch(err => console.error(err));
