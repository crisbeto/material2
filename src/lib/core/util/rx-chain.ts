/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
import {StrictRxChain} from './rx-operators';

export class RxChain<T> {
  constructor(private _context: Observable<T>) { }

  static from<T>(context: Observable<T>): StrictRxChain<T> {
    return new RxChain(context);
  }

  call(operator: Function, ...args: any[]): RxChain<any> {
    this._context = operator.call(this._context, ...args);
    return this;
  }

  subscribe(fn: (t: T) => void): Subscription {
    return this._context.subscribe(fn);
  }

  result(): Observable<T> {
    return this._context;
  }
}
