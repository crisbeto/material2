/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterViewInit,
  Directive,
  ElementRef,
  Inject,
  OnDestroy,
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {
  MDCChipActionAdapter,
  MDCChipActionFoundation,
  MDCChipPrimaryActionFoundation,
} from '@material/chips/action';
import {emitCustomEvent} from './emit-event';


/** @docs-private */
@Directive({selector: '[matChipAction]'})
export class MatChipAction implements AfterViewInit, OnDestroy {
  private _document: Document;
  private _foundation: MDCChipActionFoundation;
  private _adapter: MDCChipActionAdapter = {
    focus: () => this._elementRef.nativeElement.focus(),
    getAttribute: (name: string) => this._elementRef.nativeElement.getAttribute(name),
    setAttribute: (name: string, value: string) => {
      this._elementRef.nativeElement.setAttribute(name, value);
    },
    removeAttribute: (name: string) => this._elementRef.nativeElement.removeAttribute(name),
    getElementID: () => this._elementRef.nativeElement.id,
    emitEvent: <T>(eventName: string, data: T, shouldBubble = false) => {
      emitCustomEvent<T>(this._elementRef.nativeElement, this._document, eventName, data,
        shouldBubble);
    }
  };

  protected _createFoundation(adapter: MDCChipActionAdapter): MDCChipActionFoundation {
    return new MDCChipPrimaryActionFoundation(adapter);
  }

  constructor(
    public _elementRef: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) _document: any) {
    this._foundation = this._createFoundation(this._adapter);
  }

  ngAfterViewInit() {
    this._foundation.init();
  }

  ngOnDestroy() {
    this._foundation.destroy();
  }

  _getFoundation() {
    return this._foundation;
  }
}
