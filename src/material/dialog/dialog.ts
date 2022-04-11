/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Overlay, OverlayContainer, ScrollStrategy} from '@angular/cdk/overlay';
import {ComponentType} from '@angular/cdk/portal';
import {Location} from '@angular/common';
import {
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  OnDestroy,
  Optional,
  SkipSelf,
  TemplateRef,
  Type,
} from '@angular/core';
import {defer, Observable, Subject} from 'rxjs';
import {startWith} from 'rxjs/operators';
import {MatDialogConfig} from './dialog-config';
import {MatDialogContainer, _MatDialogContainerBase} from './dialog-container';
import {MatDialogRef} from './dialog-ref';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {Dialog, DialogConfig} from '@angular/cdk-experimental/dialog';

/** Injection token that can be used to access the data that was passed in to a dialog. */
export const MAT_DIALOG_DATA = new InjectionToken<any>('MatDialogData');

/** Injection token that can be used to specify default dialog options. */
export const MAT_DIALOG_DEFAULT_OPTIONS = new InjectionToken<MatDialogConfig>(
  'mat-dialog-default-options',
);

/** Injection token that determines the scroll handling while the dialog is open. */
export const MAT_DIALOG_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>(
  'mat-dialog-scroll-strategy',
);

/** @docs-private */
export function MAT_DIALOG_SCROLL_STRATEGY_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

/** @docs-private */
export function MAT_DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(
  overlay: Overlay,
): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

/** @docs-private */
export const MAT_DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: MAT_DIALOG_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: MAT_DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

// Counter for unique dialog ids.
let uniqueId = 0;

/**
 * Base class for dialog services. The base dialog service allows
 * for arbitrary dialog refs and dialog container components.
 */
@Injectable()
export abstract class _MatDialogBase<C extends _MatDialogContainerBase> implements OnDestroy {
  private readonly _openDialogsAtThisLevel: MatDialogRef<any>[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<MatDialogRef<any>>();
  private _scrollStrategy: () => ScrollStrategy;
  protected abstract readonly _idPrefix: string;

  /** Keeps track of the currently-open dialogs. */
  get openDialogs(): MatDialogRef<any>[] {
    return this._parentDialog ? this._parentDialog.openDialogs : this._openDialogsAtThisLevel;
  }

  /** Stream that emits when a dialog has been opened. */
  get afterOpened(): Subject<MatDialogRef<any>> {
    return this._parentDialog ? this._parentDialog.afterOpened : this._afterOpenedAtThisLevel;
  }

  private _getAfterAllClosed(): Subject<void> {
    const parent = this._parentDialog;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }

  /**
   * Stream that emits when all open dialog have finished closing.
   * Will emit on subscribe if there are no open dialogs to begin with.
   */
  readonly afterAllClosed: Observable<void> = defer(() =>
    this.openDialogs.length
      ? this._getAfterAllClosed()
      : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<any>;

  constructor(
    private _overlay: Overlay,
    private _dialog: Dialog,
    private _defaultOptions: MatDialogConfig | undefined,
    private _parentDialog: _MatDialogBase<C> | undefined,
    scrollStrategy: any,
    private _dialogRefConstructor: Type<MatDialogRef<any>>,
    private _dialogContainerType: Type<C>,
    private _dialogDataToken: InjectionToken<any>,
  ) {
    this._scrollStrategy = scrollStrategy;
  }

  /**
   * Opens a modal dialog containing the given component.
   * @param component Type of the component to load into the dialog.
   * @param config Extra configuration options.
   * @returns Reference to the newly-opened dialog.
   */
  open<T, D = any, R = any>(
    component: ComponentType<T>,
    config?: MatDialogConfig<D>,
  ): MatDialogRef<T, R>;

  /**
   * Opens a modal dialog containing the given template.
   * @param template TemplateRef to instantiate as the dialog content.
   * @param config Extra configuration options.
   * @returns Reference to the newly-opened dialog.
   */
  open<T, D = any, R = any>(
    template: TemplateRef<T>,
    config?: MatDialogConfig<D>,
  ): MatDialogRef<T, R>;

  open<T, D = any, R = any>(
    template: ComponentType<T> | TemplateRef<T>,
    config?: MatDialogConfig<D>,
  ): MatDialogRef<T, R>;

  open<T, D = any, R = any>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: MatDialogConfig<D>,
  ): MatDialogRef<T, R> {
    let dialogRef: MatDialogRef<T, R>;
    config = {...(this._defaultOptions || new MatDialogConfig()), ...config};
    config.id = config.id || `${this._idPrefix}${uniqueId++}`;
    config.scrollStrategy = config.scrollStrategy || this._scrollStrategy();

    this._dialog.open(componentOrTemplateRef, {
      ...config,
      positionStrategy: this._overlay.position().global().centerHorizontally().centerVertically(),
      // Disable closing since we need to sync it up to the animation ourselves.
      disableClose: true,
      container: {
        type: this._dialogContainerType,
        providers: () => [
          // Provide our config as the CDK config as well since it has the same interface as the
          // CDK one, but it contains the actual values passed in by the user for things like
          // `disableClose` which we disable for the CDK dialog since we handle it ourselves.
          {provide: MatDialogConfig, useValue: config},
          {provide: DialogConfig, useValue: config},
        ],
      },
      templateContext: () => ({dialogRef}),
      providers: (cdkRef, cdkConfig, dialogContainer) => {
        dialogRef = new this._dialogRefConstructor(cdkRef, config, dialogContainer);
        dialogRef.updatePosition(config?.position);
        return [
          {provide: this._dialogContainerType, useValue: dialogContainer},
          {provide: this._dialogDataToken, useValue: cdkConfig.data},
          {provide: this._dialogRefConstructor, useValue: dialogRef},
        ];
      },
    });

    this.openDialogs.push(dialogRef!);
    this.afterOpened.next(dialogRef!);

    dialogRef!.afterClosed().subscribe(() => {
      const index = this.openDialogs.indexOf(dialogRef);

      if (index > -1) {
        this.openDialogs.splice(index, 1);

        if (!this.openDialogs.length) {
          this._getAfterAllClosed().next();
        }
      }
    });

    return dialogRef!;
  }

  /**
   * Closes all of the currently-open dialogs.
   */
  closeAll(): void {
    this._closeDialogs(this.openDialogs);
  }

  /**
   * Finds an open dialog by its id.
   * @param id ID to use when looking up the dialog.
   */
  getDialogById(id: string): MatDialogRef<any> | undefined {
    // TODO: filter based on prefix.
    return this.openDialogs.find(dialog => dialog.id === id);
  }

  ngOnDestroy() {
    // Only close the dialogs at this level on destroy
    // since the parent service may still be active.
    this._closeDialogs(this._openDialogsAtThisLevel);
    this._afterAllClosedAtThisLevel.complete();
    this._afterOpenedAtThisLevel.complete();
  }

  private _closeDialogs(dialogs: MatDialogRef<any>[]) {
    let i = dialogs.length;

    while (i--) {
      dialogs[i].close();
    }
  }
}

/**
 * Service to open Material Design modal dialogs.
 */
@Injectable()
export class MatDialog extends _MatDialogBase<MatDialogContainer> {
  protected readonly _idPrefix = 'mat-dialog-';

  constructor(
    overlay: Overlay,
    injector: Injector,
    /**
     * @deprecated `_location` parameter to be removed.
     * @breaking-change 10.0.0
     */
    @Optional() _location: Location,
    @Optional() @Inject(MAT_DIALOG_DEFAULT_OPTIONS) defaultOptions: MatDialogConfig,
    @Inject(MAT_DIALOG_SCROLL_STRATEGY) scrollStrategy: any,
    @Optional() @SkipSelf() parentDialog: MatDialog,
    /**
     * @deprecated No longer used. To be removed.
     * @breaking-change 14.0.0
     */
    _overlayContainer: OverlayContainer,
    /**
     * @deprecated No longer used. To be removed.
     * @breaking-change 14.0.0
     */
    @Optional()
    @Inject(ANIMATION_MODULE_TYPE)
    _animationMode?: 'NoopAnimations' | 'BrowserAnimations',
  ) {
    super(
      overlay,
      injector.get(Dialog),
      defaultOptions,
      parentDialog,
      scrollStrategy,
      MatDialogRef,
      MatDialogContainer,
      MAT_DIALOG_DATA,
    );
  }
}
