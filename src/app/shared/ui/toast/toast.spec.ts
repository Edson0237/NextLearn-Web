import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';

/**
 * Ce que ce test protège : les deux comportements non visibles à l'œil de
 * `MessageFlottant` — un seul message à la fois (le second chasse le
 * premier, il n'attend pas la fin de son affichage), et une durée plus
 * longue quand une action est proposée (le temps de lire *et* décider).
 */
describe('ToastService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('un second message chasse le premier immédiatement', () => {
    const service = TestBed.inject(ToastService);
    service.info('Premier');
    service.succes('Second');

    expect(service.actif()?.message).toBe('Second');
  });

  it('un message simple disparaît après 3 secondes', () => {
    const service = TestBed.inject(ToastService);
    service.info('Enregistré');

    vi.advanceTimersByTime(2999);
    expect(service.actif()).toBeDefined();

    vi.advanceTimersByTime(1);
    expect(service.actif()).toBeUndefined();
  });

  it('un message avec action reste 5 secondes', () => {
    const service = TestBed.inject(ToastService);
    service.avecAnnulation('Supprimé', 'Annuler', () => {});

    vi.advanceTimersByTime(3001);
    expect(service.actif()).toBeDefined();

    vi.advanceTimersByTime(2000);
    expect(service.actif()).toBeUndefined();
  });

  it('fermer annule le minuteur en attente', () => {
    const service = TestBed.inject(ToastService);
    service.info('Test');
    service.ferme();

    expect(service.actif()).toBeUndefined();
    // Aucune exception si le minuteur d'origine se déclenche malgré tout.
    vi.advanceTimersByTime(5000);
    expect(service.actif()).toBeUndefined();
  });
});
