/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {BooleanInput, coerceBooleanProperty} from '@angular/cdk/coercion';
import {SPACE} from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
  AfterContentInit,
  AfterViewInit,
} from '@angular/core';
import {deprecated, MDCChipActionType} from '@material/chips';
import {take} from 'rxjs/operators';
import {MatChip} from './chip';

/** Event object emitted by MatChipOption when selected or deselected. */
export class MatChipSelectionChange {
  constructor(
    /** Reference to the chip that emitted the event. */
    public source: MatChipOption,
    /** Whether the chip that emitted the event is selected. */
    public selected: boolean,
    /** Whether the selection change was a result of a user interaction. */
    public isUserInput = false,
  ) {}
}

/**
 * An extension of the MatChip component that supports chip selection.
 * Used with MatChipListbox.
 */
@Component({
  selector: 'mat-basic-chip-option, mat-chip-option',
  templateUrl: 'chip-option.html',
  styleUrls: ['chips.css'],
  inputs: ['color', 'disableRipple', 'tabIndex'],
  host: {
    'class':
      'mat-mdc-chip mat-mdc-focus-indicator mdc-evolution-chip ' + 'mdc-evolution-chip--filter',
    '[class.mdc-evolution-chip--selectable]': 'selectable',
    '[class.mdc-evolution-chip--disabled]': 'disabled',
    '[class.mdc-evolution-chip--with-trailing-action]': '_hasTrailingIcon()',
    '[class.mdc-evolution-chip--with-primary-graphic]': '_hasLeadingGraphic()',
    '[class.mdc-evolution-chip--with-primary-icon]': 'leadingIcon',
    '[class.mdc-evolution-chip--with-avatar]': 'leadingIcon',
    '[class.mat-mdc-chip-highlighted]': 'highlighted',
    'role': 'presentation',
    '[id]': 'id',
  },
  providers: [{provide: MatChip, useExisting: MatChipOption}],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatChipOption extends MatChip implements AfterContentInit, AfterViewInit {
  /** Whether the component is done initializing. */
  private _isInitialized: boolean;

  /**
   * Selected state that was assigned before the component was initializing
   * and which needs to be synced back up with the foundation.
   */
  private _pendingSelectedState: boolean | undefined;

  /** Whether the chip list is selectable. */
  chipListSelectable: boolean = true;

  /** Whether the chip list is in multi-selection mode. */
  _chipListMultiple: boolean = false;

  /**
   * Whether or not the chip is selectable.
   *
   * When a chip is not selectable, changes to its selected state are always
   * ignored. By default an option chip is selectable, and it becomes
   * non-selectable if its parent chip list is not selectable.
   */
  @Input()
  get selectable(): boolean {
    return this._selectable && this.chipListSelectable;
  }
  set selectable(value: boolean) {
    this._selectable = coerceBooleanProperty(value);
  }
  protected _selectable: boolean = true;

  /** Whether the chip is selected. */
  @Input()
  get selected(): boolean {
    return (
      this._pendingSelectedState ?? this._chipFoundation.isActionSelected(MDCChipActionType.PRIMARY)
    );
  }
  set selected(value: boolean) {
    if (this.selectable) {
      const coercedValue = coerceBooleanProperty(value);

      if (this._isInitialized) {
        this._setSelectedState(coercedValue, false);
      } else {
        this._pendingSelectedState = coercedValue;
      }
    }
  }

  /** The ARIA selected applied to the chip. */
  get ariaSelected(): string | null {
    // Remove the `aria-selected` when the chip is deselected in single-selection mode, because
    // it adds noise to NVDA users where "not selected" will be read out for each chip.
    return this.selectable && (this._chipListMultiple || this.selected)
      ? this.selected.toString()
      : null;
  }

  /** The unstyled chip selector for this component. */
  protected override basicChipAttrName = 'mat-basic-chip-option';

  /** Emitted when the chip is selected or deselected. */
  @Output() readonly selectionChange: EventEmitter<MatChipSelectionChange> =
    new EventEmitter<MatChipSelectionChange>();

  ngAfterContentInit() {
    if (this.selected && this.leadingIcon) {
      this.leadingIcon.setClass(deprecated.chipCssClasses.HIDDEN_LEADING_ICON, true);
    }
  }

  override ngAfterViewInit() {
    super.ngAfterViewInit();
    this._isInitialized = true;

    if (this._pendingSelectedState != null) {
      this._setSelectedState(this._pendingSelectedState, false);
      this._pendingSelectedState = undefined;
    }
  }

  /** Selects the chip. */
  select(): void {
    if (this.selectable) {
      this._setSelectedState(true, false);
    }
  }

  /** Deselects the chip. */
  deselect(): void {
    if (this.selectable) {
      this._setSelectedState(false, false);
    }
  }

  /** Selects this chip and emits userInputSelection event */
  selectViaInteraction(): void {
    if (this.selectable) {
      this._setSelectedState(true, true);
    }
  }

  /** Toggles the current selected state of this chip. */
  toggleSelected(isUserInput: boolean = false): boolean {
    if (this.selectable) {
      this._setSelectedState(!this.selected, isUserInput);
    }

    return this.selected;
  }

  /** Allows for programmatic focusing of the chip. */
  focus(): void {
    if (this.disabled) {
      return;
    }

    if (!this._hasFocus()) {
      this.primaryAction.focus();
      this._onFocus.next({chip: this});
    }
    this._hasFocusInternal = true;
  }

  /** Resets the state of the chip when it loses focus. */
  _blur(): void {
    // When animations are enabled, Angular may end up removing the chip from the DOM a little
    // earlier than usual, causing it to be blurred and throwing off the logic in the chip list
    // that moves focus not the next item. To work around the issue, we defer marking the chip
    // as not focused until the next time the zone stabilizes.
    this._ngZone.onStable.pipe(take(1)).subscribe(() => {
      this._ngZone.run(() => {
        this._hasFocusInternal = false;
        this._onBlur.next({chip: this});
      });
    });
  }

  _hasLeadingGraphic() {
    // The checkmark graphic is built in for multi-select chip lists.
    return this.leadingIcon || this._chipListMultiple;
  }

  private _setSelectedState(isSelected: boolean, isUserInput: boolean) {
    if (isSelected !== this.selected) {
      this._chipFoundation.setActionSelected(MDCChipActionType.PRIMARY, isSelected);
      this.selectionChange.emit({
        source: this,
        isUserInput,
        selected: this.selected,
      });
    }
  }

  static ngAcceptInputType_selectable: BooleanInput;
  static ngAcceptInputType_selected: BooleanInput;
}
