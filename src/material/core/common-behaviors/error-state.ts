/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AbstractControl, FormGroupDirective, NgControl, NgForm} from '@angular/forms';
import {Subject} from 'rxjs';
import {ErrorStateMatcher as _ErrorStateMatcher} from '../error/error-options';
import {FormField} from '@angular/forms/signals';
import {isSignal} from '@angular/core';

// Declare ErrorStateMatcher as an interface to have compatibility with Closure Compiler.
interface ErrorStateMatcher extends _ErrorStateMatcher {}

/**
 * Class that tracks the error state of a component.
 * @docs-private
 */
export class _ErrorStateTracker {
  /** Whether the tracker is currently in an error state. */
  errorState = false;

  /** User-defined matcher for the error state. */
  matcher!: ErrorStateMatcher;

  /** Reactive or template-based control directive. */
  ngControl: NgControl | null;

  /** Signal-based form field directive. */
  formField: FormField<unknown> | null;

  constructor(
    private _defaultMatcher: ErrorStateMatcher | null,
    directive: NgControl | FormField<unknown> | null,
    private _parentFormGroup: FormGroupDirective | null,
    private _parentForm: NgForm | null,
    private _stateChanges: Subject<void>,
  ) {
    if (!directive) {
      this.ngControl = this.formField = null;
    } else if (
      isSignal((directive as {field?: unknown}).field) &&
      // Avoid false positives for interop controls.
      !(directive as {updateValueAndValidity?: unknown}).updateValueAndValidity
    ) {
      this.formField = directive as FormField<unknown>;
      this.ngControl = null;
    } else {
      this.formField = null;
      this.ngControl = directive as NgControl;
    }
  }

  /** Updates the error state based on the provided error state matcher. */
  updateErrorState() {
    const oldState = this.errorState;
    const matcher = this.matcher || this._defaultMatcher;
    let newState: boolean;

    if (this.formField) {
      if (
        (typeof ngDevMode === 'undefined' || ngDevMode) &&
        matcher &&
        !matcher.isSignalErrorState
      ) {
        throw new Error(
          'Current error state matcher does not support signal forms. ' +
            'Please implement the `isSignalErrorState` method.',
        );
      }

      newState = matcher?.isSignalErrorState?.(this.formField.field()) ?? false;
    } else {
      const parent = this._parentFormGroup || this._parentForm;
      const control = this.ngControl ? (this.ngControl.control as AbstractControl) : null;
      newState = matcher?.isErrorState(control, parent) ?? false;
    }

    if (newState !== oldState) {
      this.errorState = newState;
      this._stateChanges.next();
    }
  }
}
