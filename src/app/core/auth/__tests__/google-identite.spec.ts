import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRepository } from '../repositories/auth-repository';
import { GoogleIdentite } from '../services/google-identite';

type Config = { enabled: boolean; clientId?: string; injoignable?: boolean };

describe('GoogleIdentite : un échec passager ne masque pas Google jusqu’au rechargement', () => {
  let config: ReturnType<typeof vi.fn<() => Promise<Config>>>;

  function creer(): GoogleIdentite {
    config = vi.fn<() => Promise<Config>>();
    TestBed.configureTestingModule({ providers: [{ provide: AuthRepository, useValue: { configGoogle: config } }] });
    return TestBed.inject(GoogleIdentite);
  }

  beforeEach(() => {
    delete (window as unknown as { google?: unknown }).google;
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((e) => e.remove());
  });

  it('serveur injoignable : échoue, mais le prochain appel réessaie', async () => {
    const g = creer();
    config.mockResolvedValueOnce({ enabled: false, injoignable: true });
    expect(await g.preparer()).toBe(false);
    expect(g.desactive()).toBe(false);

    // Le serveur est de retour, et Google déjà chargé.
    (window as unknown as { google: unknown }).google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
    config.mockResolvedValueOnce({ enabled: true, clientId: 'id.apps.googleusercontent.com' });
    expect(await g.preparer()).toBe(true);
    expect(config).toHaveBeenCalledTimes(2);
    expect(g.disponible()).toBe(true);
  });

  it('Google non configuré côté serveur : définitif, on ne redemande plus', async () => {
    const g = creer();
    config.mockResolvedValue({ enabled: false });
    expect(await g.preparer()).toBe(false);
    expect(g.desactive()).toBe(true);
    expect(await g.preparer()).toBe(false);
    expect(config).toHaveBeenCalledTimes(1);
  });

  it('plusieurs appels simultanés ne font qu’une seule requête', async () => {
    const g = creer();
    config.mockResolvedValue({ enabled: false });
    await Promise.all([g.preparer(), g.preparer(), g.preparer()]);
    expect(config).toHaveBeenCalledTimes(1);
  });

  it('une fois prêt, ne redemande rien', async () => {
    const g = creer();
    (window as unknown as { google: unknown }).google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
    config.mockResolvedValue({ enabled: true, clientId: 'id' });
    expect(await g.preparer()).toBe(true);
    expect(await g.preparer()).toBe(true);
    expect(config).toHaveBeenCalledTimes(1);
  });
});
