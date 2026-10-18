import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PinInput } from './pin-input';

@Component({
  imports: [PinInput],
  template: `<nl-pin-input [pin]="pin" (digit)="dernierChiffre = $event" (backspace)="effaces = effaces + 1" />`,
})
class Hote {
  pin = '';
  dernierChiffre = '';
  effaces = 0;
}

/**
 * Ce que ce test protège : les deux garde-fous de `PinInputWidget` qu'un
 * clic ne devrait jamais pouvoir contourner — pas de cinquième chiffre, pas
 * d'effacement sur un code déjà vide — et l'annonce comptée pour les
 * lecteurs d'écran, puisque les points eux-mêmes ne disent rien.
 */
describe('PinInput', () => {
  it('annonce « aucun chiffre » quand le code est vide', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    const compteur = h.debugElement.query(By.css('[role="img"]')).nativeElement as HTMLElement;
    expect(compteur.getAttribute('aria-label')).toBe('Aucun chiffre saisi sur 4');
  });

  it('accorde l’annonce au pluriel au-delà d’un chiffre', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.componentInstance.pin = '12';
    h.detectChanges();

    const compteur = h.debugElement.query(By.css('[role="img"]')).nativeElement as HTMLElement;
    expect(compteur.getAttribute('aria-label')).toBe('2 chiffres saisis sur 4');
  });

  it('désactive les touches numériques une fois les 4 chiffres saisis', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.componentInstance.pin = '1234';
    h.detectChanges();

    const touches = h.debugElement.queryAll(By.css('.nl-pin__touche:not(.nl-pin__touche--secondaire):not(.nl-pin__touche--vide)'));
    for (const touche of touches) {
      expect((touche.nativeElement as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('désactive l’effacement quand le code est vide', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    const effacer = h.debugElement.query(By.css('.nl-pin__touche--secondaire')).nativeElement as HTMLButtonElement;
    expect(effacer.disabled).toBe(true);
  });

  it('relaie le chiffre tapé', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    const boutons = h.debugElement.queryAll(By.css('.nl-pin__touche'));
    const bouton5 = boutons.find((b) => (b.nativeElement as HTMLElement).textContent?.trim() === '5');
    bouton5!.nativeElement.click();

    expect(h.componentInstance.dernierChiffre).toBe('5');
  });
});
