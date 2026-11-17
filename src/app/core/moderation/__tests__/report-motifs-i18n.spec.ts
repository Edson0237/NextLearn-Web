import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TraductionService } from '../../i18n';
import { traduireFiliere } from '../../references';
import { traduireMotifSignalement } from '..';

describe('Traduction des motifs de signalement et des filières', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nl_langue', 'fr');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('traduit tous les types de signalement en anglais et revient en français lors du changement de langue', async () => {
    const traductions = TestBed.inject(TraductionService);
    const httpMock = TestBed.inject(HttpTestingController);

    const pEn = traductions.definir('en');
    httpMock.expectOne('/i18n/en.json').flush({
      motifSigDroitAuteur: 'Copyright infringement',
      motifSigDroitAuteurDesc: 'Reproduces copyrighted work.',
      motifSigDonneesPerso: 'Exposed personal data',
      motifSigContenuIllegal: 'Illegal or offensive content',
      motifSigSujetNonDivulgue: 'Upcoming exam paper',
      motifSigHorsSujet: 'Off-topic or misclassified',
      motifSigDoublon: 'Duplicate',
      motifSigQualite: 'Unreadable or incomplete',
      motifSigAutre: 'Other',
    });
    await pEn;

    expect(traduireMotifSignalement('DROIT_AUTEUR', 'Violation', 'Desc fr')).toEqual({
      label: 'Copyright infringement',
      description: 'Reproduces copyrighted work.',
    });
    expect(traduireMotifSignalement('DOUBLON', 'Doublon').label).toBe('Duplicate');
    expect(traduireMotifSignalement('QUALITE', 'Illisible').label).toBe('Unreadable or incomplete');
    expect(traduireMotifSignalement('CODE_INCONNU', 'Motif personnalisé', 'Détail').label).toBe(
      'Motif personnalisé',
    );

    const pFr = traductions.definir('fr');
    httpMock.expectOne('/i18n/fr.json').flush({
      motifSigDroitAuteur: 'Violation de droit d’auteur',
      motifSigDoublon: 'Doublon',
    });
    await pFr;

    expect(traduireMotifSignalement('DROIT_AUTEUR', 'Fallback').label).toBe('Violation de droit d’auteur');
    expect(traduireMotifSignalement('DOUBLON', 'Doublon').label).toBe('Doublon');
    httpMock.verify();
  });

  it('traduit la filière ISI même avec apostrophe droite ou tiret cadratin', async () => {
    const traductions = TestBed.inject(TraductionService);
    const httpMock = TestBed.inject(HttpTestingController);

    const pEn = traductions.definir('en');
    httpMock.expectOne('/i18n/en.json').flush({ homeBienvenue: 'Welcome' });
    await pEn;

    expect(traduireFiliere("Cycle Ingénieur — Ingénierie des Systèmes d'Information (ISI)")).toBe(
      'Engineering Cycle - Information Systems Engineering (ISI)',
    );

    const retourFr = traductions.definir('fr');
    httpMock.expectOne('/i18n/fr.json').flush({});
    await retourFr;
    httpMock.verify();
    localStorage.clear();
  });
});
