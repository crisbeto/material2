import {PositionStrategy} from './position-strategy';


/**
 * A strategy for positioning overlays. Using this strategy, an overlay is given an
 * explicit position relative to the browser's viewport.
 */
export class GlobalPositionStrategy implements PositionStrategy {
  private _cssPosition: string = 'static';
  private _topOffset: string = '';
  private _bottomOffset: string = '';
  private _leftOffset: string = '';
  private _rightOffset: string = '';
  private _alignItems: string = '';
  private _justifyContent: string = '';

  /** Sets the top position of the overlay. Clears any previously set vertical position. */
  top(value: string) {
    this._bottomOffset = '';
    this._topOffset = value;
    this._alignItems = 'flex-start';
    return this;
  }

  /** Sets the left position of the overlay. Clears any previously set horizontal position. */
  left(value: string) {
    this._rightOffset = '';
    this._leftOffset = value;
    this._justifyContent = 'flex-start';
    return this;
  }

  /** Sets the bottom position of the overlay. Clears any previously set vertical position. */
  bottom(value: string) {
    this._topOffset = '';
    this._bottomOffset = value;
    this._alignItems = 'flex-end';
    return this;
  }

  /** Sets the right position of the overlay. Clears any previously set horizontal position. */
  right(value: string) {
    this._leftOffset = '';
    this._rightOffset = value;
    this._justifyContent = 'flex-end';
    return this;
  }

  /**
   * Centers the overlay horizontally with an optional offset.
   * Clears any previously set horizontal position.
   */
  centerHorizontally(offset = '0px') {
    this.left(offset);
    this._justifyContent = 'center';
    return this;
  }

  /**
   * Centers the overlay vertically with an optional offset.
   * Clears any previously set vertical position.
   */
  centerVertically(offset = '0px') {
    this.top(offset);
    this._alignItems = 'center';
    return this;
  }

  /**
   * Apply the position to the element.
   * TODO: internal
   */
  apply(element: HTMLElement): Promise<void> {
    let styles = element.style;
    let parentStyles = (element.parentNode as HTMLElement).style;

    styles.position = this._cssPosition;
    styles.marginTop = this._topOffset;
    styles.marginLeft = this._leftOffset;
    styles.marginBottom = this._bottomOffset;
    styles.marginRight = this._rightOffset;

    parentStyles.justifyContent = this._justifyContent;
    parentStyles.alignItems = this._alignItems;

    return Promise.resolve(null);
  }
}
