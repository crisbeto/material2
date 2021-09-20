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
  HostListener,
  Inject,
  OnDestroy,
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {
  MDCChipActionAdapter,
  MDCChipActionFoundation,
  MDCChipActionType,
  MDCChipPrimaryActionFoundation,
} from '@material/chips';
import {emitCustomEvent} from './emit-event';


/** @docs-private */
@Directive({selector: '[matChipAction]'})
export class MatChipAction implements AfterViewInit, OnDestroy {
  private _document: Document;
  private _foundation: MDCChipActionFoundation;
  private _adapter: MDCChipActionAdapter = {
    focus: () => this.focus(),
    getAttribute: (name: string) => this._elementRef.nativeElement.getAttribute(name),
    setAttribute: (name: string, value: string) => {
      this._elementRef.nativeElement.setAttribute(name, value);
    },
    removeAttribute: (name: string) => this._elementRef.nativeElement.removeAttribute(name),
    getElementID: () => this._elementRef.nativeElement.id,
    emitEvent: <T>(eventName: string, data: T) => {
      emitCustomEvent<T>(this._elementRef.nativeElement, this._document, eventName, data, true);
    }
  };

  // We have to use a `HostListener` here in order to support both Ivy and ViewEngine.
  // In Ivy the `host` bindings will be merged when this class is extended, whereas in
  // ViewEngine they're overwritten.
  // TODO(crisbeto): we move this back into `host` once Ivy is turned on by default.
  // tslint:disable-next-line:no-host-decorator-in-concrete
  @HostListener('click')
  _handleClick() {
    this._foundation.handleClick();
  }

  // We have to use a `HostListener` here in order to support both Ivy and ViewEngine.
  // In Ivy the `host` bindings will be merged when this class is extended, whereas in
  // ViewEngine they're overwritten.
  // TODO(crisbeto): we move this back into `host` once Ivy is turned on by default.
  // tslint:disable-next-line:no-host-decorator-in-concrete
  @HostListener('keydown', ['$event'])
  _handleKeydown(event: KeyboardEvent) {
    this._foundation.handleKeydown(event);
  }

  protected _createFoundation(adapter: MDCChipActionAdapter): MDCChipActionFoundation {
    return new MDCChipPrimaryActionFoundation(adapter);
  }

  constructor(
    public _elementRef: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) _document: any) {
    this._foundation = this._createFoundation(this._adapter);

    // Set the action classes here since they're somewhat long
    // and error prone, and we need them in several places.
    const classList = _elementRef.nativeElement.classList;
    const actionType = this._foundation.actionType();
    classList.add('mdc-evolution-chip__action');

    if (actionType === MDCChipActionType.PRIMARY) {
      classList.add('mdc-evolution-chip__action--primary');
    } else if (actionType === MDCChipActionType.TRAILING) {
      classList.add('mdc-evolution-chip__action--trailing');
    }
  }

  ngAfterViewInit() {
    this._foundation.init();
  }

  ngOnDestroy() {
    this._foundation.destroy();
  }

  focus() {
    this._elementRef.nativeElement.focus();
  }

  _getFoundation() {
    return this._foundation;
  }
}
