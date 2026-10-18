import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Pressable } from './pressable';

@Component({
  imports: [Pressable],
  template: `<div nlPressable (click)="clics = clics + 1">Carte</div>`,
})
class Hote {
  clics = 0;
}

/**
 * Ce que ce test protège : la navigation au clavier d'un `<div
 * role="button">`, qui n'a — à la différence d'un `<button>` natif — rien
 * nativement. Sans la directive, Entrée et Espace ne font rien du tout.
 */
describe('Pressable', () => {
  it('pose le rôle bouton et le rend focusable', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    const hote = h.debugElement.query(By.directive(Pressable)).nativeElement as HTMLElement;
    expect(hote.getAttribute('role')).toBe('button');
    expect(hote.getAttribute('tabindex')).toBe('0');
  });

  it('active au clic', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();

    h.debugElement.query(By.directive(Pressable)).nativeElement.click();
    expect(h.componentInstance.clics).toBe(1);
  });

  it('active sur Entrée et sur Espace', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();
    const hote = h.debugElement.query(By.directive(Pressable)).nativeElement as HTMLElement;

    hote.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    hote.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(h.componentInstance.clics).toBe(2);
  });

  it('ignore les autres touches', () => {
    const h = TestBed.configureTestingModule({ imports: [Hote] }).createComponent(Hote);
    h.detectChanges();
    const hote = h.debugElement.query(By.directive(Pressable)).nativeElement as HTMLElement;

    hote.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(h.componentInstance.clics).toBe(0);
  });
});
