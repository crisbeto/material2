/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Overlay, OverlayContainer, OverlayRef, ScrollStrategy} from '@angular/cdk/overlay';
import {BasePortalOutlet, ComponentType} from '@angular/cdk/portal';
import {Location} from '@angular/common';
import {
  Directive,
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
import {Observable, Subject} from 'rxjs';
import {MatDialogConfig} from './dialog-config';
import {MatDialogContainer, _MatDialogContainerBase} from './dialog-container';
import {MatDialogRef} from './dialog-ref';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';

import {DialogBase, DialogConfig} from '@angular/cdk-experimental/dialog';

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
@Directive()
export abstract class _MatDialogBase<C extends _MatDialogContainerBase>
  extends DialogBase<MatDialogRef<any>, C>
  implements OnDestroy
{
  /** Keeps track of the currently-open dialogs. */
  override get openDialogs(): MatDialogRef<any>[] {
    return super.openDialogs;
  }

  /** Stream that emits when a dialog has been opened. */
  override get afterOpened(): Subject<MatDialogRef<any>> {
    return super.afterOpened;
  }

  // TODO (jelbourn): tighten the typing right-hand side of this expression.
  /**
   * Stream that emits when all open dialog have finished closing.
   * Will emit on subscribe if there are no open dialogs to begin with.
   */
  override readonly afterAllClosed: Observable<void>;

  constructor(
    overlay: Overlay,
    injector: Injector,
    defaultOptions: MatDialogConfig | undefined,
    parentDialog: _MatDialogBase<C> | undefined,
    overlayContainer: OverlayContainer,
    scrollStrategy: any,
    private _dialogRefConstructor: Type<MatDialogRef<any>>,
    protected readonly _containerType: Type<C>,
    private _dialogDataToken: InjectionToken<any>,
    /**
     * @deprecated No longer used. To be removed.
     * @breaking-change 14.0.0
     */
    _animationMode?: 'NoopAnimations' | 'BrowserAnimations',
  ) {
    // TODO: pass defaults
    super(overlay, injector, undefined, parentDialog, overlayContainer, scrollStrategy);
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
    // config = _applyConfigDefaults(config, this._defaultOptions || new MatDialogConfig());
    const dialogRef = super.openFrom(componentOrTemplateRef, {
      ...config,
      id: config?.id || `mat-dialog-${uniqueId++}`,
      // TODO
      // positionStrategy: this._overlay.position().global(),
    });
    dialogRef._containerInstance._matConfig = config!; // TODO: non-null should not be necessary
    return dialogRef;
  }

  /**
   * Closes all of the currently-open dialogs.
   */
  override closeAll(): void {
    super.closeAll();
  }

  /**
   * Finds an open dialog by its id.
   * @param id ID to use when looking up the dialog.
   */
  override getDialogById(id: string): MatDialogRef<any> | undefined {
    return super.getDialogById(id);
  }

  ngOnDestroy() {
    super.destroy();
  }

  protected override _getAdditionalProviders(
    containerInstance: BasePortalOutlet,
    dialogRef: MatDialogRef<any, any>,
    config: DialogConfig<any>,
  ) {
    return [
      {provide: this._containerType, useValue: containerInstance},
      {provide: this._dialogDataToken, useValue: config.data},
      {provide: this._dialogRefConstructor, useValue: dialogRef},
    ];
  }

  protected _getClosedStream(ref: MatDialogRef<unknown>) {
    return ref.afterClosed();
  }

  protected _closeDialog(ref: MatDialogRef<unknown>) {
    ref.close();
  }

  protected _createDialogRef(
    overlayRef: OverlayRef,
    config: DialogConfig<any>,
    containerInstance: _MatDialogContainerBase,
  ) {
    return new MatDialogRef(overlayRef, containerInstance, config);
  }
}

/**
 * Service to open Material Design modal dialogs.
 */
@Injectable()
export class MatDialog extends _MatDialogBase<MatDialogContainer> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    /**
     * @deprecated `_location` parameter to be removed.
     * @breaking-change 10.0.0
     */
    @Optional() location: Location,
    @Optional() @Inject(MAT_DIALOG_DEFAULT_OPTIONS) defaultOptions: MatDialogConfig,
    @Inject(MAT_DIALOG_SCROLL_STRATEGY) scrollStrategy: any,
    @Optional() @SkipSelf() parentDialog: MatDialog,
    overlayContainer: OverlayContainer,
    /**
     * @deprecated No longer used. To be removed.
     * @breaking-change 14.0.0
     */
    @Optional()
    @Inject(ANIMATION_MODULE_TYPE)
    animationMode?: 'NoopAnimations' | 'BrowserAnimations',
  ) {
    super(
      overlay,
      injector,
      defaultOptions,
      parentDialog,
      overlayContainer,
      scrollStrategy,
      MatDialogRef,
      MatDialogContainer,
      MAT_DIALOG_DATA,
      animationMode,
    );
  }
}
