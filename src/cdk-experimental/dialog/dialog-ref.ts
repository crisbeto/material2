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
export abstract class DialogRefBase<T, R = any> {
  /** The instance of component opened into the dialog. */
  componentInstance: T;

  /** Whether the user is allowed to close the dialog. */
  protected disableClose: boolean | undefined;

  /** Emits when the dialog has been closed. */
  protected readonly closed: Observable<R | undefined> = new Subject<R | undefined>();

  /** Unique ID for the dialog. */
  protected readonly id: string;

  protected constructor(protected _overlayRef: OverlayRef, readonly config: DialogConfig) {
    this.disableClose = config.disableClose;
    this.id = config.id || `cdk-dialog-${uniqueId++}`;

    _overlayRef.keydownEvents().subscribe(event => {
      if (event.keyCode === ESCAPE && !this.disableClose && !hasModifierKey(event)) {
        event.preventDefault();
        this.close();
      }
    });

    _overlayRef.backdropClick().subscribe(() => {
      if (!this.disableClose) {
        this.close();
      }
    });
  }

  /**
   * Close the dialog.
   * @param result Optional result to return to the dialog opener.
   */
  protected close(result?: R): void {
    const closedSubject = this.closed as Subject<R | undefined>;
    this._overlayRef.dispose();
    closedSubject.next(result);
    closedSubject.complete();
  }

  /**
   * Updates the dialog's position.
   * @param position New dialog position.
   */
  protected updatePosition(): this {
    this._overlayRef.updatePosition();
    return this;
  }

  /**
   * Updates the dialog's width and height.
   * @param width New width of the dialog.
   * @param height New height of the dialog.
   */
  protected updateSize(width: string = '', height: string = ''): this {
    this._overlayRef.updateSize({width, height});
    this._overlayRef.updatePosition();
    return this;
  }

  /** Add a CSS class or an array of classes to the overlay pane. */
  protected addPanelClass(classes: string | string[]): this {
    this._overlayRef.addPanelClass(classes);
    return this;
  }

  /** Remove a CSS class or an array of classes from the overlay pane. */
  protected removePanelClass(classes: string | string[]): this {
    this._overlayRef.removePanelClass(classes);
    return this;
  }
}

/**
 * Reference to a dialog opened via the Dialog service.
 */
export class DialogRef<T, R = any> extends DialogRefBase<T, R> {
  /** Whether the user is allowed to close the dialog. */
  override disableClose: boolean | undefined;

  /** Emits when the dialog has been closed. */
  override readonly closed: Observable<R | undefined>;

  /** Emits when the backdrop of the dialog is clicked. */
  readonly backdropClick: Observable<MouseEvent>;

  /** Emits when on keyboard events within the dialog. */
  readonly keydownEvents: Observable<KeyboardEvent>;

  /** Unique ID for the dialog. */
  override readonly id: string;

  constructor(overlayRef: OverlayRef, config: DialogConfig) {
    super(overlayRef, config);
    this.backdropClick = overlayRef.backdropClick();
    this.keydownEvents = overlayRef.keydownEvents();
  }

  /**
   * Close the dialog.
   * @param result Optional result to return to the dialog opener.
   */
  override close(result?: R): void {
    super.close(result);
  }

  /**
   * Updates the dialog's position.
   * @param position New dialog position.
   */
  override updatePosition(): this {
    return super.updatePosition();
  }

  /**
   * Updates the dialog's width and height.
   * @param width New width of the dialog.
   * @param height New height of the dialog.
   */
  override updateSize(width: string = '', height: string = ''): this {
    return super.updateSize(width, height);
  }

  /** Add a CSS class or an array of classes to the overlay pane. */
  override addPanelClass(classes: string | string[]): this {
    return super.addPanelClass(classes);
  }

  /** Remove a CSS class or an array of classes from the overlay pane. */
  override removePanelClass(classes: string | string[]): this {
    return super.removePanelClass(classes);
  }
}
