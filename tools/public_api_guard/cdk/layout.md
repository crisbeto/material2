## API Report File for "components-srcs"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import * as i0 from '@angular/core';
import { NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { Platform } from '@angular/cdk/platform';

// @public
export class BreakpointObserver implements OnDestroy {
    constructor(_mediaMatcher: MediaMatcher, _zone: NgZone);
    isMatched(value: string | readonly string[]): boolean;
    ngOnDestroy(): void;
    observe(value: string | readonly string[]): Observable<BreakpointState>;
    // (undocumented)
    static ɵfac: i0.ɵɵFactoryDeclaration<BreakpointObserver, never>;
    // (undocumented)
    static ɵprov: i0.ɵɵInjectableDeclaration<BreakpointObserver>;
}

// @public
export const Breakpoints: {
    XSmall: string;
    Small: string;
    Medium: string;
    Large: string;
    XLarge: string;
    Handset: string;
    Tablet: string;
    Web: string;
    HandsetPortrait: string;
    TabletPortrait: string;
    WebPortrait: string;
    HandsetLandscape: string;
    TabletLandscape: string;
    WebLandscape: string;
};

// @public
export interface BreakpointState {
    breakpoints: {
        [key: string]: boolean;
    };
    matches: boolean;
}

// @public (undocumented)
export class LayoutModule {
    // (undocumented)
    static ɵfac: i0.ɵɵFactoryDeclaration<LayoutModule, never>;
    // (undocumented)
    static ɵinj: i0.ɵɵInjectorDeclaration<LayoutModule>;
    // (undocumented)
    static ɵmod: i0.ɵɵNgModuleDeclaration<LayoutModule, never, never, never>;
}

// @public
export class MediaMatcher {
    constructor(_platform: Platform, _nonce?: (string | null) | undefined);
    matchMedia(query: string): MediaQueryList;
    // (undocumented)
    static ɵfac: i0.ɵɵFactoryDeclaration<MediaMatcher, [null, { optional: true; }]>;
    // (undocumented)
    static ɵprov: i0.ɵɵInjectableDeclaration<MediaMatcher>;
}

// (No @packageDocumentation comment for this package)

```
