/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AnimationEvent} from '@angular/animations';
import {FocusMonitor, FocusTrapFactory, InteractivityChecker} from '@angular/cdk/a11y';
import {_getFocusedElementPierceShadowDom} from '@angular/cdk/platform';
import {DOCUMENT} from '@angular/common';
import {
  ANIMATION_MODULE_TYPE,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  NgZone,
  Optional,
  ViewEncapsulation,
} from '@angular/core';
import {matDialogAnimations, defaultParams} from './dialog-animations';
import {MatDialogConfig} from './dialog-config';
import {MatDialogContainerLike, DialogAnimationEvent} from './dialog-ref';
import {CdkDialogContainer, DialogConfig} from '@angular/cdk-experimental/dialog';
import {OverlayRef} from '@angular/cdk/overlay';

/**
 * Throws an exception for the case when a ComponentPortal is
 * attached to a DomPortalOutlet without an origin.
 * @docs-private
 */
export function throwMatDialogContentAlreadyAttachedError() {
  throw Error('Attempting to attach dialog content after content is already attached');
}

/**
 * Base class for the `MatDialogContainer`. The base class does not implement
 * animations as these are left to implementers of the dialog container.
 */
// tslint:disable-next-line:validate-decorators
@Component({template: ''})
export abstract class _MatDialogContainerBase
  extends CdkDialogContainer
  implements MatDialogContainerLike
{
  /** Emits when an animation state changes. */
  _animationStateChanged = new EventEmitter<DialogAnimationEvent>();

  /** Whether animations are enabled. */
  _animationsEnabled: boolean;

  _matConfig: MatDialogConfig;

  constructor(
    elementRef: ElementRef,
    focusTrapFactory: FocusTrapFactory,
    protected _changeDetectorRef: ChangeDetectorRef,
    @Optional() @Inject(DOCUMENT) _document: any,
    interactivityChecker: InteractivityChecker,
    config: DialogConfig,
    ngZone: NgZone,
    overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
    @Optional() @Inject(ANIMATION_MODULE_TYPE) animationMode?: string,
  ) {
    super(
      elementRef,
      focusTrapFactory,
      _document,
      interactivityChecker,
      config,
      ngZone,
      overlayRef,
      focusMonitor,
    );
    this._animationsEnabled = animationMode !== 'NoopAnimations';
  }

  protected override _trapInitialFocus(): void {
    if (!this._matConfig.delayFocusTrap) {
      this._trapFocus();
    }
  }

  /** Starts the dialog exit animation. */
  abstract _startExitAnimation(): void;
}

/**
 * Internal component that wraps user-provided dialog content.
 * Animation is based on https://material.io/guidelines/motion/choreography.html.
 * @docs-private
 */
@Component({
  selector: 'mat-dialog-container',
  templateUrl: 'dialog-container.html',
  styleUrls: ['dialog.css'],
  encapsulation: ViewEncapsulation.None,
  // Using OnPush for dialogs caused some G3 sync issues. Disabled until we can track them down.
  // tslint:disable-next-line:validate-decorators
  changeDetection: ChangeDetectionStrategy.Default,
  animations: [matDialogAnimations.dialogContainer],
  host: {
    'class': 'mat-dialog-container',
    'tabindex': '-1',
    'aria-modal': 'true',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledBy',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[@dialogContainer]': `_getAnimationState()`,
    '(@dialogContainer.start)': '_onAnimationStart($event)',
    '(@dialogContainer.done)': '_onAnimationDone($event)',
  },
})
export class MatDialogContainer extends _MatDialogContainerBase {
  /** State of the dialog animation. */
  _state: 'void' | 'enter' | 'exit' = 'enter';

  /** Callback, invoked whenever an animation on the host completes. */
  _onAnimationDone({toState, totalTime}: AnimationEvent) {
    if (toState === 'enter') {
      if (this._matConfig.delayFocusTrap) {
        this._trapFocus();
      }

      this._animationStateChanged.next({state: 'opened', totalTime});
    } else if (toState === 'exit') {
      this._restoreFocus();
      this._animationStateChanged.next({state: 'closed', totalTime});
    }
  }

  /** Callback, invoked when an animation on the host starts. */
  _onAnimationStart({toState, totalTime}: AnimationEvent) {
    if (toState === 'enter') {
      this._animationStateChanged.next({state: 'opening', totalTime});
    } else if (toState === 'exit' || toState === 'void') {
      this._animationStateChanged.next({state: 'closing', totalTime});
    }
  }

  /** Starts the dialog exit animation. */
  _startExitAnimation(): void {
    this._state = 'exit';

    // Mark the container for check so it can react if the
    // view container is using OnPush change detection.
    this._changeDetectorRef.markForCheck();
  }

  _getAnimationState() {
    return {
      value: this._state,
      params: {
        'enterAnimationDuration':
          this._matConfig.enterAnimationDuration || defaultParams.params.enterAnimationDuration,
        'exitAnimationDuration':
          this._matConfig.exitAnimationDuration || defaultParams.params.exitAnimationDuration,
      },
    };
  }
}
