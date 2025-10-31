/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ChangeDetectionStrategy,
  signal,
  Component,
  ViewEncapsulation,
  viewChild,
  ElementRef,
  computed,
  afterRenderEffect,
} from '@angular/core';
import {OverlayModule} from '@angular/cdk/overlay';
import {Combobox, ComboboxInput} from '@angular/aria/combobox';
import {Listbox, Option} from '@angular/aria/listbox';

@Component({
  templateUrl: 'autocomplete-docs-demo.html',
  styleUrl: 'autocomplete-docs-demo.css',
  imports: [Combobox, ComboboxInput, Listbox, Option, OverlayModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutocompleteDocsDemo {
  listbox = viewChild<Listbox<any>>(Listbox);
  combobox = viewChild<Combobox<any>>(Combobox);

  options = signal(states);

  filter(inputValue: string) {
    const displayedStates = states.filter(state =>
      state.toLowerCase().includes(inputValue.toLowerCase()),
    );
    this.options.set(displayedStates);
  }

  resetOptions() {
    this.options.set(states);
  }

  constructor() {
    // This fires too early on the initial popup
    afterRenderEffect(() => {
      if (this.combobox()?.expanded()) {
        this.listbox()?.scrollActiveItemIntoView();
      }
    });
  }
}

const states = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];
