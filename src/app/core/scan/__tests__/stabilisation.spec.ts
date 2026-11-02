import { describe, expect, it } from 'vitest';
import { StabilisateurCoins } from '../utils/stabilisation';
import type { Quad } from '../utils/geometrie';

const page = (dx = 0, dy = 0): Quad => [
  { x: 0.15 + dx, y: 0.1 + dy }, { x: 0.85 + dx, y: 0.1 + dy }, { x: 0.85 + dx, y: 0.9 + dy }, { x: 0.15 + dx, y: 0.9 + dy },
];

describe('StabilisateurCoins : un contour calme', () => {
  it('n’affiche rien tant que les mesures ne concordent pas (pas de clignotement d’un faux positif)', () => {
    const s = new StabilisateurCoins();
    expect(s.mettre(page(), 0)).toBeNull();
    expect(s.mettre(page(), 100)).toBeNull();
    expect(s.mettre(page(), 200)).not.toBeNull();
  });

  it('une mesure isolée et différente ne déclenche pas l’affichage', () => {
    const s = new StabilisateurCoins();
    s.mettre(page(), 0);
    s.mettre(page(0.3, 0), 100);
    s.mettre(page(0, 0), 200);
    expect(s.mettre(page(0.3, 0.05), 300)).toBeNull();
  });

  it('glisse vers la nouvelle mesure au lieu d’y sauter', () => {
    const s = new StabilisateurCoins();
    for (let t = 0; t < 3; t++) s.mettre(page(), t * 100);
    const apres = s.mettre(page(0.04, 0), 400)!;
    expect(apres[0].x).toBeGreaterThan(0.15);
    expect(apres[0].x).toBeLessThan(0.19); // pas tout le chemin d'un coup
  });

  it('tient quelques instants quand la détection échoue, puis disparaît', () => {
    const s = new StabilisateurCoins();
    for (let t = 0; t < 3; t++) s.mettre(page(), t * 100);
    expect(s.mettre(null, 400)).not.toBeNull();
    expect(s.mettre(null, 800)).not.toBeNull();
    expect(s.mettre(null, 1500)).toBeNull();
  });

  it('un saut brutal du contour n’est suivi qu’une fois confirmé', () => {
    const s = new StabilisateurCoins();
    for (let t = 0; t < 3; t++) s.mettre(page(), t * 100);
    const avant = s.mettre(page(), 300)!;
    const apresSaut = s.mettre(page(0.25, 0.1), 400)!;
    expect(apresSaut[0].x).toBeCloseTo(avant[0].x, 5);
    s.mettre(page(0.25, 0.1), 500);
    const confirme = s.mettre(page(0.25, 0.1), 600)!;
    expect(confirme[0].x).toBeGreaterThan(avant[0].x);
  });
});
