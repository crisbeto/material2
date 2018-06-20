/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  Directive,
  ContentChild,
  Inject,
  Optional,
  ElementRef,
  AfterContentInit,
  NgZone,
  SkipSelf,
  OnDestroy,
  Output,
  EventEmitter,
  ViewContainerRef,
  EmbeddedViewRef,
} from '@angular/core';
import {CdkDragHandle} from './drag-handle';
import {DOCUMENT} from '@angular/platform-browser';
import {CdkDropContainer, CDK_DROP_CONTAINER} from './drop-container';
import {supportsPassiveEventListeners} from '@angular/cdk/platform';
import {CdkDragStart, CdkDragEnd, CdkDragExit, CdkDragEnter, CdkDragDrop} from './drag-events';
import {CdkDragPreview} from './drag-preview';
import {CdkDragPlaceholder} from './drag-placeholder';

/** Event options that can be used to bind an active event. */
const activeEventOptions = supportsPassiveEventListeners() ? {passive: false} : false;

// TODO: add an API for moving a draggable up/down the
// list programmatically. Useful for keyboard controls.

/** Element that can be moved inside a CdkDrop container. */
@Directive({
  selector: '[cdkDrag]',
  exportAs: 'cdkDrag',
  host: {
    'class': 'cdk-drag',
  }
})
export class CdkDrag implements AfterContentInit, OnDestroy {
  private _document: Document;

  /** Element that is displayed next to the user's pointer while the element is being dragged. */
  private _preview: HTMLElement;

  /** Reference to the view of the preview element. */
  private _previewRef: EmbeddedViewRef<any> | null;

  /** Reference to the view of the placeholder element. */
  private _placeholderRef: EmbeddedViewRef<any> | null;

  /** Element that is rendered instead of the draggable item while it is being sorted. */
  private _placeholder: HTMLElement;

  /** Coordinates within the element at which the user picked up the element. */
  private _pickupPositionInElement: Point;

  /** Coordinates on the page at which the user picked up the element. */
  private _pickupPositionOnPage: Point;

  /** CSS `transform` applied to the element when it isn't being dragged.  */
  private _passiveTransform: Point = {x: 0, y: 0};

  /** CSS `transform` that is applied to the element while it's being dragged. */
  private _activeTransform: Point = {x: 0, y: 0};

  /** Whether the element is being dragged. */
  private _isDragging = false;

  /** Whether the element has been moved since the user started dragging it. */
  private _hasMoved = false;

  /** Drop container that the element was in at the time it was picked up. */
  private _initialContainer: CdkDropContainer;

  /** Element that can be used to drag the draggable item. */
  @ContentChild(CdkDragHandle) _handle: CdkDragHandle;

  /** Element that will be used as a template to create the draggable item's preview. */
  @ContentChild(CdkDragPreview) _previewTemplate: CdkDragPreview;

  /**
   * Element that will be used as a template to create a placeholder
   * for the draggable item while it's being dragged.
   */
  @ContentChild(CdkDragPlaceholder) _placeholderTemplate: CdkDragPlaceholder;

  /** Emits when the user starts dragging the item. */
  @Output() started = new EventEmitter<CdkDragStart>();

  /** Emits when the user stops dragging an item in the container. */
  @Output() ended = new EventEmitter<CdkDragEnd>();

  /** Emits when the user has moved the item into a new container. */
  @Output() entered = new EventEmitter<CdkDragEnter<any>>();

  /** Emits when the user removes the item its container by dragging it into another container. */
  @Output() exited = new EventEmitter<CdkDragExit<any>>();

  /** Emits when the user drops the item inside a container. */
  @Output() dropped = new EventEmitter<CdkDragDrop<any>>();

  constructor(
    /** Element that the draggable is attached to. */
    public element: ElementRef<HTMLElement>,
    /** Droppable container that the draggable is a part of. */
    @Inject(CDK_DROP_CONTAINER) @Optional() @SkipSelf() public dropContainer: CdkDropContainer,
    @Inject(DOCUMENT) document: any,
    private _ngZone: NgZone,
    private _viewContainerRef: ViewContainerRef) {
      this._document = document;
    }

  /**
   * Returns the element that is being used as a placeholder
   * while the current element is being dragged.
   */
  getPlaceholderElement(): HTMLElement {
    return this._placeholder;
  }

  ngAfterContentInit() {
    // TODO: doesn't handle (pun intended) the handle being destroyed
    const element = (this._handle ? this._handle.element : this.element).nativeElement;
    element.addEventListener('mousedown', this._pointerDown);
    element.addEventListener('touchstart', this._pointerDown);

    // Webkit won't preventDefault on a dynamically-added `touchmove` listener, which means that
    // we need to add one ahead of time. See https://bugs.webkit.org/show_bug.cgi?id=184250.
    // TODO: move into a central registry.
    this._ngZone.runOutsideAngular(() => {
      this._document.addEventListener('touchmove', this._preventScrollListener, activeEventOptions);
    });
  }

  ngOnDestroy() {
    this._removeDocumentEvents();
    this._destroyPreview();
    this._destroyPlaceholder();
    this._document.removeEventListener('touchmove', this._preventScrollListener,
        activeEventOptions as any);

    if (this._isDragging) {
      // Since we move out the element to the end of the body while it's being
      // dragged, we have to make sure that it's removed if it gets destroyed.
      this._removeElement(this.element.nativeElement);
    }
  }

  /** Handler for when the pointer is pressed down on the element or the handle. */
  private _pointerDown = (event: MouseEvent | TouchEvent) => {
    if (this._isDragging) {
      return;
    }

    this._isDragging = true;
    this._initialContainer = this.dropContainer;

    // If we have a custom preview template, the element won't be visible anyway so we avoid the
    // extra `getBoundingClientRect` calls and just move the preview next to the cursor.
    this._pickupPositionInElement = this._previewTemplate ? {x: 0, y: 0} :
        this._getPointerPositionInElement(event);
    this._pickupPositionOnPage = this._getPointerPositionOnPage(event);

    this._ngZone.runOutsideAngular(() => {
      const isTouchEvent = this._isTouchEvent(event);

      // We explicitly bind active listeners here, because newer browsers
      // will default to passive ones for `mousemove` and `touchmove`.
      // TODO: this should be bound in `mousemove` and after a certain threshold,
      // otherwise it'll interfere with clicks on the element.
      this._document.addEventListener(isTouchEvent ? 'touchmove' : 'mousemove', this._pointerMove,
          activeEventOptions);
      this._document.addEventListener(isTouchEvent ? 'touchend' : 'mouseup', this._pointerUp);
    });

    // Emit the event on the item before the one on the container.
    this.started.emit({source: this});

    if (this.dropContainer) {
      const element = this.element.nativeElement;
      const preview = this._preview = this._createPreviewElement();
      const placeholder = this._placeholder = this._createPlaceholderElement();

      // We move the element out at the end of the body and we make it hidden, because keeping it in
      // place will throw off the consumer's `:last-child` selectors. We can't remove the element
      // from the DOM completely, because iOS will stop firing all subsequent events in the chain.
      element.style.display = 'none';
      this._document.body.appendChild(element.parentNode!.replaceChild(placeholder, element));
      this._document.body.appendChild(preview);
      this.dropContainer.start();
    }
  }

  /** Handler that is invoked when the user moves their pointer after they've initiated a drag. */
  private _pointerMove = (event: MouseEvent | TouchEvent) => {
    this._hasMoved = true;
    event.preventDefault();

    if (this.dropContainer) {
      const {x, y} = this._getPointerPositionOnPage(event);
      const newContainer = this.dropContainer._getSiblingContainerFromPosition(x, y);

      if (newContainer) {
        this._ngZone.run(() => {
          // Notify the old container that the item has left.
          this.exited.emit({item: this, container: this.dropContainer});
          this.dropContainer.exit(this);

          // Notify the new container that the item has entered.
          this.entered.emit({item: this, container: newContainer});
          this.dropContainer = newContainer;
          this.dropContainer.enter(this);
        });
      }

      this.dropContainer._sortItem(this, y);
      this._setTransform(this._preview,
                         x - this._pickupPositionInElement.x,
                         y - this._pickupPositionInElement.y);
    } else {
      const activeTransform = this._activeTransform;
      const {x: pageX, y: pageY} = this._getPointerPositionOnPage(event);

      activeTransform.x = pageX - this._pickupPositionOnPage.x + this._passiveTransform.x;
      activeTransform.y = pageY - this._pickupPositionOnPage.y + this._passiveTransform.y;
      this._setTransform(this.element.nativeElement, activeTransform.x, activeTransform.y);
    }
  }

  /** Handler that is invoked when the user lifts their pointer up, after initiating a drag. */
  private _pointerUp = () => {
    this._removeDocumentEvents();
    this._isDragging = false;

    if (!this.dropContainer) {
      this._passiveTransform.x = this._activeTransform.x;
      this._passiveTransform.y = this._activeTransform.y;
      this._ngZone.run(() => this.ended.emit({source: this}));
      return;
    }

    this._animatePreviewToPlaceholder().then(() => {
      this._destroyPreview();
      this._placeholder.parentNode!.insertBefore(this.element.nativeElement, this._placeholder);
      this._destroyPlaceholder();
      this.element.nativeElement.style.display = '';

      // Re-enter the NgZone since we bound `document` events on the outside.
      this._ngZone.run(() => {
        const currentIndex = this._getElementIndexInDOM();

        this.ended.emit({source: this});

        this.dropped.emit({
          item: this,
          currentIndex,
          previousIndex: this._initialContainer.getItemIndex(this),
          container: this.dropContainer,
          previousContainer: this._initialContainer
        });

        this.dropContainer.drop(this, currentIndex, this._initialContainer);
      });
    });
  }

  /**
   * Creates the element that will be rendered next to the user's pointer
   * and will be used as a preview of the element that is being dragged.
   */
  private _createPreviewElement(): HTMLElement {
    let preview: HTMLElement;

    if (this._previewTemplate) {
      const viewRef = this._viewContainerRef.createEmbeddedView(this._previewTemplate.templateRef,
                                                                this._previewTemplate.data);

      preview = viewRef.rootNodes[0];
      this._previewRef = viewRef;
      this._setTransform(preview, this._pickupPositionOnPage.x, this._pickupPositionOnPage.y);
    } else {
      const element = this.element.nativeElement;
      const elementRect = element.getBoundingClientRect();

      preview = element.cloneNode(true) as HTMLElement;
      preview.style.width = `${elementRect.width}px`;
      preview.style.height = `${elementRect.height}px`;
      this._setTransform(preview, elementRect.left, elementRect.top);
    }

    preview.classList.add('cdk-drag-preview');
    return preview;
  }

  /** Creates an element that will be shown instead of the current element while dragging. */
  private _createPlaceholderElement(): HTMLElement {
    let placeholder: HTMLElement;

    if (this._placeholderTemplate) {
      this._placeholderRef = this._viewContainerRef.createEmbeddedView(
        this._placeholderTemplate.templateRef,
        this._placeholderTemplate.data
      );
      placeholder = this._placeholderRef.rootNodes[0];
    } else {
      placeholder = this.element.nativeElement.cloneNode(true) as HTMLElement;
    }

    placeholder.classList.add('cdk-drag-placeholder');
    return placeholder;
  }

  /** Determines the index of the dragable element, based on its index in the DOM. */
  private _getElementIndexInDOM(): number {
    // Note: we may be able to figure this in memory while sorting, but doing so won't be very
    // reliable when transferring between containers, because the new container doesn't have
    // the proper indeces yet. Also this will work better for the case where the consumer
    // isn't using an `ngFor` to render the list.
    const element = this.element.nativeElement;

    if (!element.parentElement) {
      return -1;
    }

    // Avoid accessing `children` and `children.length` too much since they're a "live collection".
    let index = 0;
    const siblings = element.parentElement.children;
    const siblingsLength = siblings.length;
    const draggableElements = this.dropContainer._draggables
        .filter(item => item !== this)
        .map(item => item.element.nativeElement);

    // Loop through the sibling elements to find out the index of the
    // current one, while skipping any elements that aren't draggable.
    for (let i = 0; i < siblingsLength; i++) {
      if (siblings[i] === element) {
        return index;
      } else if (draggableElements.indexOf(siblings[i] as HTMLElement) > -1) {
        index++;
      }
    }

    return -1;
  }

  /**
   * Figures out the coordinates at which an element was picked up.
   * @param event Event that initiated the dragging.
   */
  private _getPointerPositionInElement(event: MouseEvent | TouchEvent): Point {
    const elementRect = this.element.nativeElement.getBoundingClientRect();
    const handleElement = this._handle ? this._handle.element.nativeElement : null;
    const referenceRect = handleElement ? handleElement.getBoundingClientRect() : elementRect;
    const x = this._isTouchEvent(event) ? event.targetTouches[0].pageX - referenceRect.left :
                                          event.offsetX;
    const y = this._isTouchEvent(event) ? event.targetTouches[0].pageY - referenceRect.top :
                                          event.offsetY;

    return {
      x: referenceRect.left - elementRect.left + x,
      y: referenceRect.top - elementRect.top + y
    };
  }

  /**
   * Returns the promise that will resolve when the preview element has finished
   * animating from its current position to the position of the placeholder.
   */
  private _animatePreviewToPlaceholder(): Promise<void> {
    // If the user hasn't moved yet, the transitionend event won't fire.
    if (!this._hasMoved) {
      return Promise.resolve();
    }

    const placeholderRect = this._placeholder.getBoundingClientRect();

    // Apply the class that adds a transition to the preview.
    this._preview.classList.add('cdk-drag-animating');

    // Move the preview to the placeholder position.
    this._setTransform(this._preview, placeholderRect.left, placeholderRect.top);

    // If the element doesn't have a `transition`, the `transitionend` event won't fire. Since
    // we need to trigger a style recalculation in order for the `cdk-drag-animating` class to
    // apply its style, we take advantage of the available info to figure out whether we need to
    // bind the event in the first place.
    const duration = getComputedStyle(this._preview).getPropertyValue('transition-duration');

    if (parseFloat(duration) === 0) {
      return Promise.resolve();
    }

    return this._ngZone.runOutsideAngular(() => {
      return new Promise(resolve => {
        const handler = (event: Event) => {
          if (event.target === this._preview) {
            this._preview.removeEventListener('transitionend', handler);
            resolve();
          }
        };

        this._preview.addEventListener('transitionend', handler);
      });
    });
  }

  /**
   * Sets the `transform` style on an element.
   * @param element Element on which to set the transform.
   * @param x Desired position of the element along the X axis.
   * @param y Desired position of the element along the Y axis.
   */
  private _setTransform(element: HTMLElement, x: number, y: number) {
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  /**
   * Helper to remove an element from the DOM and to do all the necessary null checks.
   * @param element Element to be removed.
   */
  private _removeElement(element: HTMLElement | null) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /** Removes the global event listeners that were bound by this draggable. */
  private _removeDocumentEvents() {
    this._document.removeEventListener('mousemove', this._pointerMove,
      activeEventOptions as any);
    this._document.removeEventListener('touchmove', this._pointerMove,
      activeEventOptions as any);
    this._document.removeEventListener('mouseup', this._pointerUp);
    this._document.removeEventListener('touchend', this._pointerUp);
  }

  /** Determines the point of the page that was touched by the user. */
  private _getPointerPositionOnPage(event: MouseEvent | TouchEvent): Point {
    return this._isTouchEvent(event) ? {x: event.touches[0].pageX, y: event.touches[0].pageY} :
                                       {x: event.pageX, y: event.pageY};
  }

  /** Listener used to prevent `touchmove` events while the element is being dragged. */
  private _preventScrollListener = (event: TouchEvent) => {
    if (this._isDragging) {
      event.preventDefault();
    }
  }

  /** Determines whether an event is a touch event. */
  private _isTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
    return event.type.startsWith('touch');
  }

  /** Destroys the preview element and its ViewRef. */
  private _destroyPreview() {
    if (this._preview) {
      this._removeElement(this._preview);
    }

    if (this._previewRef) {
      this._previewRef.destroy();
    }

    this._preview = this._previewRef = null!;
  }

  /** Destroys the placeholder element and its ViewRef. */
  private _destroyPlaceholder() {
    if (this._placeholder) {
      this._removeElement(this._placeholder);
    }

    if (this._placeholderRef) {
      this._placeholderRef.destroy();
    }

    this._placeholder = this._placeholderRef = null!;
  }
}

/** Point on the page or within an element. */
interface Point {
  x: number;
  y: number;
}
