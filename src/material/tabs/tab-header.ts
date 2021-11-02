/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directionality} from '@angular/cdk/bidi';
import {ViewportRuler} from '@angular/cdk/scrolling';
import {
  AfterContentChecked,
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  Optional,
  QueryList,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
  Input,
  Inject,
  Directive,
} from '@angular/core';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {BooleanInput, coerceBooleanProperty} from '@angular/cdk/coercion';
import {MatInkBar} from './ink-bar';
import {MatTabHeaderItem} from './tab-header-item';
import {Platform} from '@angular/cdk/platform';
import {MatPaginatedTabHeader} from './paginated-tab-header';

/**
 * Base class with all of the `MatTabHeader` functionality.
 * @docs-private
 */
@Directive()
export abstract class _MatTabHeaderBase
  extends MatPaginatedTabHeader
  implements AfterContentChecked, AfterContentInit, AfterViewInit, OnDestroy
{
  /** Whether the ripple effect is disabled or not. */
  @Input()
  get disableRipple() {
    return this._disableRipple;
  }
  set disableRipple(value: any) {
    this._disableRipple = coerceBooleanProperty(value);
  }
  private _disableRipple: boolean = false;

  constructor(
    elementRef: ElementRef,
    changeDetectorRef: ChangeDetectorRef,
    viewportRuler: ViewportRuler,
    @Optional() dir: Directionality,
    ngZone: NgZone,
    platform: Platform,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
  ) {
    super(elementRef, changeDetectorRef, viewportRuler, dir, ngZone, platform, animationMode);
  }

  protected _itemSelected(event: KeyboardEvent) {
    event.preventDefault();
  }
}

/**
 * The header of the tab group which displays a list of all the tabs in the tab group. Includes
 * an ink bar that follows the currently selected tab. When the tabs list's width exceeds the
 * width of the header container, then arrows will be displayed to allow the user to scroll
 * left and right across the header.
 * @docs-private
 */
@Component({
  selector: 'mat-tab-header',
  templateUrl: 'tab-header.html',
  styleUrls: ['tab-header.css'],
  inputs: ['selectedIndex'],
  outputs: ['selectFocusedIndex', 'indexFocused'],
  encapsulation: ViewEncapsulation.None,
  // tslint:disable-next-line:validate-decorators
  changeDetection: ChangeDetectionStrategy.Default,
  host: {
    'class': 'mat-tab-header',
    '[class.mat-tab-header-pagination-controls-enabled]': '_showPaginationControls',
    '[class.mat-tab-header-rtl]': "_getLayoutDirection() == 'rtl'",
  },
})
export class MatTabHeader extends _MatTabHeaderBase implements OnDestroy {
  @ViewChild(MatInkBar, {static: true}) _inkBar: MatInkBar;
  @ViewChild('tabListContainer', {static: true}) _tabListContainer: ElementRef;
  @ViewChild('tabList', {static: true}) _tabList: ElementRef;
  @ViewChild('nextPaginator') _nextPaginator: ElementRef<HTMLElement>;
  @ViewChild('previousPaginator') _previousPaginator: ElementRef<HTMLElement>;
  _items = new QueryList<MatTabHeaderItem>();

  constructor(
    elementRef: ElementRef,
    changeDetectorRef: ChangeDetectorRef,
    viewportRuler: ViewportRuler,
    @Optional() dir: Directionality,
    ngZone: NgZone,
    platform: Platform,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
  ) {
    super(elementRef, changeDetectorRef, viewportRuler, dir, ngZone, platform, animationMode);
  }

  // Note: _registerItem and _removeItem are a little hacky, but they help us avoid all of the
  // 'Changed after checked' errors due to `MatTabHeaderItem` having to read values from `_items`.

  _registerItem(item: MatTabHeaderItem) {
    this._items.reset(this._sortItems([...this._items.toArray(), item]));
  }

  _removeItem(item: MatTabHeaderItem) {
    const items = this._items.toArray();
    const index = items.indexOf(item);

    if (index > -1) {
      items.splice(index, 1);
      this._items.reset(this._sortItems(items));
    }
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this._items.destroy();
  }

  // The items need to be sorted, because an `ngFor` might
  // register a new item in the middle of the list.
  private _sortItems(items: MatTabHeaderItem[]): MatTabHeaderItem[] {
    return items.sort((a, b) => {
      const documentPosition = a.elementRef.nativeElement.compareDocumentPosition(
        b.elementRef.nativeElement,
      );
      // tslint:disable-next-line:no-bitwise
      return documentPosition & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  static ngAcceptInputType_disableRipple: BooleanInput;
}
