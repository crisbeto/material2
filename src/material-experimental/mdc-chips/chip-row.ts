/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directionality} from '@angular/cdk/bidi';
import {BooleanInput} from '@angular/cdk/coercion';
import {BACKSPACE, DELETE} from '@angular/cdk/keycodes';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  Optional,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {
  MAT_RIPPLE_GLOBAL_OPTIONS,
  RippleGlobalOptions,
} from '@angular/material-experimental/mdc-core';
import {FocusMonitor} from '@angular/cdk/a11y';
import {MatChip, MatChipEvent} from './chip';
import {MatChipEditInput} from './chip-edit-input';

/** Represents an event fired on an individual `mat-chip` when it is edited. */
export interface MatChipEditedEvent extends MatChipEvent {
  /** The final edit value. */
  value: string;
}

/**
 * An extension of the MatChip component used with MatChipGrid and
 * the matChipInputFor directive.
 */
@Component({
  selector: 'mat-chip-row, mat-basic-chip-row',
  templateUrl: 'chip-row.html',
  styleUrls: ['chips.css'],
  inputs: ['color', 'disableRipple', 'tabIndex'],
  host: {
    'role': 'row',
    'class': 'mat-mdc-chip mat-mdc-chip-row mat-mdc-focus-indicator mdc-evolution-chip',
    '[class.mdc-evolution-chip--disabled]': 'disabled',
    '[class.mdc-evolution-chip--with-trailing-action]': '_hasTrailingIcon()',
    '[class.mdc-evolution-chip--with-primary-graphic]': 'leadingIcon',
    '[class.mdc-evolution-chip--with-primary-icon]': 'leadingIcon',
    '[class.mdc-evolution-chip--with-avatar]': 'leadingIcon',
    '[class.mat-mdc-chip-highlighted]': 'highlighted',
    '[id]': 'id',
    '[tabIndex]': 'tabIndex',
    '[attr.aria-disabled]': 'disabled.toString()',
    '(mousedown)': '_mousedown($event)',
    '(keydown)': '_keydown($event)',
    '(focusin)': '_focusin($event)',
    '(focusout)': '_focusout($event)',
  },
  providers: [{provide: MatChip, useExisting: MatChipRow}],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatChipRow extends MatChip implements AfterContentInit, AfterViewInit {
  protected override basicChipAttrName = 'mat-basic-chip-row';

  @Input() editable: boolean = false;

  /** Emitted when the chip is edited. */
  @Output() readonly edited: EventEmitter<MatChipEditedEvent> =
    new EventEmitter<MatChipEditedEvent>();

  /** The default chip edit input that is used if none is projected into this chip row. */
  @ViewChild(MatChipEditInput) defaultEditInput?: MatChipEditInput;

  /** The projected chip edit input. */
  @ContentChild(MatChipEditInput) contentEditInput?: MatChipEditInput;

  /**
   * Timeout used to give some time between `focusin` and `focusout`
   * in order to determine whether focus has left the chip.
   */
  private _focusoutTimeout: any;

  constructor(
    changeDetectorRef: ChangeDetectorRef,
    elementRef: ElementRef,
    ngZone: NgZone,
    focusMonitor: FocusMonitor,
    @Inject(DOCUMENT) _document: any,
    @Optional() dir: Directionality,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
    @Optional()
    @Inject(MAT_RIPPLE_GLOBAL_OPTIONS)
    globalRippleOptions?: RippleGlobalOptions,
  ) {
    super(
      changeDetectorRef,
      elementRef,
      ngZone,
      focusMonitor,
      _document,
      dir,
      animationMode,
      globalRippleOptions,
    );
  }

  ngAfterContentInit() {
    if (this.removeIcon) {
      // Defer setting the value in order to avoid the "Expression
      // has changed after it was checked" errors from Angular.
      setTimeout(() => {
        // removeIcon has tabIndex 0 for regular chips, but should only be focusable by
        // the GridFocusKeyManager for row chips.
        this.removeIcon.tabIndex = -1;
      });
    }
  }

  /**
   * Allows for programmatic focusing of the chip.
   * Sends focus to the first grid cell. The row chip element itself
   * is never focused.
   */
  focus(): void {
    if (!this.disabled) {
      if (!this._hasFocusInternal) {
        this._onFocus.next({chip: this});
      }

      this.primaryAction.focus();
    }
  }

  /**
   * Emits a blur event when one of the gridcells loses focus, unless focus moved
   * to the other gridcell.
   */
  _focusout() {
    if (this._focusoutTimeout) {
      clearTimeout(this._focusoutTimeout);
    }

    // Wait to see if focus moves to the other gridcell
    this._focusoutTimeout = setTimeout(() => {
      this._hasFocusInternal = false;
      this._onBlur.next({chip: this});
    });
  }

  /** Records that the chip has focus when one of the gridcells is focused. */
  _focusin() {
    if (this._focusoutTimeout) {
      clearTimeout(this._focusoutTimeout);
      this._focusoutTimeout = null;
    }

    this._hasFocusInternal = true;
  }

  /** Sends focus to the first gridcell when the user clicks anywhere inside the chip. */
  _mousedown(event: MouseEvent) {
    if (!this._isEditing()) {
      if (!this.disabled) {
        this.focus();
      }

      event.preventDefault();
    }
  }

  /** Handles custom key presses. */
  _keydown(event: KeyboardEvent): void {
    if (
      !this.disabled &&
      !this._isEditing() &&
      (event.keyCode === DELETE || event.keyCode === BACKSPACE)
    ) {
      // Remove the focused chip
      this.remove();
      // Always prevent so page navigation does not occur
      event.preventDefault();
    }
  }

  _isEditing() {
    // TODO
    // return this._chipFoundation.isEditing();
    return false;
  }

  protected override _onEditStart() {
    // Defer initializing the input so it has time to be added to the DOM.
    setTimeout(() => {
      this._getEditInput().initialize(this.value);
    });
  }

  protected override _onEditFinish() {
    // If the edit input is still focused or focus was returned to the body after it was destroyed,
    // return focus to the chip contents.
    if (
      this._document.activeElement === this._getEditInput().getNativeElement() ||
      this._document.activeElement === this._document.body
    ) {
      // TODO
      // this.chipContent.nativeElement.focus();
    }
    this.edited.emit({chip: this, value: this._getEditInput().getValue()});
  }

  /**
   * Gets the projected chip edit input, or the default input if none is projected in. One of these
   * two values is guaranteed to be defined.
   */
  private _getEditInput(): MatChipEditInput {
    return this.contentEditInput || this.defaultEditInput!;
  }

  static ngAcceptInputType_editable: BooleanInput;
}
