import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Button } from './button';

@Component({
  imports: [Button],
  template: `<button nlButton [variant]="variant" [size]="size" [fullWidth]="fullWidth">Go</button>`,
})
class Hote {
  variant: 'primary' | 'outline' | 'text' = 'primary';
  size: 'md' | 'sm' = 'md';
  fullWidth = true;
}

describe('Button', () => {
  function bouton(h: ReturnType<typeof TestBed.createComponent<Hote>>) {
    return h.debugElement.query(By.directive(Button));
  }

  it('porte la classe de sa variante et de sa taille', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    const classes = bouton(h).nativeElement.className;
    expect(classes).toContain('nl-btn--primary');
    expect(classes).toContain('nl-btn--md');
    expect(classes).toContain('nl-btn--full');
  });

  it('retire la classe pleine largeur quand fullWidth est faux', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.componentInstance.fullWidth = false;
    h.detectChanges();

    expect(bouton(h).nativeElement.className).not.toContain('nl-btn--full');
  });

  it.each(['primary', 'outline', 'text'] as const)(
    'porte la classe de la variante « %s »',
    (variante) => {
      // Une fixture neuve par cas plutôt qu'une boucle sur une fixture
      // partagée : réutiliser la même déclenche un faux
      // ExpressionChangedAfterItHasBeenCheckedError — la valeur change bel et
      // bien d'une itération à l'autre, par construction du test, pas par un
      // effet de bord du composant.
      const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
      h.componentInstance.variant = variante;
      h.detectChanges();

      expect(bouton(h).nativeElement.className).toContain(`nl-btn--${variante}`);
    },
  );
});
