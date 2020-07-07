/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatToolbarModule} from '@angular/material/toolbar';
import {RouterModule} from '@angular/router';
import {SelectDemo} from './select-demo';
import {OverlayModule} from '@angular/cdk/overlay';
import {
  NewSelect,
  NewOption,
  NewOptionListItem,
  NewSelectList,
  NewSelectCombobox,
  NewSelectComboboxDialog,
} from './new-select';
import {A11yModule} from '@angular/cdk/a11y';

@NgModule({
  imports: [
    A11yModule,
    OverlayModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatToolbarModule,
    ReactiveFormsModule,
    RouterModule.forChild([{path: '', component: SelectDemo}]),
  ],
  declarations: [
    SelectDemo,
    NewSelect,
    NewOption,
    NewSelectList,
    NewOptionListItem,
    NewSelectCombobox,
    NewSelectComboboxDialog,
  ],
})
export class SelectDemoModule {
}
