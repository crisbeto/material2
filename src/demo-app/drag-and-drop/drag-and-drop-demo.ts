/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  Component,
  Directive,
  Optional,
  ContentChildren,
  forwardRef,
  ViewContainerRef,
  TemplateRef,
  QueryList,
  EmbeddedViewRef,
  ElementRef,
  ViewChild,
  Inject,
  Input,
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {startWith} from 'rxjs/operators/startWith';

@Directive({
  selector: '[cdkDropPlaceholder]',
})
export class CdkDropPlaceholder {
  constructor(public viewContainerRef: ViewContainerRef) {}
}

@Component({
  selector: 'cdk-drop',
  exportAs: 'cdkDrop',
  template: '<ng-container cdkDropPlaceholder></ng-container>',
  host: {
    'class': 'cdk-drop',
    '[class.cdk-drop-dragging]': '_dragging'
  }
})
export class CdkDrop {
  @ViewChild(CdkDropPlaceholder) _placeholder: CdkDropPlaceholder;
  @Input('connectedTo') siblings: CdkDrop[] = [];
  private _draggables: CdkDrag[] = [];

  constructor(public element: ElementRef) {}

  dragging = false;
  positionCache = {
    items: [] as {drag: CdkDrag, rect: ClientRect}[],
    siblings: [] as {drop: CdkDrop, rect: ClientRect}[]
  };

  move(drag: CdkDrag, index: number) {
    const viewContainerRef = this._placeholder.viewContainerRef;
    const currentIndex = viewContainerRef.indexOf(drag.viewRef);

    if (currentIndex !== index) {
      const previousItem = this._draggables[index];

      // TODO: consider sorting the draggables based on the index of
      // their `ViewRef`, rather than maintaining the index ourselves.
      this._draggables[index] = drag;
      this._draggables[currentIndex] = previousItem;
      this._placeholder.viewContainerRef.move(drag.viewRef, index);

      // Since the elements have new positions, we have to update the cache.
      if (this.dragging) {
        this._updatePositionCache();
      }
    }
  }

  insert(drag: CdkDrag) {
    // TODO: try to handle `NgFor` correctly.
    this._draggables.push(drag);
    drag._insert(this._placeholder.viewContainerRef);

    if (this.dragging) {
      this._updatePositionCache();
    }
  }

  remove(drag: CdkDrag) {
    const index = this._draggables.indexOf(drag);
    const viewIndex = this._placeholder.viewContainerRef.indexOf(drag.viewRef);

    if (index > -1) {
      this._draggables.splice(index, 1);
    }

    if (viewIndex > -1) {
      this._placeholder.viewContainerRef.remove(viewIndex);
    }

    if (this.dragging) {
      this._updatePositionCache();
    }
  }

  start() {
    this.dragging = true;
    this._updatePositionCache();
  }

  stop() {
    this.dragging = false;
    this.positionCache.items = [];
    this.positionCache.siblings = [];
  }

  private _updatePositionCache() {
    this.positionCache.items = this._draggables
      .map(drag => ({drag, rect: drag.element.getBoundingClientRect()}))
      .sort((a, b) => a.rect.top > b.rect.top ? 1 : -1);

    this.positionCache.siblings = this.siblings
      .map(drop => ({drop, rect: drop.element.nativeElement.getBoundingClientRect()}));
  }
}

@Directive({
  selector: '[cdkDrag]',
})
export class CdkDrag {
  private _document: Document;
  private _viewRef: EmbeddedViewRef<any>;
  private _preview: HTMLElement;
  private _pickupPosition: {x: number, y: number};

  get element(): HTMLElement {
    return this._viewRef.rootNodes[0];
  }

  get viewRef() {
    return this._viewRef;
  }

  constructor(
    @Inject(DOCUMENT) document: any,
    private _template: TemplateRef<any>,
    private _viewContainerRef: ViewContainerRef,
    private _dropContainer: CdkDrop) {
      this._document = document;

      if (_dropContainer) {
        _dropContainer.insert(this);
      } else {
        this._insert(_viewContainerRef);
      }
    }

  _insert(viewContainerRef: ViewContainerRef) {
    if (this._viewRef) {
      this._viewRef.destroy();
    }

    this._viewRef = viewContainerRef.createEmbeddedView(this._template);
    this.element.classList.add('cdk-drag');
    this.element.addEventListener('mousedown', this._mousedown);
  }

  private _mousedown = (event: MouseEvent) => {
    const preview = this._preview = this.element.cloneNode(true) as HTMLElement;
    const rect = this.element.getBoundingClientRect();

    this._setDragStyling();
    this._setTransform(preview, rect.left, rect.top);
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    this._pickupPosition = {x: event.offsetX, y: event.offsetY};
    this._dropContainer.start();

    this._document.body.appendChild(preview);
    this._document.addEventListener('mousemove', this._mousemove);
    this._document.addEventListener('mouseup', this._mouseup);
  }

  private _mousemove = (event: MouseEvent) => {
    const {clientX: x, clientY: y} = event;

    event.preventDefault();
    this._setTransform(this._preview, x - this._pickupPosition.x, y - this._pickupPosition.y);

    const enteredContainer = this._dropContainer.positionCache.siblings.find(({rect}) => {
      return y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right;
    });

    if (enteredContainer) {
      // Remove from the old container.
      this._dropContainer.remove(this);
      this._dropContainer.stop();
      this._viewRef.destroy();

      // Attach to the new one.
      this._dropContainer = enteredContainer.drop;
      this._dropContainer.insert(this);
      this._dropContainer.start();
      this._moveInParent(y);
      this._setDragStyling();
    } else {
      this._moveInParent(y);
    }
  }

  private _mouseup = async () => {
    this._document.removeEventListener('mousemove', this._mousemove);
    this._document.removeEventListener('mouseup', this._mouseup);

    const rect = this.element.getBoundingClientRect();

    this._preview.classList.add('cdk-drag-animating');
    this._setTransform(this._preview, rect.left, rect.top);
    this._forceStyleRecalc(this._preview);
    await this._nextEvent(this._preview, 'transitionend');
    this._dropContainer.stop();
    this.element.classList.remove('cdk-drag-target');
    this._preview.parentNode!.removeChild(this._preview);
  }

  // TODO: only covers Y axis sorting
  private _moveInParent(y: number) {
    const newIndex = this._dropContainer.positionCache.items.findIndex(({drag, rect}) => {
      return drag !== this && y > rect.top && y < rect.bottom;
    });

    if (newIndex > -1) {
      this._dropContainer.move(this, newIndex);
    }
  }

  private _setDragStyling() {
    this._preview.classList.add('cdk-drag-indicator');
    this.element.classList.add('cdk-drag-target');
  }

  private _forceStyleRecalc(element: HTMLElement) {
    getComputedStyle(element).getPropertyValue('opacity');
  }

  private _nextEvent(element: HTMLElement, eventName: string): Promise<void> {
    return new Promise(resolve => {
      const handler = (event: Event) => {
        if (event.target === element) {
          element.removeEventListener(eventName, handler);
          resolve();
        }
      };

      element.addEventListener(eventName, handler);
    });
  }

  private _setTransform(element: HTMLElement, x: number, y: number) {
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}

@Component({
  moduleId: module.id,
  selector: 'drag-and-drop-demo',
  templateUrl: 'drag-and-drop-demo.html',
  styleUrls: ['drag-and-drop-demo.css'],
})
export class DragAndDropDemo {
  todo = [
    'Come up with catchy start-up name',
    'Add "blockchain" to name',
    'Sell out',
    'Profit',
    'Go to sleep'
  ];
  done = [
    'Get up',
    'Have breakfast',
    'Brush teeth',
    'Check reddit'
  ];
}
