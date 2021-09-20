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
  CanDisable,
  CanDisableRipple,
  HasTabIndex,
  MatRipple,
  MAT_RIPPLE_GLOBAL_OPTIONS,
  mixinColor,
  mixinDisableRipple,
  mixinTabIndex,
  RippleGlobalOptions,
} from '@angular/material-experimental/mdc-core';
import {
  MDCChipFoundation,
  MDCChipAdapter,
  MDCChipActionType,
  MDCChipActionFocusBehavior,
  MDCChipActionFoundation,
  MDCChipActionEvents,
  ActionInteractionEvent,
  ActionNavigationEvent,
} from '@material/chips';
import {numbers} from '@material/ripple';
import {SPACE, ENTER, hasModifierKey} from '@angular/cdk/keycodes';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {
  MatChipAvatar,
  MatChipTrailingIcon,
  MatChipRemove,
  MAT_CHIP_AVATAR,
  MAT_CHIP_TRAILING_ICON,
  MAT_CHIP_REMOVE,
} from './chip-icons';
import {emitCustomEvent} from './emit-event';
import {MatChipAction} from './chip-action';

let uid = 0;

/** Represents an event fired on an individual `mat-chip`. */
export interface MatChipEvent {
  /** The chip the event was fired on. */
  chip: MatChip;
}

/**
 * Boilerplate for applying mixins to MatChip.
 * @docs-private
 */
abstract class MatChipBase {
  abstract disabled: boolean;
  constructor(public _elementRef: ElementRef) {}
}

const _MatChipMixinBase = mixinTabIndex(mixinColor(mixinDisableRipple(MatChipBase), 'primary'), -1);

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
    'class': 'mat-mdc-focus-indicator',
    '[class.mdc-evolution-chip]': '!_isBasicChip',
    '[class.mdc-evolution-chip--disabled]': 'disabled',
    '[class.mdc-evolution-chip--with-trailing-action]': '_hasTrailingIcon()',
    '[class.mdc-evolution-chip--with-primary-graphic]': 'leadingIcon',
    '[class.mdc-evolution-chip--with-primary-icon]': 'leadingIcon',
    '[class.mdc-evolution-chip--with-avatar]': 'leadingIcon',
    '[class.mat-mdc-chip-highlighted]': 'highlighted',

    // '[class.mat-mdc-chip-disabled]': 'disabled',
    // '[class.mat-mdc-chip-with-trailing-icon]': 'trailingIcon || removeIcon',
    '[class.mat-mdc-basic-chip]': '_isBasicChip',
    '[class.mat-mdc-standard-chip]': '!_isBasicChip',
    // '[class._mat-animation-noopable]': '_animationsDisabled',
    // '[id]': 'id',
    // '[attr.disabled]': 'disabled || null',
    // '[attr.aria-disabled]': 'disabled.toString()',
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatChip
  extends _MatChipMixinBase
  implements
    AfterContentInit,
    AfterViewInit,
    CanColor,
    CanDisableRipple,
    CanDisable,
    HasTabIndex,
    OnDestroy
{
  protected _document: Document;

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
  @HostListener('transitionend')
  _handleTransitionEnd() {
    this._chipFoundation.handleTransitionEnd();
  }

  // We have to use a `HostListener` here in order to support both Ivy and ViewEngine.
  // In Ivy the `host` bindings will be merged when this class is extended, whereas in
  // ViewEngine they're overwritten.
  // TODO(mmalerba): we move this back into `host` once Ivy is turned on by default.
  // tslint:disable-next-line:no-host-decorator-in-concrete
  @HostListener('animationend', ['$event'])
  _handleAnimationEnd(event: AnimationEvent) {
    this._chipFoundation.handleAnimationEnd(event);
  }

  _hasFocus() {
    return this._hasFocusInternal;
  }

  /** Default unique id for the chip. */
  private _uniqueId = `mat-mdc-chip-${uid++}`;

  /** A unique id for the chip. If none is supplied, it will be auto-generated. */
  @Input() id: string = this._uniqueId;

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
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
    return this._value !== undefined ? this._value : this._textElement.textContent!.trim();
  }
  set value(value: any) {
    this._value = value;
  }
  protected _value: any;

  /**
   * Determines whether or not the chip displays the remove styling and emits (removed) events.
   */
  @Input()
  get removable(): boolean {
    return this._removable;
  }
  set removable(value: boolean) {
    this._removable = coerceBooleanProperty(value);
  }
  protected _removable: boolean = true;

  /**
   * Colors the chip for emphasis as if it were selected.
   */
  @Input()
  get highlighted(): boolean {
    return this._highlighted;
  }
  set highlighted(value: boolean) {
    this._highlighted = coerceBooleanProperty(value);
  }
  protected _highlighted: boolean = false;

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

  @ViewChild(MatChipAction) primaryAction: MatChipAction;

  /**
   * Implementation of the MDC chip adapter interface.
   * These methods are called by the chip foundation.
   */
  protected _chipAdapter: MDCChipAdapter = {
    addClass: className => this._setMdcClass(className, true),
    removeClass: className => this._setMdcClass(className, false),
    hasClass: className => this._elementRef.nativeElement.classList.contains(className),
    emitEvent: <T>(eventName: string, data: T) => {
      emitCustomEvent(this._elementRef.nativeElement, this._document, eventName, data, true);
    },
    setStyleProperty: (propertyName: string, value: string) => {
      this._elementRef.nativeElement.style.setProperty(propertyName, value);
    },
    isRTL: () => this._dir?.value === 'rtl',
    getAttribute: attributeName => this._elementRef.nativeElement.getAttribute(attributeName),
    getElementID: () => this._elementRef.nativeElement.id,
    getOffsetWidth: () => this._elementRef.nativeElement.offsetWidth,
    getActions: () => {
      const result: MDCChipActionType[] = [];

      if (this._getAction(MDCChipActionType.PRIMARY)) {
        result.push(MDCChipActionType.PRIMARY);
      }

      if (this._getAction(MDCChipActionType.TRAILING)) {
        result.push(MDCChipActionType.TRAILING);
      }

      return result;
    },
    isActionSelectable: (action: MDCChipActionType) => {
      return this._getAction(action)?.isSelectable() || false;
    },
    isActionSelected: (action: MDCChipActionType) => {
      return this._getAction(action)?.isSelected() || false;
    },
    isActionDisabled: (action: MDCChipActionType) => {
      return this._getAction(action)?.isDisabled() || false;
    },
    isActionFocusable: (action: MDCChipActionType) => {
      return this._getAction(action)?.isFocusable() || false;
    },
    setActionSelected: (action: MDCChipActionType, isSelected: boolean) => {
      this._getAction(action)?.setSelected(isSelected);
    },
    setActionDisabled: (action: MDCChipActionType, isDisabled: boolean) => {
      this._getAction(action)?.setDisabled(isDisabled);
    },
    setActionFocus: (action: MDCChipActionType, behavior: MDCChipActionFocusBehavior) => {
      this._getAction(action)?.setFocus(behavior);
    },
  };

  constructor(
    public _changeDetectorRef: ChangeDetectorRef,
    elementRef: ElementRef<HTMLElement>,
    protected _ngZone: NgZone,
    @Inject(DOCUMENT) _document: any,
    @Optional() private _dir: Directionality,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
    @Optional()
    @Inject(MAT_RIPPLE_GLOBAL_OPTIONS)
    private _globalRippleOptions?: RippleGlobalOptions,
  ) {
    super(elementRef);
    const element = elementRef.nativeElement;
    this._document = _document;
    this._chipFoundation = new MDCChipFoundation(this._chipAdapter);
    this._animationsDisabled = animationMode === 'NoopAnimations';
    this._isBasicChip =
      elementRef.nativeElement.hasAttribute(this.basicChipAttrName) ||
      elementRef.nativeElement.tagName.toLowerCase() === this.basicChipAttrName;
    element.addEventListener(MDCChipActionEvents.INTERACTION, this._handleActionInteraction);
    element.addEventListener(MDCChipActionEvents.NAVIGATION, this._handleActionNavigation);
  }

  ngAfterContentInit() {
    // TODO
    // this._initRemoveIcon();
  }

  ngAfterViewInit() {
    this._chipFoundation.init();
    this._textElement = this._elementRef.nativeElement.querySelector(
      '.mdc-evolution-chip__text-label',
    );
  }

  ngOnDestroy() {
    const element = this._elementRef.nativeElement;
    element.removeEventListener(MDCChipActionEvents.INTERACTION, this._handleActionInteraction);
    element.removeEventListener(MDCChipActionEvents.NAVIGATION, this._handleActionNavigation);
    this._chipFoundation.destroy();
  }

  // TODO
  /** Sets up the remove icon chip foundation, and subscribes to remove icon events. */
  // private _initRemoveIcon() {
  //   if (this.removeIcon) {
  //     this._chipFoundation.setShouldRemoveOnTrailingIconClick(true);
  //     this.removeIcon.disabled = this.disabled;

  //     this.removeIcon.interaction
  //       .pipe(takeUntil(this.destroyed))
  //       .subscribe(event => {
  //         // The MDC chip foundation calls stopPropagation() for any trailing icon interaction
  //         // event, even ones it doesn't handle, so we want to avoid passing it keyboard events
  //         // for which we have a custom handler. Note that we assert the type of the event using
  //         // the `type`, because `instanceof KeyboardEvent` can throw during server-side rendering.
  //         const isKeyboardEvent = event.type.startsWith('key');

  //         if (this.disabled || (isKeyboardEvent &&
  //             !this.REMOVE_ICON_HANDLED_KEYS.has((event as KeyboardEvent).keyCode))) {
  //           return;
  //         }

  //         this.remove();

  //         if (isKeyboardEvent && !hasModifierKey(event as KeyboardEvent)) {
  //           const keyCode = (event as KeyboardEvent).keyCode;

  //           // Prevent default space and enter presses so we don't scroll the page or submit forms.
  //           if (keyCode === SPACE || keyCode === ENTER) {
  //             event.preventDefault();
  //           }
  //         }
  //       });
  //   }
  // }

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

  /** Whether or not the ripple should be disabled. */
  _isRippleDisabled(): boolean {
    return (
      this.disabled ||
      this.disableRipple ||
      this._animationsDisabled ||
      this._isBasicChip ||
      !!this._globalRippleOptions?.disabled
    );
  }

  _getAction(type: MDCChipActionType): MDCChipActionFoundation | undefined {
    switch (type) {
      case MDCChipActionType.PRIMARY:
        return this.primaryAction?._getFoundation();
      case MDCChipActionType.TRAILING:
        return (this.removeIcon || this.trailingIcon)?._getFoundation();
    }

    return undefined;
  }

  _getFoundation() {
    return this._chipFoundation;
  }

  _hasTrailingIcon() {
    return this.trailingIcon || this.removeIcon;
  }

  /** Overridden by MatChipRow. */
  protected _onEditStart() {}

  /** Overridden by MatChipRow. */
  protected _onEditFinish() {}

  private _handleActionInteraction = (event: Event) => {
    this._chipFoundation.handleActionInteraction(event as ActionInteractionEvent);
  };

  private _handleActionNavigation = (event: Event) => {
    this._chipFoundation.handleActionNavigation(event as ActionNavigationEvent);
  };

  static ngAcceptInputType_disabled: BooleanInput;
  static ngAcceptInputType_removable: BooleanInput;
  static ngAcceptInputType_highlighted: BooleanInput;
  static ngAcceptInputType_disableRipple: BooleanInput;
  static ngAcceptInputType_tabIndex: NumberInput;
}
