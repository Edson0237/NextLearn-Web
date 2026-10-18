import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Refreshable } from './refreshable';

@Component({
  imports: [Refreshable],
  template: `<nl-refreshable [refreshing]="refreshing" (refresh)="count = count + 1">Liste</nl-refreshable>`,
})
class Hote {
  refreshing = false;
  count = 0;
}

function geste(hote: HTMLElement, sequence: Array<{ type: string; y?: number }>): void {
  for (const etape of sequence) {
    hote.dispatchEvent(
      new PointerEvent(etape.type, { clientY: etape.y ?? 0, pointerId: 1, bubbles: true }),
    );
  }
}

/**
 * Ce que ce test protège : le seuil de déclenchement. `ListeRafraichissable`
 * n'a pas d'équivalent natif sur le web (pas de `RefreshIndicator`) — toute
 * la logique du geste est écrite ici, donc entièrement à la charge de ce
 * test pour ne pas régresser silencieusement.
 */
describe('Refreshable', () => {
  it('déclenche après un tiré qui dépasse le seuil', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();
    const hote = h.debugElement.query(By.directive(Refreshable)).nativeElement as HTMLElement;

    geste(hote, [
      { type: 'pointerdown', y: 0 },
      { type: 'pointermove', y: 90 }, // > seuil par défaut (72)
      { type: 'pointerup' },
    ]);

    expect(h.componentInstance.count).toBe(1);
  });

  it('ne déclenche pas un tiré trop court', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();
    const hote = h.debugElement.query(By.directive(Refreshable)).nativeElement as HTMLElement;

    geste(hote, [
      { type: 'pointerdown', y: 0 },
      { type: 'pointermove', y: 20 },
      { type: 'pointerup' },
    ]);

    expect(h.componentInstance.count).toBe(0);
  });

  it('ne s’arme pas si la liste n’est pas tout en haut', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();
    const hote = h.debugElement.query(By.directive(Refreshable)).nativeElement as HTMLElement;
    hote.scrollTop = 40;

    geste(hote, [
      { type: 'pointerdown', y: 0 },
      { type: 'pointermove', y: 90 },
      { type: 'pointerup' },
    ]);

    expect(h.componentInstance.count).toBe(0);
  });

  it('ignore un nouveau geste pendant un rafraîchissement en cours', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.componentInstance.refreshing = true;
    h.detectChanges();
    const hote = h.debugElement.query(By.directive(Refreshable)).nativeElement as HTMLElement;

    geste(hote, [
      { type: 'pointerdown', y: 0 },
      { type: 'pointermove', y: 90 },
      { type: 'pointerup' },
    ]);

    expect(h.componentInstance.count).toBe(0);
  });
});
