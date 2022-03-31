/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  TemplateRef,
  Injectable,
  Injector,
  OnDestroy,
  Type,
  StaticProvider,
  InjectFlags,
} from '@angular/core';
import {BasePortalOutlet, ComponentPortal, TemplatePortal} from '@angular/cdk/portal';
import {of as observableOf, Observable, Subject, defer} from 'rxjs';
import {DialogRef} from './dialog-ref';
import {DialogConfig} from './dialog-config';
import {Directionality} from '@angular/cdk/bidi';
import {CdkDialogContainer} from './dialog-container';
import {
  ComponentType,
  Overlay,
  OverlayRef,
  OverlayConfig,
  ScrollStrategy,
  OverlayContainer,
} from '@angular/cdk/overlay';
import {startWith} from 'rxjs/operators';

import {DIALOG_DATA} from './dialog-injectors';

export abstract class DialogBase<
  R extends {id: string; componentInstance: unknown},
  C extends BasePortalOutlet,
> {
  private _openDialogsAtThisLevel: R[] = [];
  private readonly _afterAllClosedAtThisLevel = new Subject<void>();
  private readonly _afterOpenedAtThisLevel = new Subject<R>();
  private _ariaHiddenElements = new Map<Element, string | null>();
  private _scrollStrategy: () => ScrollStrategy;
  protected abstract readonly _containerType: Type<C>;
  protected abstract _getClosedStream(ref: R): Observable<unknown>;
  protected abstract _closeDialog(ref: R): void;
  protected abstract _createDialogRef(
    overlayRef: OverlayRef,
    config: DialogConfig,
    containerInstance: BasePortalOutlet,
  ): R;

  /** Keeps track of the currently-open dialogs. */
  protected get openDialogs(): R[] {
    return this._parentDialog ? this._parentDialog.openDialogs : this._openDialogsAtThisLevel;
  }

  /** Stream that emits when a dialog has been opened. */
  protected get afterOpened(): Subject<R> {
    return this._parentDialog ? this._parentDialog.afterOpened : this._afterOpenedAtThisLevel;
  }

  protected _getAfterAllClosed(): Subject<void> {
    const parent = this._parentDialog;
    return parent ? parent._getAfterAllClosed() : this._afterAllClosedAtThisLevel;
  }

  /**
   * Stream that emits when all open dialog have finished closing.
   * Will emit on subscribe if there are no open dialogs to begin with.
   */
  protected readonly afterAllClosed: Observable<void> = defer(() =>
    this.openDialogs.length
      ? this._getAfterAllClosed()
      : this._getAfterAllClosed().pipe(startWith(undefined)),
  ) as Observable<any>;

  protected constructor(
    protected _overlay: Overlay,
    private _injector: Injector,
    private _defaultOptions: DialogConfig | undefined, // TODO: is this still necessary?
    private _parentDialog: DialogBase<R, C> | undefined,
    private _overlayContainer: OverlayContainer,
    scrollStrategy: any,
  ) {
    this._scrollStrategy = scrollStrategy;
  }

  protected openFrom<T, D = any>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: DialogConfig<D>,
  ): R {
    config = {...(this._defaultOptions || new DialogConfig()), ...config} as DialogConfig<D>;

    if (
      config.id &&
      this.getDialogById(config.id) &&
      (typeof ngDevMode === 'undefined' || ngDevMode)
    ) {
      throw Error(`Dialog with id "${config.id}" exists already. The dialog id must be unique.`);
    }

    const overlayRef = this._createOverlay(config);
    const dialogContainer = this._attachContainer(overlayRef, config);
    const dialogRef = this._attachDialogContent<T>(
      componentOrTemplateRef,
      dialogContainer,
      overlayRef,
      config,
    );

    // If this is the first dialog that we're opening, hide all the non-overlay content.
    if (!this.openDialogs.length) {
      this._hideNonDialogContentFromAssistiveTechnology();
    }

    this.openDialogs.push(dialogRef);
    this._getClosedStream(dialogRef).subscribe(() => this._removeOpenDialog(dialogRef));
    this.afterOpened.next(dialogRef);

    return dialogRef;
  }

  /**
   * Closes all of the currently-open dialogs.
   */
  protected closeAll(): void {
    this._closeDialogs(this.openDialogs);
  }

  /**
   * Finds an open dialog by its id.
   * @param id ID to use when looking up the dialog.
   */
  protected getDialogById(id: string): R | undefined {
    return this.openDialogs.find(dialog => dialog.id === id);
  }

  protected destroy() {
    // Only close the dialogs at this level on destroy
    // since the parent service may still be active.
    this._closeDialogs(this._openDialogsAtThisLevel);
    this._afterAllClosedAtThisLevel.complete();
    this._afterOpenedAtThisLevel.complete();
  }

  /**
   * Creates the overlay into which the dialog will be loaded.
   * @param config The dialog configuration.
   * @returns A promise resolving to the OverlayRef for the created overlay.
   */
  private _createOverlay(config: DialogConfig): OverlayRef {
    const overlayConfig = this._getOverlayConfig(config);
    return this._overlay.create(overlayConfig);
  }

  /**
   * Creates an overlay config from a dialog config.
   * @param config The dialog configuration.
   * @returns The overlay configuration.
   */
  private _getOverlayConfig(config: DialogConfig): OverlayConfig {
    const state = new OverlayConfig({
      positionStrategy:
        config.positionStrategy ||
        this._overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: config.scrollStrategy || this._scrollStrategy(),
      panelClass: config.panelClass,
      hasBackdrop: config.hasBackdrop,
      direction: config.direction,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      width: config.width,
      height: config.height,
      disposeOnNavigation: config.closeOnNavigation,
    });

    if (config.backdropClass) {
      state.backdropClass = config.backdropClass;
    }

    return state;
  }

  /**
   * Attaches a dialog container to a dialog's already-created overlay.
   * @param overlay Reference to the dialog's underlying overlay.
   * @param config The dialog configuration.
   * @returns A promise resolving to a ComponentRef for the attached container.
   */
  private _attachContainer(overlay: OverlayRef, config: DialogConfig): BasePortalOutlet {
    const userInjector = config.injector ?? config.viewContainerRef?.injector;
    const injector = Injector.create({
      parent: userInjector || this._injector,
      providers: [
        {provide: DialogConfig, useValue: config},
        {provide: OverlayRef, useValue: overlay},
      ],
    });

    const containerPortal = new ComponentPortal(
      this._containerType,
      config.viewContainerRef,
      injector,
      config.componentFactoryResolver,
    );
    const containerRef = overlay.attach(containerPortal);

    return containerRef.instance;
  }

  /**
   * Attaches the user-provided component to the already-created dialog container.
   * @param componentOrTemplateRef The type of component being loaded into the dialog,
   *     or a TemplateRef to instantiate as the content.
   * @param dialogContainer Reference to the wrapping dialog container.
   * @param overlayRef Reference to the overlay in which the dialog resides.
   * @param config The dialog configuration.
   * @returns A promise resolving to the DialogRef that should be returned to the user.
   */
  private _attachDialogContent<T>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    dialogContainer: BasePortalOutlet,
    overlayRef: OverlayRef,
    config: DialogConfig,
  ): R {
    // Create a reference to the dialog we're creating in order to give the user a handle
    // to modify and close it.
    const dialogRef = this._createDialogRef(overlayRef, config, dialogContainer);
    const injector = this._createInjector(dialogContainer, config, dialogRef);

    if (componentOrTemplateRef instanceof TemplateRef) {
      dialogContainer.attachTemplatePortal(
        new TemplatePortal<T>(
          componentOrTemplateRef,
          null!,
          {
            $implicit: config.data,
            dialogRef,
          } as any,
          injector,
        ),
      );
    } else {
      const contentRef = dialogContainer.attachComponentPortal<T>(
        new ComponentPortal(
          componentOrTemplateRef,
          config.viewContainerRef,
          injector,
          config.componentFactoryResolver,
        ),
      );
      dialogRef.componentInstance = contentRef.instance;
    }

    return dialogRef;
  }

  /**
   * Creates a custom injector to be used inside the dialog. This allows a component loaded inside
   * of a dialog to close itself and, optionally, to return a value.
   * @param config Config object that is used to construct the dialog.
   * @param providers Providers to attach to the dialog injector.
   * @returns The custom injector that can be used inside the dialog.
   */
  private _createInjector(
    containerInstance: BasePortalOutlet,
    config: DialogConfig,
    dialogRef: R,
  ): Injector {
    const userInjector = config && config.viewContainerRef && config.viewContainerRef.injector;
    const providers: StaticProvider[] = [
      {provide: DIALOG_DATA, useValue: config.data},
      {provide: DialogRef, useValue: dialogRef},
      ...this._getAdditionalProviders(containerInstance, dialogRef, config),
    ];

    if (
      config.direction &&
      (!userInjector ||
        !userInjector.get<Directionality | null>(Directionality, null, InjectFlags.Optional))
    ) {
      providers.push({
        provide: Directionality,
        useValue: {value: config.direction, change: observableOf()},
      });
    }

    return Injector.create({parent: userInjector || this._injector, providers});
  }

  /** Can be used by child classes to include additional providers in the custom injector. */
  protected _getAdditionalProviders(
    _containerInstance: BasePortalOutlet,
    _dialogRef: R,
    _config: DialogConfig<any>,
  ): StaticProvider[] {
    return [];
  }

  /**
   * Removes a dialog from the array of open dialogs.
   * @param dialogRef Dialog to be removed.
   */
  private _removeOpenDialog(dialogRef: R) {
    const index = this.openDialogs.indexOf(dialogRef);

    if (index > -1) {
      this.openDialogs.splice(index, 1);

      // If all the dialogs were closed, remove/restore the `aria-hidden`
      // to a the siblings and emit to the `afterAllClosed` stream.
      if (!this.openDialogs.length) {
        this._ariaHiddenElements.forEach((previousValue, element) => {
          if (previousValue) {
            element.setAttribute('aria-hidden', previousValue);
          } else {
            element.removeAttribute('aria-hidden');
          }
        });

        this._ariaHiddenElements.clear();
        this._getAfterAllClosed().next();
      }
    }
  }

  /**
   * Hides all of the content that isn't an overlay from assistive technology.
   */
  private _hideNonDialogContentFromAssistiveTechnology() {
    const overlayContainer = this._overlayContainer.getContainerElement();

    // Ensure that the overlay container is attached to the DOM.
    if (overlayContainer.parentElement) {
      const siblings = overlayContainer.parentElement.children;

      for (let i = siblings.length - 1; i > -1; i--) {
        const sibling = siblings[i];

        if (
          sibling !== overlayContainer &&
          sibling.nodeName !== 'SCRIPT' &&
          sibling.nodeName !== 'STYLE' &&
          !sibling.hasAttribute('aria-live')
        ) {
          this._ariaHiddenElements.set(sibling, sibling.getAttribute('aria-hidden'));
          sibling.setAttribute('aria-hidden', 'true');
        }
      }
    }
  }

  /** Closes all of the dialogs in an array. */
  private _closeDialogs(dialogs: R[]) {
    let i = dialogs.length;

    while (i--) {
      // The `_openDialogs` property isn't updated after close until the rxjs subscription
      // runs on the next microtask, in addition to modifying the array as we're going
      // through it. We loop through all of them and call close without assuming that
      // they'll be removed from the list instantaneously.
      this._closeDialog(dialogs[i]);
    }
  }
}

@Injectable()
export class Dialog extends DialogBase<DialogRef<any>, CdkDialogContainer> implements OnDestroy {
  protected readonly _containerType = CdkDialogContainer;

  /** Keeps track of the currently-open dialogs. */
  override get openDialogs(): DialogRef<any>[] {
    return super.openDialogs;
  }

  /** Stream that emits when a dialog has been opened. */
  override get afterOpened(): Subject<DialogRef<any>> {
    return super.afterOpened;
  }

  /**
   * Stream that emits when all open dialog have finished closing.
   * Will emit on subscribe if there are no open dialogs to begin with.
   */
  override readonly afterAllClosed: Observable<void>;

  constructor(
    overlay: Overlay,
    injector: Injector,
    defaultOptions: DialogConfig | undefined,
    parentDialog: Dialog | undefined,
    overlayContainer: OverlayContainer,
    scrollStrategy: any,
  ) {
    super(overlay, injector, defaultOptions, parentDialog, overlayContainer, scrollStrategy);
  }

  /**
   * Opens a modal dialog containing the given component.
   * @param component Type of the component to load into the dialog.
   * @param config Extra configuration options.
   * @returns Reference to the newly-opened dialog.
   */
  open<T, D = any>(component: ComponentType<T>, config?: DialogConfig<D>): DialogRef<T, D>;

  /**
   * Opens a modal dialog containing the given template.
   * @param template TemplateRef to instantiate as the dialog content.
   * @param config Extra configuration options.
   * @returns Reference to the newly-opened dialog.
   */
  open<T, D = any>(template: TemplateRef<T>, config?: DialogConfig<D>): DialogRef<T, D>;

  open<T, D = any>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config?: DialogConfig<D>,
  ): DialogRef<T, D> {
    return super.openFrom<T, D>(componentOrTemplateRef, config);
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
  override getDialogById(id: string) {
    return super.getDialogById(id);
  }

  protected _getClosedStream(ref: DialogRef<unknown>) {
    return ref.closed;
  }

  protected _closeDialog(ref: DialogRef<unknown>) {
    ref.close();
  }

  protected _createDialogRef(overlayRef: OverlayRef, config: DialogConfig<any>) {
    return new DialogRef(overlayRef, config);
  }

  ngOnDestroy() {
    super.destroy();
  }
}
