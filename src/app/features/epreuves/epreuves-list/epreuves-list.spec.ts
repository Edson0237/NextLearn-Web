import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EpreuvesList } from './epreuves-list';
import { TypeEpreuve } from '../../../core/epreuves/epreuve.model';

/**
 * Ce que ce test protège : un sujet de nature inconnue (`typeEpreuve`
 * absent — tout le fonds publié avant l'introduction du champ) ne doit
 * ressortir sous aucun des filtres CC/SN, seulement sous « Tous ». Une
 * égalité non stricte (`!=` au lieu de `===`) ferait disparaître ce fonds
 * dès qu'un filtre de nature est actif.
 */
/** Laisse la micro-tâche qui suit `flush()` (la continuation de l'`await`
 * dans `charger()`, qui pose le signal) s'exécuter avant de lire l'état. */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('EpreuvesList — filtrage', () => {
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
});
