import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Chip } from './chip';

@Component({
  imports: [Chip],
  template: `<nl-chip [selected]="selected" [compact]="compact" [color]="color">Cours</nl-chip>`,
})
class Hote {
  selected = false;
  compact = false;
  color = 'var(--type-cours)';
}

/**
 * Ce que ce test protège : la seule chose qui distingue une puce « active »
 * d'une puce « au repos » — traduction de `DocumentTypeChip`
 * (`lib/shared/widgets/category_chip.dart`), où le fond et le texte
 * s'inversent exactement à la sélection.
 */
describe('Chip', () => {
  function puce(h: ReturnType<typeof TestBed.createComponent<Hote>>) {
    return h.debugElement.query(By.directive(Chip)).nativeElement as HTMLElement;
  }

  it("n'est pas marquée sélectionnée par défaut", () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    expect(puce(h).className).not.toContain('nl-chip--selected');
  });

  it('porte la classe de sélection une fois activée', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.componentInstance.selected = true;
    h.detectChanges();

    expect(puce(h).className).toContain('nl-chip--selected');
  });

  it('transmet sa couleur en variable CSS inline', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    expect(puce(h).style.getPropertyValue('--chip-color')).toBe('var(--type-cours)');
  });
});
