import {Component, Type, ViewChild, ElementRef, ViewChildren, QueryList} from '@angular/core';
import {TestBed, ComponentFixture, fakeAsync, flush} from '@angular/core/testing';
import {CdkDragDropModule} from './drag-drop-module';
import {dispatchMouseEvent, dispatchTouchEvent} from '@angular/cdk/testing';
import {CdkDrag} from './drag';
import {CdkDragDrop} from './drag-events';
import { moveItemInArray } from './drag-utils';
import {CdkDrop} from './drop';

const ITEM_HEIGHT = 25;

describe('CdkDrag', () => {
  function createComponent<T>(componentType: Type<T>): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [CdkDragDropModule],
      declarations: [componentType],
    }).compileComponents();

    return TestBed.createComponent<T>(componentType);
  }

  describe('standalone draggable', () => {
    describe('mouse dragging', () => {
      it('should drag an element freely to a particular position', fakeAsync(() => {
        const fixture = createComponent(StandaloneDraggable);
        fixture.detectChanges();
        const dragElement = fixture.componentInstance.dragElement.nativeElement;

        expect(dragElement.style.transform).toBeFalsy();
        dragElementViaMouse(fixture, dragElement, 50, 100);
        expect(dragElement.style.transform).toBe('translate3d(50px, 100px, 0px)');
      }));

      it('should continue dragging the element from where it was left off', fakeAsync(() => {
        const fixture = createComponent(StandaloneDraggable);
        fixture.detectChanges();
        const dragElement = fixture.componentInstance.dragElement.nativeElement;

        expect(dragElement.style.transform).toBeFalsy();

        dragElementViaMouse(fixture, dragElement, 50, 100);
        expect(dragElement.style.transform).toBe('translate3d(50px, 100px, 0px)');

        dragElementViaMouse(fixture, dragElement, 100, 200);
        expect(dragElement.style.transform).toBe('translate3d(150px, 300px, 0px)');
      }));
    });

    describe('touch dragging', () => {
      it('should drag an element freely to a particular position', fakeAsync(() => {
        const fixture = createComponent(StandaloneDraggable);
        fixture.detectChanges();
        const dragElement = fixture.componentInstance.dragElement.nativeElement;

        expect(dragElement.style.transform).toBeFalsy();
        dragElementViaTouch(fixture, dragElement, 50, 100);
        expect(dragElement.style.transform).toBe('translate3d(50px, 100px, 0px)');
      }));

      it('should continue dragging the element from where it was left off', fakeAsync(() => {
        const fixture = createComponent(StandaloneDraggable);
        fixture.detectChanges();
        const dragElement = fixture.componentInstance.dragElement.nativeElement;

        expect(dragElement.style.transform).toBeFalsy();

        dragElementViaTouch(fixture, dragElement, 50, 100);
        expect(dragElement.style.transform).toBe('translate3d(50px, 100px, 0px)');

        dragElementViaTouch(fixture, dragElement, 100, 200);
        expect(dragElement.style.transform).toBe('translate3d(150px, 300px, 0px)');
      }));

      it('should prevent the default `touchmove` action on the page while dragging',
        fakeAsync(() => {
          const fixture = createComponent(StandaloneDraggable);
          fixture.detectChanges();

          dispatchTouchEvent(fixture.componentInstance.dragElement.nativeElement, 'touchstart');
          fixture.detectChanges();

          expect(dispatchTouchEvent(document, 'touchmove').defaultPrevented).toBe(true);

          dispatchTouchEvent(document, 'touchend');
          fixture.detectChanges();
        }));
    });

    it('should dispatch an event when the user has started dragging', fakeAsync(() => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      dispatchMouseEvent(fixture.componentInstance.dragElement.nativeElement, 'mousedown');
      fixture.detectChanges();

      expect(fixture.componentInstance.startedSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        source: fixture.componentInstance.dragInstance
      }));
    }));

    it('should dispatch an event when the user has stopped dragging', fakeAsync(() => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 5, 10);

      expect(fixture.componentInstance.endedSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        source: fixture.componentInstance.dragInstance
      }));
    }));
  });

  describe('draggable with a handle', () => {
    it('should not be able to drag the entire element if it has a handle', fakeAsync(() => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBeFalsy();
    }));

    it('should be able to drag an element using its handle', fakeAsync(() => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform).toBe('translate3d(50px, 100px, 0px)');
    }));
  });

  describe('in a drop container', () => {
    it('should dispatch the `dropped` event when an item has been dropped', fakeAsync(() => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;

      expect(dragItems.map(drag => drag.element.nativeElement.textContent!.trim()))
          .toEqual(['Zero', 'One', 'Two', 'Three']);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.nativeElement.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element.nativeElement,
          thirdItemRect.left + 1, thirdItemRect.top + 1);
      flush();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledWith(jasmine.objectContaining({
        previousIndex: 0,
        currentIndex: 2,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance
      }));

      expect(dragItems.map(drag => drag.element.nativeElement.textContent!.trim()))
          .toEqual(['One', 'Two', 'Zero', 'Three']);
    }));

    it('should create a preview element while the element is dragged', fakeAsync(() => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element.nativeElement;
      const itemRect = item.getBoundingClientRect();
      const initialParent = item.parentNode;

      dispatchMouseEvent(item, 'mousedown');
      fixture.detectChanges();

      const preview = document.querySelector('.cdk-drag-preview')! as HTMLElement;
      const previewRect = preview.getBoundingClientRect();

      expect(item.parentNode).toBe(document.body, 'Expected element to be moved out into the body');
      expect(item.style.display).toBe('none', 'Expected element to be hidden');
      expect(preview).toBeTruthy('Expected preview to be in the DOM');
      expect(preview.textContent!.trim())
          .toContain('One', 'Expected preview content to match element');
      expect(previewRect.width).toBe(itemRect.width, 'Expected preview width to match element');
      expect(previewRect.height).toBe(itemRect.height, 'Expected preview height to match element');

      dispatchMouseEvent(document, 'mouseup');
      fixture.detectChanges();
      flush();

      expect(item.parentNode)
          .toBe(initialParent, 'Expected element to be moved back into its old parent');
      expect(item.style.display).toBeFalsy('Expected element to be visible');
      expect(preview.parentNode).toBeFalsy('Expected preview to be removed from the DOM');
    }));
  });

});

@Component({
  template: `
    <div
      cdkDrag
      (started)="startedSpy($event)"
      (ended)="endedSpy($event)"
      #dragElement
      style="width: 100px; height: 100px; background: red;"></div>
  `
})
export class StandaloneDraggable {
  @ViewChild('dragElement') dragElement: ElementRef<HTMLElement>;
  @ViewChild(CdkDrag) dragInstance: CdkDrag;
  startedSpy = jasmine.createSpy('started spy');
  endedSpy = jasmine.createSpy('ended spy');
}

@Component({
  template: `
    <div #dragElement cdkDrag style="width: 100px; height: 100px; background: red;">
      <div #handleElement cdkDragHandle style="width: 10px; height: 10px; background: green;"></div>
    </div>
  `
})
export class StandaloneDraggableWithHandle {
  @ViewChild('dragElement') dragElement: ElementRef<HTMLElement>;
  @ViewChild('handleElement') handleElement: ElementRef<HTMLElement>;
  @ViewChild(CdkDrag) dragInstance: CdkDrag;
}


@Component({
  template: `
    <cdk-drop
      style="display: block; width: 100px; background: pink;"
      [data]="items"
      (dropped)="droppedSpy($event)">
      <div
        *ngFor="let item of items"
        cdkDrag
        style="width: 100%; height: ${ITEM_HEIGHT}px; background: red;">{{item}}</div>
    </cdk-drop>
  `
})
export class DraggableInDropZone {
  @ViewChildren(CdkDrag) dragItems: QueryList<CdkDrag>;
  @ViewChild(CdkDrop) dropInstance: CdkDrop;
  items = ['Zero', 'One', 'Two', 'Three'];
  droppedSpy = jasmine.createSpy('dropped spy').and.callFake((event: CdkDragDrop<string[]>) => {
    moveItemInArray(this.items, event.previousIndex, event.currentIndex);
  });
}


/**
 * Drags an element to a position on the page using the mouse.
 * @param fixture Fixture on which to run change detection.
 * @param element Element which is being dragged.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
function dragElementViaMouse(fixture: ComponentFixture<any>,
    element: HTMLElement, x: number, y: number) {

  dispatchMouseEvent(element, 'mousedown');
  fixture.detectChanges();

  dispatchMouseEvent(document, 'mousemove', x, y);
  fixture.detectChanges();

  dispatchMouseEvent(document, 'mouseup');
  fixture.detectChanges();
}

/**
 * Drags an element to a position on the page using a touch device.
 * @param fixture Fixture on which to run change detection.
 * @param element Element which is being dragged.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
function dragElementViaTouch(fixture: ComponentFixture<any>,
    element: HTMLElement, x: number, y: number) {

  dispatchTouchEvent(element, 'touchstart');
  fixture.detectChanges();

  dispatchTouchEvent(document, 'touchmove', x, y);
  fixture.detectChanges();

  dispatchTouchEvent(document, 'touchend');
  fixture.detectChanges();
}
