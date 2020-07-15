/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  Component,
  ContentChildren,
  QueryList,
  AfterContentInit,
  ElementRef,
  ViewChild,
  Input,
  OnInit,
  Output,
  EventEmitter
} from '@angular/core';
import {ActiveDescendantKeyManager, Highlightable} from '@angular/cdk/a11y';
import {ENTER, SPACE, ESCAPE} from '@angular/cdk/keycodes';
import {SelectionModel} from '@angular/cdk/collections';

let id = 0;

@Component({
  selector: 'new-option',
  template: '<ng-content></ng-content>',
  host: {
    'role': 'option',
    '[attr.id]': 'id',
    '[attr.aria-selected]': '_isSelected() || null',
    '[class.is-active]': 'isActive',
    '(click)': '_handleClick()',
  },
  styles: [`
    :host {
      display: block;
    }

    :host(.is-active) {
      outline: solid 1px red;
    }

    :host([aria-selected="true"]) {
      color: red;
    }
  `]
})
export class NewOption<T = any> implements Highlightable {
  @Input() value: T;
  id = `new-select-option-${id++}`;
  isActive = false;

  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _select: NewSelect) {}

  setActiveStyles(): void {
    this.isActive = true;
  }

  setInactiveStyles(): void {
    this.isActive = false;
  }

  _getContent() {
    return this._elementRef.nativeElement.textContent?.trim() || '';
  }

  _handleClick() {
    this._select._selectOption(this);
  }

  _isSelected() {
    return this._select._isSelected(this);
  }
}

@Component({
  selector: 'li[new-option]',
  template: '<ng-content></ng-content>',
  host: {
    'role': 'option',
    '[attr.id]': 'id',
    '[attr.aria-selected]': '_isSelected() || null',
    '[class.is-active]': 'isActive',
    '(click)': '_handleClick()',
  },
  styles: [`
    :host {
      display: block;
    }

    :host(.is-active) {
      outline: solid 1px red;
    }

    :host([aria-selected="true"]) {
      color: red;
    }
  `],
  providers: [{
    provide: NewOption,
    useExisting: NewOptionListItem
  }]
})
export class NewOptionListItem extends NewOption {}

@Component({
  selector: 'new-select',
  template: `
    <div [attr.id]="labelId">{{label}}</div>
    <button
      #button
      aria-haspopup="listbox"
      [attr.aria-labelledby]="labelId + ' ' + selectedValueId"
      [attr.aria-expanded]="expanded"
      [attr.aria-invalid]="invalid"
      (click)="_triggerClicked()">
      <div [attr.id]="selectedValueId">{{_getSelectedLabel()}}</div>
    </button>
    <div
      *ngIf="expanded || alwaysInDom"
      #listbox
      class="listbox"
      role="listbox"
      tabindex="-1"
      [attr.aria-activedescendant]="_getActiveOption()?.id || null"
      [attr.aria-multiselectable]="multiple"
      [attr.aria-required]="required"
      (keydown)="_handleKeydown($event)">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .listbox {
      outline: 0;
      max-width: 200px;
      display: none;
    }
  `]
})
export class NewSelect implements OnInit, AfterContentInit {
  @ContentChildren(NewOption) options: QueryList<NewOption>;
  @ViewChild('button') button: ElementRef<HTMLButtonElement>;
  @ViewChild('listbox') listbox: ElementRef<HTMLElement>;
  @Input() label: string;
  @Input() alwaysInDom = true;
  @Input() multiple = false;
  labelId = `new-select-label-${id++}`;
  selectedValueId = `new-select-selected-value-${id++}`;
  expanded = false;
  @Input() invalid = false;
  @Input() required = false;
  protected _keyManager: ActiveDescendantKeyManager<NewOption>;
  protected _selectionModel: SelectionModel<NewOption>;

  ngOnInit() {
    this._selectionModel = new SelectionModel<NewOption>(this.multiple);
  }

  ngAfterContentInit() {
    this._keyManager = new ActiveDescendantKeyManager(this.options);
    Promise.resolve().then(() => this._keyManager.setFirstItemActive());
  }

  _handleKeydown(event: KeyboardEvent) {
    if (event.keyCode === ESCAPE) {
      event.preventDefault();
      this._setExpanded(false);
    } else if (event.keyCode === ENTER || event.keyCode === SPACE) {
      const activeOption = this._getActiveOption();

      if (activeOption) {
        event.preventDefault();
        this._selectOption(activeOption);
      }
    } else {
      this._keyManager.onKeydown(event);
    }
  }

  _getActiveOption(): NewOption | null {
    return this._keyManager?.activeItem;
  }

  _getSelectedLabel() {
    const selected = this._selectionModel.selected;
    return selected.map(option => option._getContent()).join(', ') || 'No value';
  }

  _selectOption(option: NewOption) {
    this._keyManager.setActiveItem(option);

    if (this.multiple && this._isSelected(option)) {
      this._selectionModel.deselect(option);
    } else {
      this._selectionModel.select(option);
    }

    if (!this.multiple) {
      this._setExpanded(false);
    }
  }

  _isSelected(option: NewOption) {
    return this._selectionModel.isSelected(option);
  }

  _triggerClicked() {
    this._setExpanded(!this.expanded);
  }

  protected _setExpanded(isExpanded: boolean) {
    this.expanded = isExpanded;

    // Here for the `ngIf` case to wait for change detection.
    setTimeout(() => {
      if (this.listbox) {
        this.listbox.nativeElement.style.display = isExpanded ? 'block' : 'none';
      }

      this._moveFocus(isExpanded);
    });
  }

  protected _moveFocus(isExpanded: boolean) {
    (isExpanded ? this.listbox : this.button).nativeElement.focus();
  }
}

@Component({
  selector: 'new-select-ul',
  styles: [`
    :host {
      display: block;
    }

    .listbox {
      outline: 0;
      max-width: 200px;
      display: none;
    }
  `],
  template: `
    <div [attr.id]="labelId">{{label}}</div>
    <button
      #button
      aria-haspopup="listbox"
      [attr.aria-labelledby]="labelId + ' ' + selectedValueId"
      [attr.aria-expanded]="expanded"
      [attr.aria-invalid]="invalid"
      (click)="_triggerClicked()">
      <div [attr.id]="selectedValueId">{{_getSelectedLabel()}}</div>
    </button>
    <ul
      *ngIf="expanded || alwaysInDom"
      #listbox
      class="listbox"
      role="listbox"
      tabindex="-1"
      [attr.aria-activedescendant]="_getActiveOption()?.id || null"
      [attr.aria-required]="required"
      [attr.aria-multiselectable]="multiple"
      (keydown)="_handleKeydown($event)">
      <ng-content></ng-content>
    </ul>
  `,
  providers: [{
    provide: NewSelect,
    useExisting: NewSelectList
  }]
})
export class NewSelectList extends NewSelect {}


@Component({
  selector: 'new-select-combobox',
  styles: [`
    :host {
      display: block;
    }

    .listbox {
      outline: 0;
      max-width: 200px;
      display: none;
    }

    .trigger {
      display: inline-block;
      padding: 4px 8px;
      background: grey;
      border-radius: 4px;
    }
  `],
  template: `
    <div [attr.id]="labelId">{{label}}</div>
    <div
      class="trigger"
      #button
      role="combobox"
      aria-autocomplete="none"
      aria-haspopup="listbox"
      [attr.aria-expanded]="expanded"
      [attr.aria-labelledby]="labelId + ' ' + selectedValueId"
      [attr.aria-activedescendant]="_getActiveOption()?.id || null"
      [attr.aria-controls]="_listboxId"
      [attr.aria-required]="required"
      [attr.aria-invalid]="invalid"
      tabindex="0"
      (click)="_triggerClicked()"
      (keydown)="_handleKeydown($event)">
        <span [attr.id]="selectedValueId">{{_getSelectedLabel()}}</span>
    </div>

    <div
      #listbox
      class="listbox"
      role="listbox"
      tabindex="-1"
      [attr.id]="_listboxId">
      <ng-content></ng-content>
    </div>
  `,
  providers: [{
    provide: NewSelect,
    useExisting: NewSelectCombobox
  }]
})
export class NewSelectCombobox extends NewSelect {
  _listboxId = `listbox-${id++}`;

  _handleKeydown(event: KeyboardEvent) {
    if (this.expanded) {
      super._handleKeydown(event);
    } else if (event.keyCode === ENTER || event.keyCode === SPACE) {
      this._setExpanded(true);
    }
  }

  // When using the combobox pattern we want to keep focus on the trigger.
  protected _moveFocus() {}
}


@Component({
  selector: 'new-select-combobox-dialog',
  styles: [`
    :host {
      display: block;
    }

    .listbox, .dialog {
      outline: 0;
      max-width: 200px;
    }

    .listbox:focus {
      outline: solid 2px;
    }

    .dialog {
      display: none;
    }

    .dialog.expanded {
      display: block;
    }

    .trigger {
      display: inline-block;
      padding: 4px 8px;
      background: grey;
      border-radius: 4px;
    }
  `],
  host: {
    '(keydown)': '_handleKeydown($event)'
  },
  template: `
    <div [attr.id]="labelId">{{label}}</div>
    <div
      class="trigger"
      #button
      role="combobox"
      aria-haspopup="dialog"
      [attr.aria-expanded]="expanded"
      [attr.aria-labelledby]="labelId + ' ' + selectedValueId"
      [attr.aria-required]="required"
      [attr.aria-invalid]="invalid"
      tabindex="0"
      (click)="_triggerClicked()">
        <span [attr.id]="selectedValueId">{{_getSelectedLabel()}}</span>
    </div>

    <div class="dialog" [class.expanded]="expanded" role="dialog" aria-modal="true" cdkTrapFocus>
      <input
        #input
        [value]="text"
        (input)="textChange.emit(input.value)"
        (keydown)="$event.stopPropagation()"
        placeholder="Search for a car">

      <div
        class="listbox"
        role="listbox"
        tabindex="0"
        [attr.id]="_listboxId"
        [attr.aria-labelledby]="labelId"
        [attr.aria-activedescendant]="_getActiveOption()?.id || null"
        [attr.aria-labelledby]="labelId">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  providers: [{
    provide: NewSelect,
    useExisting: NewSelectComboboxDialog
  }]
})
export class NewSelectComboboxDialog extends NewSelectCombobox implements AfterContentInit {
  @ViewChild('input') input: ElementRef<HTMLInputElement>;
  @Input() text = '';
  @Output() textChange = new EventEmitter<string>();

  ngAfterContentInit() {
    super.ngAfterContentInit();

    this.options.changes.subscribe(() => {
      this._keyManager.updateActiveItem(this.options.length === 0 ? -1 : 0);
    });
  }

  protected _moveFocus() {
    if (this.expanded) {
      this.input.nativeElement.focus();
    } else {
      this.button.nativeElement.focus();
    }
  }
}
