import {
  Component,
  ViewChild,
  ElementRef,
  ViewContainerRef,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import {Overlay, OverlayConfig} from '@angular/cdk/overlay';
import {TemplatePortal} from '@angular/cdk/portal';

@Component({
  moduleId: module.id,
  selector: 'overlay-e2e',
  templateUrl: 'overlay-e2e.html',
  styleUrls: ['overlay-e2e.css'],
  encapsulation: ViewEncapsulation.None,
})
export class OverlayE2E {
  @ViewChild('origin') origin: ElementRef;
  @ViewChild('connectedOverlay') connectedOverlay: TemplateRef<any>;

  constructor(private _overlay: Overlay, private _viewContainerRef: ViewContainerRef) { }

  open() {
    const strategy = this._overlay.position()
      .connectedTo(this.origin,
        {originX: 'start', originY: 'bottom'},
        {overlayX: 'start', overlayY: 'top'});

    const config = new OverlayConfig({positionStrategy: strategy});
    const overlayRef = this._overlay.create(config);

    overlayRef.attach(new TemplatePortal(this.connectedOverlay, this._viewContainerRef));
    overlayRef.outsideClick().subscribe(() => overlayRef.dispose());
  }
}
