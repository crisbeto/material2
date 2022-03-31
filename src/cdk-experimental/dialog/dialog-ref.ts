/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {OverlayRef} from '@angular/cdk/overlay';
import {ESCAPE, hasModifierKey} from '@angular/cdk/keycodes';
import {Observable, Subject} from 'rxjs';
import {DialogConfig} from './dialog-config';

/** Unique id for the created dialog. */
let uniqueId = 0;

/**
 * Reference to a dialog opened via the Dialog service.
 */
export class DialogRef<T, R = any> {
  /** The instance of component opened into the dialog. */
  componentInstance: T;

  /** Whether the user is allowed to close the dialog. */
  disableClose: boolean | undefined;

  /** Emits when the dialog has been closed. */
  readonly closed: Observable<R | undefined> = new Subject<R | undefined>();

  /** Emits when the backdrop of the dialog is clicked. */
  readonly backdropClick: Observable<MouseEvent>;

  /** Emits when on keyboard events within the dialog. */
  readonly keydownEvents: Observable<KeyboardEvent>;

  /** Unique ID for the dialog. */
  readonly id: string;

  constructor(private _overlayRef: OverlayRef, readonly config: DialogConfig) {
    this.disableClose = config.disableClose;
    this.backdropClick = _overlayRef.backdropClick();
    this.keydownEvents = _overlayRef.keydownEvents();
    this.id = config.id || `cdk-dialog-${uniqueId++}`;

    this.keydownEvents.subscribe(event => {
      if (event.keyCode === ESCAPE && !this.disableClose && !hasModifierKey(event)) {
        event.preventDefault();
        this.close();
      }
    });

    this.backdropClick.subscribe(() => {
      if (!this.disableClose) {
        this.close();
      }
    });
  }

  /**
   * Close the dialog.
   * @param dialogResult Optional result to return to the dialog opener.
   */
  close(result?: R): void {
    const closedSubject = this.closed as Subject<R | undefined>;
    this._overlayRef.dispose();
    closedSubject.next(result);
    closedSubject.complete();
  }

  /**
   * Updates the dialog's position.
   * @param position New dialog position.
   */
  updatePosition(): this {
    this._overlayRef.updatePosition();
    return this;
  }

  /**
   * Updates the dialog's width and height.
   * @param width New width of the dialog.
   * @param height New height of the dialog.
   */
  updateSize(width: string = '', height: string = ''): this {
    this._overlayRef.updateSize({width, height});
    this._overlayRef.updatePosition();
    return this;
  }

  /** Add a CSS class or an array of classes to the overlay pane. */
  addPanelClass(classes: string | string[]): this {
    this._overlayRef.addPanelClass(classes);
    return this;
  }

  /** Remove a CSS class or an array of classes from the overlay pane. */
  removePanelClass(classes: string | string[]): this {
    this._overlayRef.removePanelClass(classes);
    return this;
  }
}
