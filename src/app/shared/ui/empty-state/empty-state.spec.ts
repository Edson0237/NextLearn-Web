import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EmptyState } from './empty-state';
import { Button } from '../button/button';

@Component({
  imports: [EmptyState],
  template: `
    <nl-empty-state title="Rien ici" subtitle="Revenez plus tard" [ctaLabel]="cta" (cta)="clics = clics + 1">
      <span icon>★</span>
    </nl-empty-state>
  `,
})
class Hote {
  cta?: string;
  clics = 0;
}

/**
 * Ce que ce test protège : le bouton d'action, le seul morceau conditionnel
 * d'`EmptyState` (`lib/shared/widgets/empty_state.dart` : « le dernier
 * [élément] est le plus important : un écran vide qui ne dit pas quoi faire
 * laisse l'utilisateur conclure que l'application est cassée »). Sans
 * `ctaLabel`, il ne doit pas apparaître ; avec, son clic doit remonter.
 */
describe('EmptyState', () => {
  it("n'affiche pas de bouton sans ctaLabel", () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    expect(h.debugElement.query(By.directive(Button))).toBeNull();
  });

  it('affiche le bouton et relaie le clic une fois ctaLabel fourni', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.componentInstance.cta = 'Réessayer';
    h.detectChanges();

    const bouton = h.debugElement.query(By.directive(Button));
    expect(bouton).not.toBeNull();

    bouton.nativeElement.click();
    expect(h.componentInstance.clics).toBe(1);
  });

  it('affiche le titre et le sous-titre fournis', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    const texte = h.nativeElement.textContent as string;
    expect(texte).toContain('Rien ici');
    expect(texte).toContain('Revenez plus tard');
  });
});
