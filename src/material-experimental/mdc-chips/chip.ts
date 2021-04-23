/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directionality} from '@angular/cdk/bidi';
import {BooleanInput, coerceBooleanProperty, NumberInput} from '@angular/cdk/coercion';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {
  AfterContentInit,
  AfterViewInit,
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ContentChild,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  Optional,
  Output,
  ViewEncapsulation,
  ViewChild,
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {
  CanColor,
  CanColorCtor,
  CanDisable,
  CanDisableRipple,
  CanDisableRippleCtor,
  HasTabIndex,
  HasTabIndexCtor,
  MatRipple,
  MAT_RIPPLE_GLOBAL_OPTIONS,
  mixinColor,
  mixinDisableRipple,
  mixinTabIndex,
  RippleAnimationConfig,
  RippleGlobalOptions,
} from '@angular/material-experimental/mdc-core';
import {MDCChipFoundation, MDCChipAdapter} from '@material/chips/chip';
import {ActionType, FocusBehavior, MDCChipActionFoundation} from '@material/chips/action';
import {numbers} from '@material/ripple';
import {SPACE, ENTER, hasModifierKey} from '@angular/cdk/keycodes';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {
  MatChipAvatar,
  MatChipTrailingIcon,
  MatChipRemove,
  MAT_CHIP_AVATAR,
  MAT_CHIP_TRAILING_ICON, MAT_CHIP_REMOVE
} from './chip-icons';
import {emitCustomEvent} from './emit-event';
import {MatChipAction} from './chip-action';


let uid = 0;

/** Represents an event fired on an individual `mat-chip`. */
export interface MatChipEvent {
  /** The chip the event was fired on. */
  chip: MatChip;
}

/** Configuration for the ripple animation. */
const RIPPLE_ANIMATION_CONFIG: RippleAnimationConfig = {
  enterDuration: numbers.DEACTIVATION_TIMEOUT_MS,
  exitDuration: numbers.FG_DEACTIVATION_MS
};

/**
 * Directive to add MDC CSS to non-basic chips.
 * @docs-private
 */
@Directive({
  selector: `mat-chip, mat-chip-option, mat-chip-row, [mat-chip], [mat-chip-option],
    [mat-chip-row]`,
  host: {'class': 'mat-mdc-chip mdc-chip'}
})
export class MatChipCssInternalOnly { }

/**
 * Boilerplate for applying mixins to MatChip.
 * @docs-private
 */
class MatChipBase {
  constructor(public _elementRef: ElementRef) {}
}

const _MatChipMixinBase:
  CanColorCtor &
  CanDisableRippleCtor &
  HasTabIndexCtor &
  typeof MatChipBase =
    mixinTabIndex(mixinColor(mixinDisableRipple(MatChipBase), 'primary'), -1);

/**
 * Material design styled Chip base component. Used inside the MatChipSet component.
 *
 * Extended by MatChipOption and MatChipRow for different interaction patterns.
 */
@Component({
  selector: 'mat-basic-chip, mat-chip',
  inputs: ['color', 'disableRipple'],
  exportAs: 'matChip',
  templateUrl: 'chip.html',
  styleUrls: ['chips.css'],
  host: {
    '[class.mat-mdc-chip-disabled]': 'disabled',
    '[class.mat-mdc-chip-highlighted]': 'highlighted',
    '[class.mat-mdc-chip-with-avatar]': 'leadingIcon',
    '[class.mat-mdc-chip-with-trailing-icon]': 'trailingIcon || removeIcon',
    '[class.mat-mdc-basic-chip]': '_isBasicChip',
    '[class.mat-mdc-standard-chip]': '!_isBasicChip',
    '[class._mat-animation-noopable]': '_animationsDisabled',
    '[id]': 'id',
    '[attr.disabled]': 'disabled || null',
    '[attr.aria-disabled]': 'disabled.toString()',
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatChip extends _MatChipMixinBase implements AfterContentInit, AfterViewInit,
  CanColor, CanDisableRipple, CanDisable, HasTabIndex, OnDestroy {
  protected _document: Document;

  /** The ripple animation configuration to use for the chip. */
  readonly _rippleAnimation: RippleAnimationConfig = RIPPLE_ANIMATION_CONFIG;

  /** Whether the ripple is centered on the chip. */
  readonly _isRippleCentered = false;

  /** Emits when the chip is focused. */
  readonly _onFocus = new Subject<MatChipEvent>();

  /** Emits when the chip is blurred. */
  readonly _onBlur = new Subject<MatChipEvent>();

  readonly REMOVE_ICON_HANDLED_KEYS: ReadonlySet<number> = new Set([SPACE, ENTER]);

  /** Whether this chip is a basic (unstyled) chip. */
  readonly _isBasicChip: boolean;

  /** Whether the chip has focus. */
  protected _hasFocusInternal = false;

    /** Whether animations for the chip are enabled. */
  _animationsDisabled: boolean;

  // We have to use a `HostListener` here in order to support both Ivy and ViewEngine.
  // In Ivy the `host` bindings will be merged when this class is extended, whereas in
  // ViewEngine they're overwritten.
  // TODO(mmalerba): we move this back into `host` once Ivy is turned on by default.
  // tslint:disable-next-line:no-host-decorator-in-concrete
  @HostListener('transitionend', ['$event'])
  _handleTransitionEnd(event: TransitionEvent) {
    this._chipFoundation.handleTransitionEnd(event);
  }

  _hasFocus() {
    return this._hasFocusInternal;
  }

  /** Default unique id for the chip. */
  private _uniqueId = `mat-mdc-chip-${uid++}`;

  /** A unique id for the chip. If none is supplied, it will be auto-generated. */
  @Input() id: string = this._uniqueId;


  @Input()
  get disabled(): boolean { return this._disabled; }
  set disabled(value: boolean) {
    this._disabled = coerceBooleanProperty(value);
    if (this.removeIcon) {
      this.removeIcon.disabled = value;
    }
  }
  protected _disabled: boolean = false;

  private _textElement!: HTMLElement;

  /** The value of the chip. Defaults to the content inside the mdc-chip__text element. */
  @Input()
  get value(): any {
    return this._value !== undefined
      ? this._value
      : this._textElement.textContent!.trim();
  }
  set value(value: any) { this._value = value; }
  protected _value: any;

  /**
   * Determines whether or not the chip displays the remove styling and emits (removed) events.
   */
  @Input()
  get removable(): boolean { return this._removable; }
  set removable(value: boolean) {
    this._removable = coerceBooleanProperty(value);
  }
  protected _removable: boolean = true;

  /**
   * Colors the chip for emphasis as if it were selected.
   */
  @Input()
  get highlighted(): boolean { return this._highlighted; }
  set highlighted(value: boolean) {
    this._highlighted = coerceBooleanProperty(value);
  }
  protected _highlighted: boolean = false;

  /** Emitted when the user interacts with the chip. */
  @Output() readonly interaction = new EventEmitter<string>();

  /** Emitted when the chip is destroyed. */
  @Output() readonly destroyed: EventEmitter<MatChipEvent> = new EventEmitter<MatChipEvent>();

  /** Emitted when a chip is to be removed. */
  @Output() readonly removed: EventEmitter<MatChipEvent> = new EventEmitter<MatChipEvent>();

  /** The MDC foundation containing business logic for MDC chip. */
  _chipFoundation: MDCChipFoundation;

  /** The unstyled chip selector for this component. */
  protected basicChipAttrName = 'mat-basic-chip';

  /** The chip's leading icon. */
  @ContentChild(MAT_CHIP_AVATAR) leadingIcon: MatChipAvatar;

  /** The chip's trailing icon. */
  @ContentChild(MAT_CHIP_TRAILING_ICON) trailingIcon: MatChipTrailingIcon;

  /** The chip's trailing remove icon. */
  @ContentChild(MAT_CHIP_REMOVE) removeIcon: MatChipRemove;

  /** Reference to the MatRipple instance of the chip. */
  @ViewChild(MatRipple) ripple: MatRipple;

  // TODO: figure out where this comes from.
  primaryAction: MatChipAction;

 /**
  * Implementation of the MDC chip adapter interface.
  * These methods are called by the chip foundation.
  */
  protected _chipAdapter: MDCChipAdapter = {
    addClass: className => this._setMdcClass(className, true),
    removeClass: className => this._setMdcClass(className, false),
    hasClass: className => this._elementRef.nativeElement.classList.contains(className),
    emitEvent: <T>(eventName: string, data: T) => {
      emitCustomEvent(this._elementRef.nativeElement, this._document, eventName, data, false);
    },
    setStyleProperty: (propertyName: string, value: string) => {
      this._elementRef.nativeElement.style.setProperty(propertyName, value);
    },
    isRTL: () => !!this._dir && this._dir.value === 'rtl',
    getAttribute: attributeName => this._elementRef.nativeElement.getAttribute(attributeName),
    getElementID: () => this._elementRef.nativeElement.id,
    getOffsetWidth: () => this._elementRef.nativeElement.offsetWidth,
    getActions: () => {
      const result: ActionType[] = [];

      if (this._getAction(ActionType.PRIMARY)) {
        result.push(ActionType.PRIMARY);
      }

      if (this._getAction(ActionType.TRAILING)) {
        result.push(ActionType.TRAILING);
      }

      return result;
    },
    isActionSelectable: (action: ActionType) => {
      return this._getAction(action)?.isSelectable() || false;
    },
    isActionSelected: (action: ActionType) => {
      return this._getAction(action)?.isSelected() || false;
    },
    isActionDisabled: (action: ActionType) => {
      return this._getAction(action)?.isDisabled() || false;
    },
    isActionFocusable: (action: ActionType) => {
      return this._getAction(action)?.isFocusable() || false;
    },
    setActionSelected: (action: ActionType, isSelected: boolean) => {
      this._getAction(action)?.setSelected(isSelected);
    },
    setActionDisabled: (action: ActionType, isDisabled: boolean) => {
      this._getAction(action)?.setDisabled(isDisabled);
    },
    setActionFocus: (action: ActionType, behavior: FocusBehavior) => {
      this._getAction(action)?.setFocus(behavior);
    }
  };

  constructor(
      public _changeDetectorRef: ChangeDetectorRef,
      readonly _elementRef: ElementRef<HTMLElement>,
      protected _ngZone: NgZone,
      @Inject(DOCUMENT) _document: any,
      @Optional() private _dir: Directionality,
      @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
      @Optional() @Inject(MAT_RIPPLE_GLOBAL_OPTIONS)
        private _globalRippleOptions?: RippleGlobalOptions) {
    super(_elementRef);
    this._document = _document;
    this._chipFoundation = new MDCChipFoundation(this._chipAdapter);
    this._animationsDisabled = animationMode === 'NoopAnimations';
    this._isBasicChip = _elementRef.nativeElement.hasAttribute(this.basicChipAttrName) ||
                        _elementRef.nativeElement.tagName.toLowerCase() === this.basicChipAttrName;
  }

  ngAfterContentInit() {
    this._initRemoveIcon();
  }

  ngAfterViewInit() {
    this._chipFoundation.init();
    this._textElement = this._elementRef.nativeElement.querySelector('.mdc-chip__text');
  }

  ngOnDestroy() {
    this.destroyed.emit({chip: this});
    this._chipFoundation.destroy();
  }

  /** Sets up the remove icon chip foundation, and subscribes to remove icon events. */
  private _initRemoveIcon() {
    if (this.removeIcon) {
      this._chipFoundation.setShouldRemoveOnTrailingIconClick(true);
      this.removeIcon.disabled = this.disabled;

      this.removeIcon.interaction
        .pipe(takeUntil(this.destroyed))
        .subscribe(event => {
          // The MDC chip foundation calls stopPropagation() for any trailing icon interaction
          // event, even ones it doesn't handle, so we want to avoid passing it keyboard events
          // for which we have a custom handler. Note that we assert the type of the event using
          // the `type`, because `instanceof KeyboardEvent` can throw during server-side rendering.
          const isKeyboardEvent = event.type.startsWith('key');

          if (this.disabled || (isKeyboardEvent &&
              !this.REMOVE_ICON_HANDLED_KEYS.has((event as KeyboardEvent).keyCode))) {
            return;
          }

          this.remove();

          if (isKeyboardEvent && !hasModifierKey(event as KeyboardEvent)) {
            const keyCode = (event as KeyboardEvent).keyCode;

            // Prevent default space and enter presses so we don't scroll the page or submit forms.
            if (keyCode === SPACE || keyCode === ENTER) {
              event.preventDefault();
            }
          }
        });
    }
  }

  /**
   * Allows for programmatic removal of the chip.
   *
   * Informs any listeners of the removal request. Does not remove the chip from the DOM.
   */
  remove(): void {
    if (this.removable) {
      this.removed.emit({chip: this});
    }
  }

  /** Sets whether the given CSS class should be applied to the MDC chip. */
  private _setMdcClass(cssClass: string, active: boolean) {
      const classes = this._elementRef.nativeElement.classList;
      active ? classes.add(cssClass) : classes.remove(cssClass);
      this._changeDetectorRef.markForCheck();
  }

  /** Forwards interaction events to the MDC chip foundation. */
  _handleInteraction(event: MouseEvent | KeyboardEvent | FocusEvent) {
    if (this.disabled) {
      return;
    }

    if (event.type === 'click') {
      this._chipFoundation.handleClick();
      return;
    }

    if (event.type === 'dblclick') {
      this._chipFoundation.handleDoubleClick();
    }

    if (event.type === 'keydown') {
      this._chipFoundation.handleKeydown(event as KeyboardEvent);
      return;
    }

    if (event.type === 'focusout') {
      this._chipFoundation.handleFocusOut(event as FocusEvent);
    }

    if (event.type === 'focusin') {
      this._chipFoundation.handleFocusIn(event as FocusEvent);
    }
  }

  /** Whether or not the ripple should be disabled. */
  _isRippleDisabled(): boolean {
    return this.disabled || this.disableRipple || this._animationsDisabled ||
           this._isBasicChip || !!this._globalRippleOptions?.disabled;
  }

  _notifyInteraction() {
    this.interaction.emit(this.id);
  }

  _notifyNavigation() {
    // TODO: This is a new feature added by MDC. Consider exposing it to users
    // in the future.
  }

  private _getAction(type: ActionType): MDCChipActionFoundation | undefined {
    switch (type) {
      case ActionType.PRIMARY:
        return this.primaryAction._getFoundation();
      case ActionType.TRAILING:
        return (this.removeIcon || this.trailingIcon)?._getFoundation();
    }

    return undefined;
  }

  /** Overridden by MatChipRow. */
  protected _onEditStart() {}

  /** Overridden by MatChipRow. */
  protected _onEditFinish() {}

  static ngAcceptInputType_disabled: BooleanInput;
  static ngAcceptInputType_removable: BooleanInput;
  static ngAcceptInputType_highlighted: BooleanInput;
  static ngAcceptInputType_disableRipple: BooleanInput;
  static ngAcceptInputType_tabIndex: NumberInput;
}
