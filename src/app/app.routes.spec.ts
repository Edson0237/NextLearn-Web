import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Location } from '@angular/common';
import { routes } from './app.routes';
import { App } from './app';

/**
 * Ce que ce test protège : la coexistence vitrine + PWA sur un seul
 * domaine (voir docs/pwa-migration/AUDIT_PHASE1.md, §0 — la décision
 * d'architecture). `App` a été réduit à une coque de routage et la vitrine
 * déplacée dans `features/vitrine/` ; une régression de ce découpage
 * laisserait soit `/` vide, soit `/app/design-system` introuvable, sans
 * qu'aucune erreur de compilation ne le signale — Angular résout les routes
 * à l'exécution.
 */
describe('Routage racine', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    });
  });

  it('« / » résout vers la vitrine', async () => {
    const harness = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    harness.detectChanges();

    // `Location.path()` normalise la racine en chaîne vide, pas en « / ».
    expect(TestBed.inject(Location).path()).toBe('');
  });

  it('« /app/design-system » résout vers la page de démonstration', async () => {
    const harness = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const navigation = await router.navigateByUrl('/app/design-system');
    harness.detectChanges();

    // `navigateByUrl` renvoie `false` si aucune route ne correspond — c'est
    // précisément ce qu'une route mal câblée produirait, silencieusement.
    expect(navigation).toBe(true);
  });
});
