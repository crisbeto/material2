/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
  Point,
  DragRef,
  CdkDragStart,
  CdkDragRelease,
  CdkDrag,
  CdkDropList,
  CdkDragEnter,
} from '@angular/cdk/drag-drop';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';

@Component({
  selector: 'drag-drop-demo',
  templateUrl: 'drag-drop-demo.html',
  styleUrl: 'drag-drop-demo.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    FormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
})
export class DragAndDropDemo {
  cdkDragStart(event: CdkDragStart<string>, i: number) {
    // console.log('DRAGSTART _dragRef: ' + event.source._dragRef);
    // console.log('DRAGSTART Event source data: ' + event.source.data);
    // console.log('DRAGSTART Index: ' + i);
  }
  cdkDragReleased(event: CdkDragRelease<string>, i: number) {
    // console.log('DRAGRELEASE _dragRef: ' + event.source._dragRef);
    // console.log('DRAGRELEASE Event source data: ' + event.source.data);
    // console.log('DRAGSRELEASE Index: ' + i);
  }

  onDragEnter(event: CdkDragEnter<string[], any>) {
    // console.log('Drag entered list:');
    // You can add custom logic here, like highlighting the drop zone
  }

  drop(event: CdkDragDrop<string[]>) {
    /* the item can be put in at the correct index, but to showcase the error with the placeholder this was left out
        if (event.previousContainer === event.container) {
      // Card dropped back to its original list
      event.container.data.splice(event.previousIndex, 0);
    } else {
    */

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
  }

  title = 'DEV || cdkDroplistsSortedToBottom';
  movies1 = ['List1 - StartItem 1 ', 'List1 - StartItem 2', 'List1 - StartItem 3'];
  movies2 = ['List2 - StartItem 1 ', 'List2 - StartItem 2', 'List2 - StartItem 3'];
  movies3 = [
    'List3 - StartItem 1',
    'List3 - StartItem 2',
    'List3 - StartItem 3',
    'List3 - StartItem 4',
  ];

  CardPlaceablePredicate() {
    return true;
  }

  /**
   * Predicate so only allows sorting into last index
   */
  addToEndPredicate(index: number, item: CdkDrag<number>, itemList: CdkDropList) {
    return index === itemList.data.length;
  }

  /**
   * Predicate function that only allows even numbers to be
   * sorted into even indices and odd numbers at odd indices.
   */
  sortPredicate(index: number, item: CdkDrag<number>) {
    return (index + 1) % 2 === item.data % 2;
  }
}
