import {browser, by, element, Key} from 'protractor';
import {
  expectToExist,
  expectFocusOn,
  pressKeys,
  clickElementAtPoint,
  waitForElement,
} from '../util/index';

describe('overlay', () => {
  beforeEach(() => browser.get('/overlay'));

  it('should open a connected overlay', () => {
    element(by.id('connected-overlay-button')).click();
    expectToExist('#connected-overlay');
  });

  it('should not close when clicking inside the overlay', () => {
    element(by.id('connected-overlay-button')).click();
    expectToExist('#connected-overlay');

    element(by.id('connected-overlay-inner-button')).click();
    expectToExist('#connected-overlay');
  });

  it('should close a connected overlay when clicking outside', () => {
    element(by.id('connected-overlay-button')).click();
    expectToExist('#connected-overlay');

    element(by.id('regular-button')).click();
    expectToExist('#connected-overlay', false);
  });

  it('should close the overlay when clicking on an element that stops event propagation', () => {
    element(by.id('connected-overlay-button')).click();
    expectToExist('#connected-overlay');

    element(by.id('stops-propagation')).click();
    expectToExist('#connected-overlay', false);
  });
});
