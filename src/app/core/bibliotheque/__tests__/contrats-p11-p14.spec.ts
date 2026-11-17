import { HttpErrorResponse } from '@angular/common/http';
import {
  cleCacheCatalogue,
  codeFacetteString,
  reponseCatalogueDepuisApi,
  sectionCatalogueDepuisPreference,
} from '..';
import { Failure } from '../../models';

describe('Contrats P11–P14 (Catalogue v2, Facettes NON_PRECISE, Failure)', () => {
  it('sectionCatalogueDepuisPreference mappe FRANCOPHONE, ANGLOPHONE et TOUTES', () => {
    expect(sectionCatalogueDepuisPreference('FRANCOPHONE')).toBe('FRANCOPHONE');
    expect(sectionCatalogueDepuisPreference('ANGLOPHONE')).toBe('ANGLOPHONE');
    expect(sectionCatalogueDepuisPreference('TOUTES')).toBeNull();
    expect(sectionCatalogueDepuisPreference(null)).toBeNull();
    expect(sectionCatalogueDepuisPreference(undefined)).toBeNull();
  });

  it('reponseCatalogueDepuisApi et codeFacetteString conservent NON_PRECISE quand valeur vaut null', () => {
    const rep = reponseCatalogueDepuisApi({
      ressources: [],
      total: 4,
      pagination: { limit: 20, page: 1, hasMore: false, nextCursor: null },
      filtresActifs: {},
      facettes: {
        typeEpreuve: [
          { valeur: null, valeurFiltre: 'NON_PRECISE', label: 'Non précisé', labelEn: 'Not specified', n: 4, selectionne: false },
          { valeur: 'SN', label: 'Session normale', labelEn: 'Main session', n: 2, selectionne: false },
        ],
        semestre: [
          { valeur: null, valeurFiltre: 'NON_PRECISE', label: 'Non précisé', labelEn: 'Not specified', n: 3, selectionne: false },
        ],
      },
    });

    expect(rep.facettes.typeEpreuve[0].valeur).toBeNull();
    expect(rep.facettes.typeEpreuve[0].valeurFiltre).toBe('NON_PRECISE');
    expect(codeFacetteString(rep.facettes.typeEpreuve[0])).toBe('NON_PRECISE');
    expect(codeFacetteString(rep.facettes.typeEpreuve[1])).toBe('SN');
    expect(codeFacetteString(rep.facettes.semestre[0])).toBe('NON_PRECISE');
  });

  it('cleCacheCatalogue isole le cache par utilisateur, mode classe, classe, section et limit', () => {
    const base = cleCacheCatalogue('u1', 'profil', { section: 'FRANCOPHONE', limit: 20 });
    const eco = cleCacheCatalogue('u1', 'profil', { section: 'FRANCOPHONE', limit: 10 });
    const alt = cleCacheCatalogue('u1', 'alternative', {
      universiteId: 'univ2',
      filiereId: 'fil2',
      niveau: 'N2',
      section: 'FRANCOPHONE',
      limit: 20,
    });
    const autreUser = cleCacheCatalogue('u2', 'profil', { section: 'FRANCOPHONE', limit: 20 });

    expect(base).not.toBe(eco);
    expect(base).not.toBe(alt);
    expect(base).not.toBe(autreUser);
  });

  it('Failure.depuisErreurHttp gère INVALID_JSON avec warn non sensible et retire la query string des journaux', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const f = Failure.depuisErreurHttp(
        new HttpErrorResponse({
          status: 400,
          url: 'https://api.nextlearn.cm/api/v2/catalogue?token=secret&q=algo',
          error: { error: { code: 'INVALID_JSON', message: 'Corps JSON malformé', requestId: 'req-json' } },
        }),
        false,
      );

      expect(f.code).toBe('INVALID_JSON');
      expect(f.message).toBe('Cette requête est invalide.');
      expect(warnSpy).toHaveBeenCalledWith(
        '[Failure] INVALID_JSON',
        expect.objectContaining({
          endpoint: 'https://api.nextlearn.cm/api/v2/catalogue',
          status: 400,
          requestId: 'req-json',
        }),
      );
      expect(errSpy).toHaveBeenCalled();
      const sortieErr = String(errSpy.mock.calls[0]?.[0] ?? '');
      expect(sortieErr).toContain('https://api.nextlearn.cm/api/v2/catalogue');
      expect(sortieErr).not.toContain('token=secret');
    } finally {
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it('Failure.depuisErreurHttp mappe PAYLOAD_TOO_LARGE / HTTP 413', () => {
    const f = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        status: 413,
        url: 'https://api.nextlearn.cm/api/contributions?secret=1',
        error: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Fichier trop volumineux', requestId: 'req-413' } },
      }),
      true,
    );

    expect(f.statusCode).toBe(413);
    expect(f.requestId).toBe('req-413');
    expect(f.message).toContain('volumineux');
  });
});
