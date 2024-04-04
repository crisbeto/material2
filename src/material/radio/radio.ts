/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Directive,
  ElementRef,
  forwardRef,
  Inject,
  InjectionToken,
  numberAttribute,
  OnDestroy,
  Optional,
  ViewEncapsulation,
  ANIMATION_MODULE_TYPE,
  output,
  input,
  computed,
  HostAttributeToken,
  inject,
  viewChild,
  model,
  signal,
  effect,
} from '@angular/core';
import {_MatInternalFormField, MatRipple, ThemePalette} from '@angular/material/core';
import {FocusMonitor, FocusOrigin} from '@angular/cdk/a11y';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

// Increasing integer for generating unique ids for radio components.
let nextUniqueId = 0;

/** Change event object emitted by radio button and radio group. */
export class MatRadioChange {
  constructor(
    /** The radio button that emits the change event. */
    public source: MatRadioButton,
    /** The value of the radio button. */
    public value: any,
  ) {}
}

/**
 * Provider Expression that allows mat-radio-group to register as a ControlValueAccessor. This
 * allows it to support [(ngModel)] and ngControl.
 * @docs-private
 */
export const MAT_RADIO_GROUP_CONTROL_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatRadioGroup),
  multi: true,
};

/**
 * Injection token that can be used to inject instances of `MatRadioGroup`. It serves as
 * alternative token to the actual `MatRadioGroup` class which could cause unnecessary
 * retention of the class and its component metadata.
 */
export const MAT_RADIO_GROUP = new InjectionToken<MatRadioGroup>('MatRadioGroup');

export interface MatRadioDefaultOptions {
  color: ThemePalette;
}

export const MAT_RADIO_DEFAULT_OPTIONS = new InjectionToken<MatRadioDefaultOptions>(
  'mat-radio-default-options',
  {
    providedIn: 'root',
    factory: MAT_RADIO_DEFAULT_OPTIONS_FACTORY,
  },
);

export function MAT_RADIO_DEFAULT_OPTIONS_FACTORY(): MatRadioDefaultOptions {
  return {
    color: 'accent',
  };
}

/**
 * A group of radio buttons. May contain one or more `<mat-radio-button>` elements.
 */
@Directive({
  selector: 'mat-radio-group',
  exportAs: 'matRadioGroup',
  providers: [
    MAT_RADIO_GROUP_CONTROL_VALUE_ACCESSOR,
    {provide: MAT_RADIO_GROUP, useExisting: MatRadioGroup},
  ],
  host: {
    'role': 'radiogroup',
    'class': 'mat-mdc-radio-group',
  },
  standalone: true,
})
export class MatRadioGroup implements ControlValueAccessor {
  /** The method to be called in order to update ngModel */
  _controlValueAccessorChangeFn: (value: any) => void = () => {};

  /**
   * onTouch function registered via registerOnTouch (ControlValueAccessor).
   * @docs-private
   */
  onTouched: () => any = () => {};

  /**
   * Event emitted when the group value changes.
   * Change events are only emitted when the value changes due to user interaction with
   * a radio button (the same behavior as `<input type-"radio">`).
   */
  readonly change = output<MatRadioChange>();

  /** Theme color for all of the radio buttons in the group. */
  readonly color = input<ThemePalette>();

  /** Name of the radio button group. All radio buttons inside this group will use this name. */
  readonly name = input(`mat-radio-group-${nextUniqueId++}`);

  /** Whether the labels should appear after or before the radio-buttons. Defaults to 'after' */
  readonly labelPosition = input<'before' | 'after'>('after');

  /**
   * Value for the radio-group. Should equal the value of the selected radio button if there is
   * a corresponding radio button with a matching value. If there is not such a corresponding
   * radio button, this value persists to be applied in case a new radio button is added with a
   * matching value.
   */
  readonly value = model<any>();

  /**
   * The currently selected radio button. If set to a new radio button, the radio group value
   * will be updated to match the new selected button.
   */
  readonly selected = input<MatRadioButton | null>();

  /** Whether the radio group is disabled */
  readonly disabled = input(false, {transform: booleanAttribute});
  private _cvaDisabled = signal(false);
  _internalDisabled = computed(() => {
    return this.disabled() || this._cvaDisabled();
  });

  /** Whether the radio group is required */
  readonly required = input(false, {transform: booleanAttribute});

  constructor(private _changeDetector: ChangeDetectorRef) {
    effect(
      () => {
        const selected = this.selected();
        if (selected) {
          this.value.set(selected ? selected.value() : null);
        }
      },
      {allowSignalWrites: true},
    );
  }

  /**
   * Mark this group as being "touched" (for ngModel). Meant to be called by the contained
   * radio buttons upon their blur.
   */
  _touch() {
    if (this.onTouched) {
      this.onTouched();
    }
  }

  /** Dispatch change event with current selection and group value. */
  _emitChangeEvent(): void {
    this.change.emit(new MatRadioChange(this.selected()!, this.value()));
  }

  /**
   * Sets the model value. Implemented as part of ControlValueAccessor.
   * @param value
   */
  writeValue(value: any) {
    this.value.set(value);
    this._changeDetector.markForCheck();
  }

  /**
   * Registers a callback to be triggered when the model value changes.
   * Implemented as part of ControlValueAccessor.
   * @param fn Callback to be registered.
   */
  registerOnChange(fn: (value: any) => void) {
    this._controlValueAccessorChangeFn = fn;
  }

  /**
   * Registers a callback to be triggered when the control is touched.
   * Implemented as part of ControlValueAccessor.
   * @param fn Callback to be registered.
   */
  registerOnTouched(fn: any) {
    this.onTouched = fn;
  }

  /**
   * Sets the disabled state of the control. Implemented as a part of ControlValueAccessor.
   * @param isDisabled Whether the control should be disabled.
   */
  setDisabledState(isDisabled: boolean) {
    this._cvaDisabled.set(isDisabled);
    this._changeDetector.markForCheck();
  }
}

@Component({
  selector: 'mat-radio-button',
  templateUrl: 'radio.html',
  styleUrl: 'radio.css',
  host: {
    'class': 'mat-mdc-radio-button',
    '[attr.id]': 'id()',
    '[class.mat-primary]': 'color() === "primary"',
    '[class.mat-accent]': 'color() === "accent"',
    '[class.mat-warn]': 'color() === "warn"',
    '[class.mat-mdc-radio-checked]': '_isChecked()',
    '[class._mat-animation-noopable]': '_noopAnimations',
    // Needs to be removed since it causes some a11y issues (see #21266).
    '[attr.tabindex]': 'null',
    '[attr.aria-label]': 'null',
    '[attr.aria-labelledby]': 'null',
    '[attr.aria-describedby]': 'null',
    // Note: under normal conditions focus shouldn't land on this element, however it may be
    // programmatically set, for example inside of a focus trap, in this case we want to forward
    // the focus to the native element.
    '(focus)': '_inputElement().nativeElement.focus()',
  },
  exportAs: 'matRadioButton',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatRipple, _MatInternalFormField],
})
export class MatRadioButton implements AfterViewInit, OnDestroy {
  private _uniqueId: string = `mat-radio-${++nextUniqueId}`;
  private _initialTabIndex = inject(new HostAttributeToken('tabindex'), {optional: true});

  /** The unique ID for the radio button. */
  readonly id = input(this._uniqueId);

  /** Analog to HTML 'name' attribute used to group radios for unique selection. */
  readonly name = input<string>();
  protected _internalName = computed(() => {
    return this.name() || this.radioGroup?.name();
  });

  /** Used to set the 'aria-label' attribute on the underlying input element. */
  readonly ariaLabel = input<string | undefined>(undefined, {alias: 'aria-label'});

  /** The 'aria-labelledby' attribute takes precedence as the element's text alternative. */
  readonly ariaLabelledby = input<string | undefined>(undefined, {alias: 'aria-labelledby'});

  /** The 'aria-describedby' attribute is read after the element's label and field type. */
  readonly ariaDescribedby = input<string | undefined>(undefined, {alias: 'aria-describedby'});

  /** Whether ripples are disabled inside the radio button */
  readonly disableRipple = input(false, {transform: booleanAttribute});

  /** Tabindex of the radio button. */
  readonly tabIndex = input(numberAttribute(this._initialTabIndex, 0), {
    transform: (value: unknown) => (value == null ? 0 : numberAttribute(value)),
  });

  /** Whether this radio button is checked. */
  readonly checked = input(undefined, {transform: booleanAttribute});
  protected _isChecked = computed(() => {
    const isChecked = this.checked();
    const matchesRadioValue = this.radioGroup ? this.radioGroup.value() === this.value() : false;
    return isChecked ?? matchesRadioValue;
  });

  /** The value of this radio button. */
  readonly value = input<any>();

  /** Whether the label should appear after or before the radio button. Defaults to 'after' */
  readonly labelPosition = input<'before' | 'after'>();
  protected _internalLabelPosition = computed(() => {
    return this.labelPosition() || this.radioGroup?.labelPosition();
  });

  /** Whether the radio button is disabled. */
  readonly disabled = input(false, {transform: booleanAttribute});
  protected _internalDisabled = computed(() => {
    return this.disabled() || this.radioGroup?._internalDisabled();
  });

  /** Whether the radio button is required. */
  readonly required = input(false, {transform: booleanAttribute});
  protected _internalRequired = computed(() => {
    return this.radioGroup?.required() || this.required();
  });

  /** Theme color of the radio button. */
  readonly color = input<ThemePalette>();
  protected _internalColor = computed(() => {
    return this.color() || this.radioGroup?.color() || this._providerOverride?.color || 'accent';
  });

  /**
   * Event emitted when the checked state of this radio button changes.
   * Change events are only emitted when the value changes due to user interaction with
   * the radio button (the same behavior as `<input type-"radio">`).
   */
  readonly change = output<MatRadioChange>();

  /** ID of the native input element inside `<mat-radio-button>` */
  readonly inputId = computed(() => {
    return `${this.id() || this._uniqueId}-input`;
  });

  /** Unregister function for _radioDispatcher */
  private _removeUniqueSelectionListener: () => void = () => {};

  /** The native `<input type=radio>` element */
  readonly _inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** Trigger elements for the ripple events. */
  readonly _rippleTrigger = viewChild.required('formField', {
    read: ElementRef<HTMLElement>,
  });

  /** Whether animations are disabled. */
  _noopAnimations: boolean;

  constructor(
    @Optional() @Inject(MAT_RADIO_GROUP) readonly radioGroup: MatRadioGroup | null,
    protected _elementRef: ElementRef,
    private _focusMonitor: FocusMonitor,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
    @Optional()
    @Inject(MAT_RADIO_DEFAULT_OPTIONS)
    private _providerOverride?: MatRadioDefaultOptions,
  ) {
    this._noopAnimations = animationMode === 'NoopAnimations';
  }

  /** Focuses the radio button. */
  focus(options?: FocusOptions, origin?: FocusOrigin): void {
    if (origin) {
      this._focusMonitor.focusVia(this._inputElement(), origin, options);
    } else {
      this._inputElement().nativeElement.focus(options);
    }
  }

  ngAfterViewInit() {
    this._focusMonitor.monitor(this._elementRef, true).subscribe(focusOrigin => {
      if (!focusOrigin && this.radioGroup) {
        this.radioGroup._touch();
      }
    });
  }

  ngOnDestroy() {
    this._focusMonitor.stopMonitoring(this._elementRef);
    this._removeUniqueSelectionListener();
  }

  /** Dispatch change event with current value. */
  private _emitChangeEvent(): void {
    this.change.emit(new MatRadioChange(this, this.value()));
  }

  protected _isRippleDisabled = computed(() => {
    return this.disableRipple() || this._internalDisabled() || false;
  });

  _onInputClick(event: Event) {
    // We have to stop propagation for click events on the visual hidden input element.
    // By default, when a user clicks on a label element, a generated click event will be
    // dispatched on the associated input element. Since we are using a label element as our
    // root container, the click event on the `radio-button` will be executed twice.
    // The real click event will bubble up, and the generated click event also tries to bubble up.
    // This will lead to multiple click events.
    // Preventing bubbling for the second event will solve that issue.
    event.stopPropagation();
  }

  /** Triggered when the radio button receives an interaction from the user. */
  _onInputInteraction(event: Event) {
    // We always have to stop propagation on the change event.
    // Otherwise the change event, from the input element, will bubble up and
    // emit its event object to the `change` output.
    event.stopPropagation();

    if (!this._isChecked() && !this.disabled()) {
      const groupValueChanged = this.radioGroup && this.value() !== this.radioGroup.value();
      this.radioGroup?.value.set(this.value());
      this._emitChangeEvent();

      if (this.radioGroup) {
        this.radioGroup._controlValueAccessorChangeFn(this.value());
        if (groupValueChanged) {
          this.radioGroup._emitChangeEvent();
        }
      }
    }
  }

  /** Triggered when the user clicks on the touch target. */
  _onTouchTargetClick(event: Event) {
    this._onInputInteraction(event);

    if (!this.disabled) {
      // Normally the input should be focused already, but if the click
      // comes from the touch target, then we might have to focus it ourselves.
      this._inputElement().nativeElement.focus();
    }
  }

  protected _internalTabIndex = computed(() => {
    const group = this.radioGroup;

    // Implement a roving tabindex if the button is inside a group. For most cases this isn't
    // necessary, because the browser handles the tab order for inputs inside a group automatically,
    // but we need an explicitly higher tabindex for the selected button in order for things like
    // the focus trap to pick it up correctly.
    if (!group || !group.selected() || this.disabled()) {
      return this.tabIndex();
    }

    return this._isChecked() ? this.tabIndex : -1;
  });
}
