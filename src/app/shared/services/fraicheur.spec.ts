import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Fraicheur } from './fraicheur';

/** Les listes doivent se relire quand l'application revient, pas seulement à l'ouverture. */
describe('Fraicheur', () => {
  let service: Fraicheur;
  const visibilite = (etat: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { value: etat, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(Fraicheur);
  });
  afterEach(() => {
    vi.useRealTimers();
    visibilite('visible');
  });

  it('un retour après une longue absence relance les listes', () => {
    const avant = service.tick();
    visibilite('hidden');
    vi.advanceTimersByTime(30_000);
    visibilite('visible');
    expect(service.tick()).toBe(avant + 1);
  });

  it('un va-et-vient de quelques secondes ne relance rien', () => {
    const avant = service.tick();
    visibilite('hidden');
    vi.advanceTimersByTime(3_000);
    visibilite('visible');
    expect(service.tick()).toBe(avant);
  });

  it('le retour de la connexion relance les listes', () => {
    const avant = service.tick();
    window.dispatchEvent(new Event('online'));
    expect(service.tick()).toBe(avant + 1);
  });

  it('une application laissée affichée se relit toutes les cinq minutes', () => {
    const avant = service.tick();
    vi.advanceTimersByTime(5 * 60_000);
    expect(service.tick()).toBe(avant + 1);
  });
});
