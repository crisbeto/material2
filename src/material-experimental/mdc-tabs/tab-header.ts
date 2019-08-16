/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  ContentChildren,
  ViewChild,
  ElementRef,
  QueryList,
  AfterContentInit,
} from '@angular/core';
import {_MatTabHeaderBase} from '@angular/material/tabs';
import {MatTabLabelWrapper} from './tab-label-wrapper';
import {MatInkBar} from './ink-bar';

/**
 * The header of the tab group which displays a list of all the tabs in the tab group. Includes
 * an ink bar that follows the currently selected tab. When the tabs list's width exceeds the
 * width of the header container, then arrows will be displayed to allow the user to scroll
 * left and right across the header.
 * @docs-private
 */
@Component({
  moduleId: module.id,
  selector: 'mat-tab-header',
  templateUrl: 'tab-header.html',
  styleUrls: ['tab-header.css'],
  inputs: ['selectedIndex'],
  outputs: ['selectFocusedIndex', 'indexFocused'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mat-mdc-tab-header',
    '[class.mat-mdc-tab-header-pagination-controls-enabled]': '_showPaginationControls',
    '[class.mat-mdc-tab-header-rtl]': "_getLayoutDirection() == 'rtl'",
  },
})
export class MatTabHeader extends _MatTabHeaderBase implements AfterContentInit {
  @ContentChildren(MatTabLabelWrapper) _items: QueryList<MatTabLabelWrapper>;
  @ViewChild('tabListContainer', {static: true}) _tabListContainer: ElementRef;
  @ViewChild('tabList', {static: true}) _tabList: ElementRef;
  @ViewChild('nextPaginator', {static: false}) _nextPaginator: ElementRef<HTMLElement>;
  @ViewChild('previousPaginator', {static: false}) _previousPaginator: ElementRef<HTMLElement>;
  _inkBar: MatInkBar;

  ngAfterContentInit() {
    this._inkBar = new MatInkBar(this._items);
    super.ngAfterContentInit();
  }
}
