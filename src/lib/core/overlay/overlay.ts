import {
  ComponentFactoryResolver,
  Injectable,
  ApplicationRef,
  Injector,
  NgZone,
} from '@angular/core';
import {OverlayState} from './overlay-state';
import {DomPortalHost} from '../portal/dom-portal-host';
import {OverlayRef} from './overlay-ref';
import {OverlayPositionBuilder} from './position/overlay-position-builder';
import {ViewportRuler} from './position/viewport-ruler';
import {OverlayContainer} from './overlay-container';

/** Next overlay unique ID. */
let nextUniqueId = 0;

/** The default state for newly created overlays. */
let defaultState = new OverlayState();


/**
 * Service to create Overlays. Overlays are dynamically added pieces of floating UI, meant to be
 * used as a low-level building building block for other components. Dialogs, tooltips, menus,
 * selects, etc. can all be built using overlays. The service should primarily be used by authors
 * of re-usable components rather than developers building end-user applications.
 *
 * An overlay *is* a PortalHost, so any kind of Portal can be loaded into one.
 */
 @Injectable()
export class Overlay {
  constructor(private _overlayContainer: OverlayContainer,
              private _componentFactoryResolver: ComponentFactoryResolver,
              private _positionBuilder: OverlayPositionBuilder,
              private _appRef: ApplicationRef,
              private _injector: Injector,
              private _ngZone: NgZone) {}

  /**
   * Creates an overlay.
   * @param state State to apply to the overlay.
   * @returns A reference to the created overlay.
   */
  create(state: OverlayState = defaultState): OverlayRef {
    let elements = this._createPaneElements();
    let portalHost = new DomPortalHost(
      elements.host,
      this._componentFactoryResolver,
      this._appRef,
      this._injector,
      elements.wrapper
    );

    return new OverlayRef(portalHost, elements.host, state, this._ngZone);
  }

  /**
   * Returns a position builder that can be used, via fluent API,
   * to construct and configure a position strategy.
   */
  position() {
    return this._positionBuilder;
  }

  /**
   * Creates the DOM element for an overlay and appends it to the overlay container.
   * @returns Promise resolving to the created element.
   */
  private _createPaneElements(): { wrapper: HTMLElement, host: HTMLElement } {
    let paneWrapper = document.createElement('div');
    let pane = document.createElement('div');

    paneWrapper.classList.add('md-overlay-pane-wrapper');
    pane.classList.add('md-overlay-pane');

    paneWrapper.id = `md-overlay-${nextUniqueId++}`;
    paneWrapper.appendChild(pane);

    this._overlayContainer.getContainerElement().appendChild(paneWrapper);

    return {
      wrapper: paneWrapper,
      host: pane
    };
  }
}

/** Providers for Overlay and its related injectables. */
export const OVERLAY_PROVIDERS = [
  ViewportRuler,
  OverlayPositionBuilder,
  Overlay,
  OverlayContainer,
];
