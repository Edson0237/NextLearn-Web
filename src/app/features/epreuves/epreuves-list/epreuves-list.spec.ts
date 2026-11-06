import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EpreuvesList } from './epreuves-list';
import { TypeEpreuve } from '../../../core/epreuves';

/**
 * Ce que ce test protège : un sujet de nature inconnue (`typeEpreuve`
 * absent - tout le fonds publié avant l'introduction du champ) ne doit
 * ressortir sous aucun des filtres CC/SN, seulement sous « Tous ». Une
 * égalité non stricte (`!=` au lieu de `===`) ferait disparaître ce fonds
 * dès qu'un filtre de nature est actif.
 */
/** Laisse la micro-tâche qui suit `flush()` (la continuation de l'`await`
 * dans `charger()`, qui pose le signal) s'exécuter avant de lire l'état. */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('EpreuvesList - filtrage', () => {
  async function creer(brut: Record<string, unknown>[]) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(EpreuvesList);
    const controller = TestBed.inject(HttpTestingController);
    controller.expectOne((r) => r.url === '/api/epreuves').flush({ data: brut });
    controller.verify();
    await tick();
    return fixture.componentInstance;
  }

  const sansType = { _id: '1', matiere: 'Algo', annee: 2022, universite: 'ISJ', niveau: 'N3', matiereId: 'm1' };
  const cc = { _id: '2', matiere: 'Algo', annee: 2023, universite: 'ISJ', niveau: 'N3', matiereId: 'm1', typeEpreuve: 'CC' };
  const sn = { _id: '3', matiere: 'Réseaux', annee: 2021, universite: 'ISJ', niveau: 'N3', matiereId: 'm2', typeEpreuve: 'SN', avecCorrige: true };

  const rat = { _id: '4', matiere: 'Algo', annee: 2023, universite: 'ISJ', niveau: 'N3', matiereId: 'm1', typeEpreuve: 'RATTRAPAGE' };

  it('le filtre Rattrapage ne ramène que les rattrapages', async () => {
    const c = await creer([sansType, cc, sn, rat]);
    c['setType'](TypeEpreuve.rattrapage);
    expect(c['filtrees']().map((e: { id: string }) => e.id)).toEqual(['4']);
  });

  it('les filtres CC et SN ne ramènent pas les rattrapages', async () => {
    const c = await creer([sansType, cc, sn, rat]);
    c['setType'](TypeEpreuve.cc);
    expect(c['filtrees']().map((e: { id: string }) => e.id)).toEqual(['2']);
    c['setType'](TypeEpreuve.sn);
    expect(c['filtrees']().map((e: { id: string }) => e.id)).toEqual(['3']);
  });

  it('« Tous » ramène aussi les rattrapages', async () => {
    const c = await creer([sansType, cc, sn, rat]);
    expect(c['filtrees']().map((e: { id: string }) => e.id)).toContain('4');
  });

  it('libellé d’année : « 2023-2024 » si l’épreuve la porte, sinon l’année seule', async () => {
    const avec = { _id: '5', matiere: 'Algo', annee: 2023, anneeAcademique: '2023-2024', universite: 'ISJ', niveau: 'N3', matiereId: 'm1' };
    const c = await creer([avec, sansType]);
    expect(c['libelleAnnee'](2023)).toBe('2023-2024');
    expect(c['libelleAnnee'](2022)).toBe('2022');
  });

  it('une épreuve sans durée est listée normalement (aucune valeur inventée)', async () => {
    const sansDuree = { _id: '6', matiere: 'Algo', annee: 2023, universite: 'ISJ', niveau: 'N3', matiereId: 'm1', dureeMinutes: null };
    const c = await creer([sansDuree]);
    expect(c['filtrees']()).toHaveLength(1);
    expect(c['filtrees']()[0].dureeMinutes).toBeUndefined();
  });

  it('la pastille d’un rattrapage est courte : RAT', async () => {
    const c = await creer([rat]);
    expect(c['typeApi'](TypeEpreuve.rattrapage)).toBe('RAT');
    expect(c['typeApi'](TypeEpreuve.cc)).toBe('CC');
    expect(c['typeApi'](TypeEpreuve.sn)).toBe('SN');
  });

  it('« Tous » (pas de filtre de nature) ramène le fonds sans nature connue', async () => {
    const c = await creer([sansType, cc, sn]);
    expect(c['filtrees']().map((e: { id: string }) => e.id)).toEqual(['2', '1', '3']);
  });

  it('un filtre CC exclut le fonds sans nature connue, pas seulement SN', async () => {
    const c = await creer([sansType, cc, sn]);
    c['setType'](TypeEpreuve.cc);
    const ids = c['filtrees']().map((e: { id: string }) => e.id);
    expect(ids).toEqual(['2']);
  });

  it('le filtre matière + corrigé se combinent (ET, pas OU)', async () => {
    const c = await creer([sansType, cc, sn]);
    c['setMatiere']('m2');
    c['toggleCorrige']();
    expect(c['filtrees']().map((e: { id: string }) => e.id)).toEqual(['3']);
  });

  it('réinitialiser efface tous les filtres actifs', async () => {
    const c = await creer([sansType, cc, sn]);
    c['setType'](TypeEpreuve.sn);
    c['setAnnee'](2021);
    expect(c['filtreActif']()).toBe(true);
    c['reinitialiser']();
    expect(c['filtreActif']()).toBe(false);
    expect(c['filtrees']().length).toBe(3);
  });

  it('durée connue : conserve la valeur exacte de dureeMinutes dans filtrees()', async () => {
    const avecDuree = { _id: '7', matiere: 'Physique', annee: 2024, universite: 'ISJ', niveau: 'N2', matiereId: 'm3', dureeMinutes: 120 };
    const c = await creer([avecDuree]);
    expect(c['filtrees']()[0].dureeMinutes).toBe(120);
  });

  it('tri par année décroissante : la plus récente apparaît en tête', async () => {
    const e2020 = { _id: '10', matiere: 'M', annee: 2020, universite: 'U', niveau: 'N1', matiereId: 'm1' };
    const e2024 = { _id: '11', matiere: 'M', annee: 2024, universite: 'U', niveau: 'N1', matiereId: 'm1' };
    const e2022 = { _id: '12', matiere: 'M', annee: 2022, universite: 'U', niveau: 'N1', matiereId: 'm1' };
    const c = await creer([e2020, e2024, e2022]);
    expect(c['filtrees']().map((e: { annee: number }) => e.annee)).toEqual([2024, 2022, 2020]);
  });

  it('erreur réseau serveur : le statut bascule à erreur', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(EpreuvesList);
    const controller = TestBed.inject(HttpTestingController);
    controller.expectOne((r) => r.url === '/api/epreuves').error(new ProgressEvent('Network error'));
    controller.verify();
    await tick();
    const c = fixture.componentInstance;
    expect(c['statut']()).toBe('erreur');
    expect(c['erreur']()).toBeTruthy();
  });
});
