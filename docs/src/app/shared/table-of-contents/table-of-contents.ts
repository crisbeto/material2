/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  NgZone,
  ChangeDetectorRef,
  input,
  inject,
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {fromEvent, Subscription} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {NavigationFocusService} from '../navigation-focus/navigation-focus.service';

interface LinkSection {
  name: string;
  links: Link[];
}

interface Link {
  id: string;

  type: string;

  /* If the anchor is in view of the page */
  active: boolean;

  /* name of the anchor */
  name: string;

  /* top offset px of the anchor */
  header: Element;

  intersects: boolean;
}

@Component({
  selector: 'table-of-contents',
  styleUrls: ['./table-of-contents.scss'],
  templateUrl: './table-of-contents.html',
})
export class TableOfContents implements OnInit, AfterViewInit, OnDestroy {
  private _router = inject(Router);
  private _route = inject(ActivatedRoute);
  private _element = inject(ElementRef);
  private _navigationFocusService = inject(NavigationFocusService);
  private _document = inject<Document>(DOCUMENT);
  private _ngZone = inject(NgZone);
  private _changeDetectorRef = inject(ChangeDetectorRef);

  readonly container = input<string>();

  _linkSections: LinkSection[] = [];
  _links: Link[] = [];
  _rootUrl = this._router.url.split('#')[0];

  private _scrollContainer: HTMLElement | Window | null = null;
  private _urlFragment = '';
  private _subscriptions = new Subscription();
  private _observer: IntersectionObserver;

  constructor() {
    this._observer = this._ngZone.runOutsideAngular(() => {
      return new IntersectionObserver(entries => this._onIntersection(entries), {
        rootMargin: '-60px 0% 0% 0%',
        threshold: 1,
      });
    });

    const _router = this._router;

    this._subscriptions.add(
      this._navigationFocusService.navigationEndEvents.subscribe(() => {
        const rootUrl = _router.url.split('#')[0];
        if (rootUrl !== this._rootUrl) {
          this._rootUrl = rootUrl;
        }
      }),
    );

    this._subscriptions.add(
      this._route.fragment.subscribe(fragment => {
        if (fragment != null) {
          this._urlFragment = fragment;
          document.getElementById(this._urlFragment)?.scrollIntoView();
        }
      }),
    );
  }

  ngOnInit(): void {
    // On init, the sidenav content element doesn't yet exist, so it's not possible
    // to subscribe to its scroll event until next tick (when it does exist).
    // this._ngZone.runOutsideAngular(() => {
    //   Promise.resolve().then(() => {
    //     const container = this.container();
    //     this._scrollContainer = container
    //       ? (this._document.querySelector(container) as HTMLElement)
    //       : window;
    //     if (this._scrollContainer) {
    //       this._subscriptions.add(
    //         fromEvent(this._scrollContainer, 'scroll')
    //           .pipe(debounceTime(10))
    //           .subscribe(() => this._onScroll()),
    //       );
    //     }
    //   });
    // });
  }

  ngAfterViewInit() {
    this.updateScrollPosition();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  updateScrollPosition(): void {
    this._document.getElementById(this._urlFragment)?.scrollIntoView();
  }

  resetHeaders() {
    this._linkSections = [];
    this._links = [];
  }

  addHeaders(sectionName: string, container: HTMLElement, sectionIndex = 0) {
    const headers = container.querySelectorAll('h2, h3, h4');
    const links: Link[] = [];

    this._ngZone.runOutsideAngular(() => {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];

        if (header.id) {
          links.push({
            id: header.id,
            type: header.tagName.toLowerCase(),
            // Remove the 'link' icon name from the inner text
            name: header.textContent?.trim().replace(/^link/, '') || '',
            active: false,
            intersects: false,
            header,
          });

          this._observer.observe(header);
        }
      }
    });

    this._linkSections[sectionIndex] = {name: sectionName, links};
    this._links.push(...links);
  }

  private _onIntersection(entries: IntersectionObserverEntry[]) {
    const intersecting: Link[] = [];

    for (const link of this._links) {
      const correspondingEntry = entries.find(e => e.target === link.header);

      if (correspondingEntry) {
        link.intersects = correspondingEntry.isIntersecting;

        if (link.intersects) {
          intersecting.push(link);
        }
      }
    }

    console.log(intersecting.length);

    for (const link of this._links) {
      link.active = intersecting.length > 0 && link === intersecting[intersecting.length - 1];
    }

    this._ngZone.run(() => this._changeDetectorRef.markForCheck());
  }

  // private _onScroll(): void {
  //   const scrollOffset = this._getScrollOffset();
  //   let hasChanged = false;

  //   if (scrollOffset == null) {
  //     return;
  //   }

  //   for (let i = 0; i < this._links.length; i++) {
  //     // A link is considered active if the page is scrolled past the
  //     // anchor without also being scrolled passed the next link.
  //     const currentLink = this._links[i];
  //     const nextLink = this._links[i + 1];
  //     const isActive =
  //       scrollOffset >= currentLink.top && (!nextLink || nextLink.top >= scrollOffset);

  //     if (isActive !== currentLink.active) {
  //       currentLink.active = isActive;
  //       hasChanged = true;
  //     }
  //   }

  //   if (hasChanged) {
  //     // The scroll listener runs outside of the Angular zone so
  //     // we need to bring it back in only when something has changed.
  //     this._ngZone.run(() => this._changeDetectorRef.markForCheck());
  //   }
  // }
}
