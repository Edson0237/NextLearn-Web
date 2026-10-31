import { TestBed } from '@angular/core/testing';
import { VerrouPin } from './verrou-pin';

/**
 * Une horloge qui ne pardonne pas une erreur d'un cran : 30 s, 1 min, 2 min,
 * 4 min… plafonné à 15 min. Une off-by-one se traduirait par un blocage qui ne
 * bloque pas, ou qui bloque trop tôt.
 */
describe('VerrouPin', () => {
  let verrou: VerrouPin;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    verrou = TestBed.inject(VerrouPin);
  });

  it('ne bloque pas avant le cinquième échec', () => {
    for (let i = 0; i < 4; i++) verrou.enregistrerEchec();
    expect(verrou.bloqueJusqua()).toBeNull();
  });

  it('bloque 30 secondes au cinquième échec', () => {
    for (let i = 0; i < 5; i++) verrou.enregistrerEchec();

    const jusqua = verrou.bloqueJusqua();
    expect(jusqua).not.toBeNull();
    const secondes = Math.round((jusqua!.getTime() - Date.now()) / 1000);
    expect(secondes).toBeGreaterThanOrEqual(29);
    expect(secondes).toBeLessThanOrEqual(30);
  });

  it('double le délai à chaque échec supplémentaire', () => {
    for (let i = 0; i < 6; i++) verrou.enregistrerEchec(); // palier 2 : 60 s
    const secondes = Math.round((verrou.bloqueJusqua()!.getTime() - Date.now()) / 1000);
    expect(secondes).toBeGreaterThanOrEqual(59);
    expect(secondes).toBeLessThanOrEqual(60);
  });

  it('plafonne le délai à 15 minutes', () => {
    // 10 échecs : palier 6, soit 30 × 2⁵ = 960 s, ramené à 900 s.
    for (let i = 0; i < 10; i++) verrou.enregistrerEchec();
    const secondes = Math.round((verrou.bloqueJusqua()!.getTime() - Date.now()) / 1000);
    expect(secondes).toBeLessThanOrEqual(900);
    expect(secondes).toBeGreaterThan(890);
  });

  it('rend le nombre d’échecs comptés', () => {
    expect(verrou.enregistrerEchec()).toBe(1);
    expect(verrou.enregistrerEchec()).toBe(2);
  });

  it('effacerEchecs lève le verrou et remet le compteur à zéro', () => {
    for (let i = 0; i < 6; i++) verrou.enregistrerEchec();
    expect(verrou.bloqueJusqua()).not.toBeNull();

    verrou.effacerEchecs();

    expect(verrou.bloqueJusqua()).toBeNull();
    expect(verrou.enregistrerEchec()).toBe(1);
  });
});
