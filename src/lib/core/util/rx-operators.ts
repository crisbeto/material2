/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';
import {map as _map} from 'rxjs/operator/map';
import {filter as _filter} from 'rxjs/operator/filter';
import {reduce as _reduce} from 'rxjs/operator/reduce';
import {share as _share} from 'rxjs/operator/share';
import {_finally as __finally} from 'rxjs/operator/finally';
import {_catch as __catch} from 'rxjs/operator/catch';
import {_do as __do} from 'rxjs/operator/do';

export declare class MapBrand { private _x; }
export declare class FilterBrand { private _x; }
export declare class ReduceBrand { private _x; }
export declare class ShareBrand { private _x; }
export declare class FinallyBrand { private _x; }
export declare class CatchBrand { private _x; }
export declare class DoBrand { private _x; }

export type mapOperator<T, R> = typeof _map & MapBrand;
export type filterOperator<T> = typeof _filter & FilterBrand;
export type reduceOperator<T> = typeof _reduce & ReduceBrand;
export type shareOperator<T> = typeof _share & ShareBrand;
export type finallyOperator<T> = typeof __finally & FinallyBrand;
export type catchOperator<T> = typeof __catch & CatchBrand;
export type doOperator<T> = typeof __do & DoBrand;

export interface StrictRxChain<T> {
  call(operator: filterOperator<T>,
      predicate: (value: T, index: number) => boolean, thisArg?: any): StrictRxChain<T>;
  call<R>(operator: mapOperator<T, R>,
      project: (value: T, index: number) => R, thisArg?: any): StrictRxChain<R>;
  call(operator: reduceOperator<T>,
      accumulator: (acc: T, value: T, index: number) => T, seed?: T): StrictRxChain<T>;
  call(operator: shareOperator<T>): StrictRxChain<T>;
  call(operator: finallyOperator<T>, action: () => any): StrictRxChain<T>;
  call(operator: catchOperator<T>, ...actions: ((...args) => any)[]): StrictRxChain<T>;
  call(operator: doOperator<T>, observer: (...args) => any, onError?: () => any,
      onCompleted?: () => any): StrictRxChain<T>;

  subscribe(fn: (t: T) => void): Subscription;

  result(): Observable<T>;
}

export const map = _map as typeof _map & MapBrand;
export const filter = _filter as typeof _filter & FilterBrand;
export const reduce = _reduce as typeof _reduce & ReduceBrand;
export const share = _share as typeof _share & ShareBrand;
export const _finally = __finally as typeof __finally & FinallyBrand;
export const _catch = __catch as typeof __catch & CatchBrand;
export const _do = __do as typeof __do & DoBrand;
