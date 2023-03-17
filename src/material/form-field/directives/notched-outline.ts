/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';

/**
 * Internal component that creates an instance of the MDC notched-outline component.
 *
 * The component sets up the HTML structure and styles for the notched-outline. It provides
 * inputs to toggle the notch state and width.
 */
@Component({
  selector: 'div[matFormFieldNotchedOutline]',
  templateUrl: './notched-outline.html',
  host: {
    'class': 'mdc-notched-outline',
    // Besides updating the notch state through the MDC component, we toggle this class through
    // a host binding in order to ensure that the notched-outline renders correctly on the server.
    '[class.mdc-notched-outline--notched]': 'open',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MatFormFieldNotchedOutline implements AfterViewInit {
  /** Whether the notch should be opened. */
  @Input('matFormFieldNotchedOutlineOpen') open: boolean = false;

  @ViewChild('notch', {static: true}) _notch: ElementRef<HTMLElement> | undefined;

  constructor(private _elementRef: ElementRef<HTMLElement>, private _ngZone: NgZone) {}

  ngAfterViewInit(): void {
    const label = this._elementRef.nativeElement.querySelector<HTMLElement>('.mdc-floating-label');
    if (label) {
      this._elementRef.nativeElement.classList.add('mdc-notched-outline--upgraded');

      if (typeof requestAnimationFrame === 'function') {
        label.style.transitionDuration = '0s';
        this._ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => (label.style.transitionDuration = ''));
        });
      }
    } else {
      this._elementRef.nativeElement.classList.add('mdc-notched-outline--no-label');
    }
  }

  _setNotchWidth(width: number) {
    const el = this._notch?.nativeElement;

    if (el) {
      if (this.open) {
        const NOTCH_ELEMENT_PADDING = 8;
        const NOTCH_ELEMENT_BORDER = 1;
        el.style.width =
          width > 0
            ? `calc(${width}px * var(--mat-mdc-form-field-floating-label-scale, 0.75) + ${
                NOTCH_ELEMENT_PADDING + NOTCH_ELEMENT_BORDER
              }px)`
            : '0px';
      } else {
        el.style.width = '';
      }
    }
  }
}
