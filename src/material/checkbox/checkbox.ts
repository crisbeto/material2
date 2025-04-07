/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {_IdGenerator, FocusableOption} from '@angular/cdk/a11y';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  booleanAttribute,
  numberAttribute,
  inject,
  HostAttributeToken,
  input,
  linkedSignal,
  computed,
  output,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NgControl,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import {
  MatRipple,
  _MatInternalFormField,
  _StructuralStylesLoader,
  _animationsDisabled,
} from '../core';
import {
  MAT_CHECKBOX_DEFAULT_OPTIONS,
  MAT_CHECKBOX_DEFAULT_OPTIONS_FACTORY,
  MatCheckboxDefaultOptions,
} from './checkbox-config';
import {_CdkPrivateStyleLoader} from '@angular/cdk/private';

/**
 * Represents the different states that require custom transitions between them.
 * @docs-private
 */
export enum TransitionCheckState {
  /** The initial state of the component before any user interaction. */
  Init,
  /** The state representing the component when it's becoming checked. */
  Checked,
  /** The state representing the component when it's becoming unchecked. */
  Unchecked,
  /** The state representing the component when it's becoming indeterminate. */
  Indeterminate,
}

/** Change event object emitted by checkbox. */
export class MatCheckboxChange {
  /** The source checkbox of the event. */
  source: MatCheckbox;
  /** The new `checked` value of the checkbox. */
  checked: boolean;
}

// Default checkbox configuration.
const defaults = MAT_CHECKBOX_DEFAULT_OPTIONS_FACTORY();

// Issues:
// - doesn't work with `exportAs`
// - circular DI error when CVA is provided. Need to use alternate syntax.
// - circular DI error when validator is provided. No way around as of yet.
// - there are some events that expose the MatCheckbox instance and won't be picked up by the facade.
export class MatCheckboxFacade {
  private _c = inject(MatCheckbox, {self: true});

  get checked(): boolean {
    return this._c._isChecked();
  }
  set checked(value: boolean) {
    this._c._isChecked.set(value);
  }

  get ariaLabel() {
    return this._c._ariaLabel();
  }

  set ariaLabel(value: string) {
    this._c._ariaLabel.set(value);
  }

  get ariaLabelledby(): string | null {
    return this._c._ariaLabelledby();
  }

  set ariaLabelledby(value: string) {
    this._c._ariaLabelledby.set(value);
  }

  get ariaDescribedby(): string | null {
    return this._c._ariaDescribedby();
  }

  set ariaDescribedby(value: string) {
    this._c._ariaDescribedby.set(value);
  }

  get ariaExpanded(): boolean | undefined {
    return this._c._ariaExpanded();
  }

  set ariaExpanded(value: boolean) {
    this._c._ariaExpanded.set(value);
  }

  get ariaControls(): string {
    return this._c._ariaControls();
  }

  set ariaControls(value: string) {
    this._c._ariaControls.set(value);
  }

  get ariaOwns(): string {
    return this._c._ariaOwns();
  }

  set ariaOwns(value: string) {
    this._c._ariaOwns.set(value);
  }

  get id(): string {
    return this._c._id();
  }

  set id(value: string) {
    this._c._id.set(value);
  }

  get required(): boolean {
    return this._c._isRequired();
  }

  set required(value: boolean) {
    this._c._isRequired.set(value);
  }

  get labelPosition(): 'before' | 'after' {
    return this._c._labelPosition();
  }

  set labelPosition(value: 'before' | 'after') {
    this._c._labelPosition.set(value);
  }

  get name(): string | null {
    return this._c._name();
  }

  set name(value: string | null) {
    this._c._name.set(value);
  }

  get disableRipple(): boolean {
    return this._c._disableRipple();
  }
  set disableRipple(value: boolean) {
    this._c._disableRipple.set(value);
  }

  get value(): string {
    return this._c._value();
  }

  set value(value: string) {
    this._c._value.set(value);
  }

  get tabIndex(): number {
    return this._c._tabIndex()!;
  }

  set tabIndex(value: number) {
    this._c._tabIndex.set(value);
  }

  get color(): string | undefined {
    return this._c._color();
  }

  set color(value: string | undefined) {
    this._c._color.set(value);
  }

  get disabled(): boolean {
    return this._c._disabled();
  }
  set disabled(value: boolean) {
    this._c._disabled.set(value);
  }

  get disabledInteractive(): boolean {
    return this._c._disabledInteractive();
  }
  set disabledInteractive(value: boolean) {
    this._c._disabledInteractive.set(value);
  }

  toggle() {
    this._c.toggle();
  }

  inputId() {
    return this._c.inputId;
  }
}

@Component({
  selector: 'mat-checkbox',
  templateUrl: 'checkbox.html',
  styleUrl: 'checkbox.css',
  host: {
    'class': 'mat-mdc-checkbox',
    '[attr.tabindex]': 'null',
    '[attr.aria-label]': 'null',
    '[attr.aria-labelledby]': 'null',
    '[class._mat-animation-noopable]': '_animationsDisabled',
    '[class.mdc-checkbox--disabled]': '_disabled()',
    '[id]': '_id()',
    // Add classes that users can use to more easily target disabled or checked checkboxes.
    '[class.mat-mdc-checkbox-disabled]': '_disabled()',
    '[class.mat-mdc-checkbox-checked]': '_isChecked()',
    '[class.mat-mdc-checkbox-disabled-interactive]': '_disabledInteractive()',
    '[class]': '_color() ? "mat-" + _color() : "mat-accent"',
  },
  providers: [
    {
      provide: MatCheckbox,
      useClass: MatCheckboxFacade,
    },
  ],
  exportAs: 'matCheckbox',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatRipple, _MatInternalFormField],
})
export class MatCheckbox
  implements AfterViewInit, OnChanges, ControlValueAccessor, Validator, FocusableOption
{
  readonly _isChecked = linkedSignal(() => this.checkedInput());
  readonly _ariaLabel = linkedSignal(() => this.ariaLabelInput());
  readonly _ariaLabelledby = linkedSignal(() => this.ariaLabelledbyInput());
  readonly _ariaDescribedby = linkedSignal(() => this.ariaDescribedbyInput());
  readonly _ariaExpanded = linkedSignal(() => this.ariaExpandedInput());
  readonly _ariaControls = linkedSignal(() => this.ariaControlsInput());
  readonly _ariaOwns = linkedSignal(() => this.ariaOwnsInput());
  readonly _id = linkedSignal(() => this.idInput() || this._uniqueId);
  readonly _isRequired = linkedSignal(() => this.requiredInput());
  readonly _labelPosition = linkedSignal(() => this.labelPositionInput());
  readonly _name = linkedSignal(() => this.nameInput());
  readonly _disableRipple = linkedSignal(() => this.disableRippleInput());
  readonly _value = linkedSignal(() => this.valueInput());
  readonly _tabIndex = linkedSignal(() => this.tabIndexInput());
  readonly _color = linkedSignal(() => this.colorInput());
  readonly _disabled = linkedSignal(() => this.disabledInput());
  readonly _disabledInteractive = linkedSignal(() => this.disabledInteractiveInput());

  _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _changeDetectorRef = inject(ChangeDetectorRef);
  private _ngZone = inject(NgZone);
  protected _animationsDisabled = _animationsDisabled();
  private _options = inject<MatCheckboxDefaultOptions>(MAT_CHECKBOX_DEFAULT_OPTIONS, {
    optional: true,
  });

  /** Focuses the checkbox. */
  focus() {
    this._inputElement.nativeElement.focus();
  }

  /** Creates the change event that will be emitted by the checkbox. */
  protected _createChangeEvent(isChecked: boolean) {
    const event = new MatCheckboxChange();
    event.source = this;
    event.checked = isChecked;
    return event;
  }

  /** Gets the element on which to add the animation CSS classes. */
  protected _getAnimationTargetElement() {
    return this._inputElement?.nativeElement;
  }

  /** CSS classes to add when transitioning between the different checkbox states. */
  protected _animationClasses = {
    uncheckedToChecked: 'mdc-checkbox--anim-unchecked-checked',
    uncheckedToIndeterminate: 'mdc-checkbox--anim-unchecked-indeterminate',
    checkedToUnchecked: 'mdc-checkbox--anim-checked-unchecked',
    checkedToIndeterminate: 'mdc-checkbox--anim-checked-indeterminate',
    indeterminateToChecked: 'mdc-checkbox--anim-indeterminate-checked',
    indeterminateToUnchecked: 'mdc-checkbox--anim-indeterminate-unchecked',
  };

  /**
   * Attached to the aria-label attribute of the host element. In most cases, aria-labelledby will
   * take precedence so this may be omitted.
   */
  ariaLabelInput = input('', {alias: 'aria-label'});

  /**
   * Users can specify the `aria-labelledby` attribute which will be forwarded to the input element
   */
  ariaLabelledbyInput = input<string | null>(null, {alias: 'aria-labelledby'});

  /** The 'aria-describedby' attribute is read after the element's label and field type. */
  ariaDescribedbyInput = input('', {alias: 'aria-describedby'});

  /**
   * Users can specify the `aria-expanded` attribute which will be forwarded to the input element
   */
  ariaExpandedInput = input<boolean | undefined, boolean | undefined>(undefined, {
    alias: 'aria-expanded',
    transform: booleanAttribute,
  });

  /**
   * Users can specify the `aria-controls` attribute which will be forwarded to the input element
   */
  ariaControlsInput = input('', {alias: 'aria-controls'});

  /** Users can specify the `aria-owns` attribute which will be forwarded to the input element */
  ariaOwnsInput = input('', {alias: 'aria-owns'});

  /** A unique id for the checkbox input. If none is supplied, it will be auto-generated. */
  idInput = input('', {alias: 'id'});

  /** Returns the unique id for the visual hidden input. */
  readonly inputId = computed(() => `${this._id()}-input`);

  private _uniqueId: string;

  /** Whether the checkbox is required. */
  requiredInput = input(false, {alias: 'required', transform: booleanAttribute});

  /** Whether the label should appear after or before the checkbox. Defaults to 'after' */
  labelPositionInput = input<'before' | 'after'>('after', {alias: 'labelPosition'});

  /** Name value will be applied to the input element if present */
  nameInput = input<string | null>(null, {alias: 'name'});

  /** Event emitted when the checkbox's `checked` value changes. */
  readonly change = output<MatCheckboxChange>();

  /** Event emitted when the checkbox's `indeterminate` value changes. */
  readonly indeterminateChange = output<boolean>();

  /** The value attribute of the native input element */
  valueInput = input('', {alias: 'value'});

  /** Whether the checkbox has a ripple. */
  disableRippleInput = input(false, {alias: 'disableRipple', transform: booleanAttribute});

  /** The native `<input type="checkbox">` element */
  @ViewChild('input') _inputElement: ElementRef<HTMLInputElement>;

  /** The native `<label>` element */
  @ViewChild('label') _labelElement: ElementRef<HTMLInputElement>;

  /** Tabindex for the checkbox. */
  tabIndexInput = input<number | undefined, number | undefined>(undefined, {
    alias: 'tabIndex',
    transform: (value: unknown) => (value == null ? undefined : numberAttribute(value)),
  });

  // TODO(crisbeto): this should be a ThemePalette, but some internal apps were abusing
  // the lack of type checking previously and assigning random strings.
  /**
   * Theme color of the checkbox. This API is supported in M2 themes only, it
   * has no effect in M3 themes. For color customization in M3, see https://material.angular.io/components/checkbox/styling.
   *
   * For information on applying color variants in M3, see
   * https://material.angular.io/guide/material-2-theming#optional-add-backwards-compatibility-styles-for-color-variants
   */
  colorInput = input<string | undefined>(undefined, {alias: 'color'});

  /** Whether the checkbox should remain interactive when it is disabled. */
  disabledInteractiveInput = input(false, {
    alias: 'disabledInteractive',
    transform: booleanAttribute,
  });

  /**
   * Called when the checkbox is blurred. Needed to properly implement ControlValueAccessor.
   * @docs-private
   */
  _onTouched: () => any = () => {};

  private _currentAnimationClass: string = '';
  private _currentCheckState: TransitionCheckState = TransitionCheckState.Init;
  private _controlValueAccessorChangeFn: (value: any) => void = () => {};
  private _validatorChangeFn = () => {};

  constructor(...args: unknown[]);

  constructor() {
    inject(_CdkPrivateStyleLoader).load(_StructuralStylesLoader);
    const tabIndex = inject(new HostAttributeToken('tabindex'), {optional: true});
    const ngControl = inject(NgControl, {optional: true});

    if (ngControl) {
      ngControl.valueAccessor = this;
    }

    this._options = this._options || defaults;
    this._color.set(this._options.color || defaults.color);
    this._tabIndex.set(tabIndex == null ? 0 : parseInt(tabIndex) || 0);
    this._uniqueId = inject(_IdGenerator).getId('mat-mdc-checkbox-');
    this._disabledInteractive.set(this._options?.disabledInteractive ?? false);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['required']) {
      this._validatorChangeFn();
    }
  }

  ngAfterViewInit() {
    this._syncIndeterminate(this._indeterminate);
  }

  /** Whether the checkbox is checked. */
  readonly checkedInput = input(false, {transform: booleanAttribute, alias: 'checked'});

  /** Whether the checkbox is disabled. */
  disabledInput = input(false, {alias: 'disabled', transform: booleanAttribute});

  // TODO: this can be converted to signals too, but will
  // need more refactors so leaving it out of the POC.
  /**
   * Whether the checkbox is indeterminate. This is also known as "mixed" mode and can be used to
   * represent a checkbox with three states, e.g. a checkbox that represents a nested list of
   * checkable items. Note that whenever checkbox is manually clicked, indeterminate is immediately
   * set to false.
   */
  @Input({transform: booleanAttribute})
  get indeterminate(): boolean {
    return this._indeterminate;
  }
  set indeterminate(value: boolean) {
    const changed = value != this._indeterminate;
    this._indeterminate = value;

    if (changed) {
      if (this._indeterminate) {
        this._transitionCheckState(TransitionCheckState.Indeterminate);
      } else {
        this._transitionCheckState(
          this._isChecked() ? TransitionCheckState.Checked : TransitionCheckState.Unchecked,
        );
      }
      this.indeterminateChange.emit(this._indeterminate);
    }

    this._syncIndeterminate(this._indeterminate);
  }
  private _indeterminate: boolean = false;

  _isRippleDisabled() {
    return this._disableRipple() || this._disabled();
  }

  /** Method being called whenever the label text changes. */
  _onLabelTextChange() {
    // Since the event of the `cdkObserveContent` directive runs outside of the zone, the checkbox
    // component will be only marked for check, but no actual change detection runs automatically.
    // Instead of going back into the zone in order to trigger a change detection which causes
    // *all* components to be checked (if explicitly marked or not using OnPush), we only trigger
    // an explicit change detection for the checkbox view and its children.
    this._changeDetectorRef.detectChanges();
  }

  // Implemented as part of ControlValueAccessor.
  writeValue(value: any) {
    this._isChecked.set(!!value);
  }

  // Implemented as part of ControlValueAccessor.
  registerOnChange(fn: (value: any) => void) {
    this._controlValueAccessorChangeFn = fn;
  }

  // Implemented as part of ControlValueAccessor.
  registerOnTouched(fn: any) {
    this._onTouched = fn;
  }

  // Implemented as part of ControlValueAccessor.
  setDisabledState(isDisabled: boolean) {
    this._disabled.set(isDisabled);
  }

  // Implemented as a part of Validator.
  validate(control: AbstractControl<boolean>): ValidationErrors | null {
    return this._isRequired() && control.value !== true ? {'required': true} : null;
  }

  // Implemented as a part of Validator.
  registerOnValidatorChange(fn: () => void): void {
    this._validatorChangeFn = fn;
  }

  private _transitionCheckState(newState: TransitionCheckState) {
    let oldState = this._currentCheckState;
    let element = this._getAnimationTargetElement();

    if (oldState === newState || !element) {
      return;
    }
    if (this._currentAnimationClass) {
      element.classList.remove(this._currentAnimationClass);
    }

    this._currentAnimationClass = this._getAnimationClassForCheckStateTransition(
      oldState,
      newState,
    );
    this._currentCheckState = newState;

    if (this._currentAnimationClass.length > 0) {
      element.classList.add(this._currentAnimationClass);

      // Remove the animation class to avoid animation when the checkbox is moved between containers
      const animationClass = this._currentAnimationClass;

      this._ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          element!.classList.remove(animationClass);
        }, 1000);
      });
    }
  }

  private _emitChangeEvent() {
    this._controlValueAccessorChangeFn(this._isChecked());
    this.change.emit(this._createChangeEvent(this._isChecked()));

    // Assigning the value again here is redundant, but we have to do it in case it was
    // changed inside the `change` listener which will cause the input to be out of sync.
    if (this._inputElement) {
      this._inputElement.nativeElement.checked = this._isChecked();
    }
  }

  /** Toggles the `checked` state of the checkbox. */
  toggle(): void {
    this._isChecked.set(!this._isChecked());
    this._controlValueAccessorChangeFn(this._isChecked());
  }

  protected _handleInputClick() {
    const clickAction = this._options?.clickAction;

    // If resetIndeterminate is false, and the current state is indeterminate, do nothing on click
    if (!this._disabled() && clickAction !== 'noop') {
      // When user manually click on the checkbox, `indeterminate` is set to false.
      if (this.indeterminate && clickAction !== 'check') {
        Promise.resolve().then(() => {
          this._indeterminate = false;
          this.indeterminateChange.emit(this._indeterminate);
        });
      }

      this._isChecked.set(!this._isChecked());
      this._transitionCheckState(
        this._isChecked() ? TransitionCheckState.Checked : TransitionCheckState.Unchecked,
      );

      // Emit our custom change event if the native input emitted one.
      // It is important to only emit it, if the native input triggered one, because
      // we don't want to trigger a change event, when the `checked` variable changes for example.
      this._emitChangeEvent();
    } else if (
      (this._disabled() && this._disabledInteractive()) ||
      (!this._disabled() && clickAction === 'noop')
    ) {
      // Reset native input when clicked with noop. The native checkbox becomes checked after
      // click, reset it to be align with `checked` value of `mat-checkbox`.
      this._inputElement.nativeElement.checked = this._isChecked();
      this._inputElement.nativeElement.indeterminate = this.indeterminate;
    }
  }

  _onInteractionEvent(event: Event) {
    // We always have to stop propagation on the change event.
    // Otherwise the change event, from the input element, will bubble up and
    // emit its event object to the `change` output.
    event.stopPropagation();
  }

  _onBlur() {
    // When a focused element becomes disabled, the browser *immediately* fires a blur event.
    // Angular does not expect events to be raised during change detection, so any state change
    // (such as a form control's 'ng-touched') will cause a changed-after-checked error.
    // See https://github.com/angular/angular/issues/17793. To work around this, we defer
    // telling the form control it has been touched until the next tick.
    Promise.resolve().then(() => {
      this._onTouched();
      this._changeDetectorRef.markForCheck();
    });
  }

  private _getAnimationClassForCheckStateTransition(
    oldState: TransitionCheckState,
    newState: TransitionCheckState,
  ): string {
    // Don't transition if animations are disabled.
    if (this._animationsDisabled) {
      return '';
    }

    switch (oldState) {
      case TransitionCheckState.Init:
        // Handle edge case where user interacts with checkbox that does not have [(ngModel)] or
        // [checked] bound to it.
        if (newState === TransitionCheckState.Checked) {
          return this._animationClasses.uncheckedToChecked;
        } else if (newState == TransitionCheckState.Indeterminate) {
          return this._isChecked()
            ? this._animationClasses.checkedToIndeterminate
            : this._animationClasses.uncheckedToIndeterminate;
        }
        break;
      case TransitionCheckState.Unchecked:
        return newState === TransitionCheckState.Checked
          ? this._animationClasses.uncheckedToChecked
          : this._animationClasses.uncheckedToIndeterminate;
      case TransitionCheckState.Checked:
        return newState === TransitionCheckState.Unchecked
          ? this._animationClasses.checkedToUnchecked
          : this._animationClasses.checkedToIndeterminate;
      case TransitionCheckState.Indeterminate:
        return newState === TransitionCheckState.Checked
          ? this._animationClasses.indeterminateToChecked
          : this._animationClasses.indeterminateToUnchecked;
    }

    return '';
  }

  /**
   * Syncs the indeterminate value with the checkbox DOM node.
   *
   * We sync `indeterminate` directly on the DOM node, because in Ivy the check for whether a
   * property is supported on an element boils down to `if (propName in element)`. Domino's
   * HTMLInputElement doesn't have an `indeterminate` property so Ivy will warn during
   * server-side rendering.
   */
  private _syncIndeterminate(value: boolean) {
    const nativeCheckbox = this._inputElement;

    if (nativeCheckbox) {
      nativeCheckbox.nativeElement.indeterminate = value;
    }
  }

  _onInputClick() {
    this._handleInputClick();
  }

  _onTouchTargetClick() {
    this._handleInputClick();

    if (!this._disabled()) {
      // Normally the input should be focused already, but if the click
      // comes from the touch target, then we might have to focus it ourselves.
      this._inputElement.nativeElement.focus();
    }
  }

  /**
   *  Prevent click events that come from the `<label/>` element from bubbling. This prevents the
   *  click handler on the host from triggering twice when clicking on the `<label/>` element. After
   *  the click event on the `<label/>` propagates, the browsers dispatches click on the associated
   *  `<input/>`. By preventing clicks on the label by bubbling, we ensure only one click event
   *  bubbles when the label is clicked.
   */
  _preventBubblingFromLabel(event: MouseEvent) {
    if (!!event.target && this._labelElement.nativeElement.contains(event.target as HTMLElement)) {
      event.stopPropagation();
    }
  }
}
