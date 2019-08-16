/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component} from '@angular/core';
import {EXAMPLE_COMPONENTS} from '@angular/material-examples';

@Component({
  moduleId: module.id,
  selector: 'mdc-tabs-demo',
  templateUrl: 'mdc-tabs-demo.html',
  styleUrls: ['mdc-tabs-demo.css'],
})
export class MdcTabsDemo {
  examples = Object.keys(EXAMPLE_COMPONENTS).filter(example => example.startsWith('mdc-tab-'));
}
