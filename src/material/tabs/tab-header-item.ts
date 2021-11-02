/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {FocusMonitor} from '@angular/cdk/a11y';
import {BooleanInput} from '@angular/cdk/coercion';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import {CanDisable, mixinDisabled} from '@angular/material/core';

// TODO: circular dependency, can be resolved with an injection token.
import {MatTabHeader} from './tab-header';

// Boilerplate for applying mixins to MatTabHeaderItem.
/** @docs-private */
const _MatTabHeaderItemBase = mixinDisabled(class {});

// TODO: handle ripple disabled state.

/**
 * Used in the `mat-tab-group` view to display tab labels.
 * @docs-private
 */
@Component({
  selector: 'mat-tab-header-item',
  templateUrl: 'tab-header-item.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  inputs: ['disabled'],
  host: {
    'class': 'mat-tab-label mat-focus-indicator',
    'role': 'tab',
    '(click)': '_handleClick()',
    '[class.mat-tab-label-active]': '_isSelected()',
    '[attr.aria-selected]': '_isSelected()',
    '[attr.aria-posinset]': '_getIndex() + 1',
    '[attr.aria-setsize]': '_header._items?.length || 0',
    '[attr.tabindex]': '_getTabIndex()',
    '[attr.id]': 'id || null',
    '[attr.aria-controls]': 'contentId || null',
  },
})
export class MatTabHeaderItem extends _MatTabHeaderItemBase implements CanDisable, OnDestroy {
  // TODO: look into how these don't have to be passed in.
  @Input() id: string;
  @Input() contentId: string;

  constructor(
    public elementRef: ElementRef,
    private _focusMonitor: FocusMonitor,
    private _header: MatTabHeader,
  ) {
    super();
    _header._registerItem(this);
    _focusMonitor.monitor(elementRef).subscribe(focusOrigin => {
      // TODO: maybe move this into the header?
      if (focusOrigin && focusOrigin !== 'mouse' && focusOrigin !== 'touch') {
        this._header.focusIndex = this._getIndex();
      }
    });
  }

  ngOnDestroy() {
    this._header._removeItem(this);
    this._focusMonitor.stopMonitoring(this.elementRef);
  }

  _handleClick() {
    if (!this.disabled && !this._isSelected()) {
      this._header._itemClicked(this._getIndex());
    }
  }

  _getIndex(): number {
    // TODO: this is super inefficient since `toArray` clones the internal array in the QueryList
    // and then we do a linear search over it. It can be optimized by caching the item index and
    // updating the cached value when the list changes.
    const items = this._header._items;
    return items ? items.toArray().indexOf(this) : -1;
  }

  _isSelected(): boolean {
    return this._header.selectedIndex === this._getIndex();
  }

  _getTabIndex(): number | null {
    if (this.disabled) {
      return null;
    }
    return this._isSelected() ? 0 : -1;
  }

  /** Sets focus on the wrapper element */
  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  getOffsetLeft(): number {
    return this.elementRef.nativeElement.offsetLeft;
  }

  getOffsetWidth(): number {
    return this.elementRef.nativeElement.offsetWidth;
  }

  static ngAcceptInputType_disabled: BooleanInput;
}
