import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TraductionService } from './traduction.service';

describe('TraductionService hors ligne', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nl_langue', 'fr');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  const charger = async (reponse: () => void) => {
    const s = TestBed.inject(TraductionService);
    const fini = s.charger();
    reponse();
    await fini;
    return s;
  };

  it('garde une copie du catalogue reçu', async () => {
    await charger(() => http.expectOne('/i18n/fr.json').flush({ authCreerCompte: 'Créer un compte' }));
    expect(JSON.parse(localStorage.getItem('nl_i18n_fr')!)).toEqual({ authCreerCompte: 'Créer un compte' });
  });

  it('sans réseau, retombe sur la dernière copie plutôt que d’afficher les clés', async () => {
    localStorage.setItem('nl_i18n_fr', JSON.stringify({ authCreerCompte: 'Créer un compte' }));
    const s = await charger(() =>
      http.expectOne('/i18n/fr.json').error(new ProgressEvent('error'), { status: 0 }),
    );
    expect(s.t('authCreerCompte')).toBe('Créer un compte');
  });

  it('sans réseau et sans copie, rend le texte de secours', async () => {
    const s = await charger(() =>
      http.expectOne('/i18n/fr.json').error(new ProgressEvent('error'), { status: 0 }),
    );
    expect(s.t('authCreerCompte', undefined, 'Créer un compte')).toBe('Créer un compte');
  });
});
