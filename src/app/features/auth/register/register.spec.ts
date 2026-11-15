import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { GoogleIdentite } from '../../../core/auth';
import { TraductionService } from '../../../core/i18n';
import { filiereDepuisJson } from '../../../core/references';
import { Register } from './register';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';

/**
 * Ce que ce test protège : les deux chemins de la cascade École → Cycle →
 * Niveau → Filière. Une école « à ossature » (le cycle porte un `id`)
 * déroule Niveau puis Filière ; une école de secours (le cycle n'a pas
 * d'`id`) charge la Filière dès le cycle connu, et c'est elle qui débloque
 * Niveau. Les deux chemins partagent le même code de remise à zéro -
 * confondre les deux enverrait une requête au mauvais étage, silencieusement
 * (aucune erreur réseau, juste la liste qu'il ne fallait pas).
 */
/** Laisse les micro-tâches en attente (la suite d'un `await` résolu par
 * `flush()`) s'exécuter avant de continuer le scénario. */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('Register - cascade académique', () => {
  function creer(reponses: Record<string, unknown>) {
    const ouvrir = vi.fn((data: { title: string }) => Promise.resolve(reponses[data.title]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'app/register/otp', children: [] }]),
        { provide: FeuilleSelectionService, useValue: { ouvrir } },
        // Google n'est pas l'objet de ces tests : le bouton reste muet, sans requête de configuration.
        { provide: GoogleIdentite, useValue: { disponible: signal(false), desactive: signal(true), preparer: async () => false } },
      ],
    });
    const fixture = TestBed.createComponent(Register);
    const controller = TestBed.inject(HttpTestingController);
    return { component: fixture.componentInstance, controller };
  }

  it('cycle à ossature : charge les niveaux par cycleId, pas les filières', async () => {
    const { component, controller } = creer({ École: 'u1', Cycle: 'LICENCE' });

    controller.expectOne('/api/references/universites').flush({
      data: [{ _id: 'u1', nom: 'ISJ' }],
    });
    await tick();

    await component['choisirUniversite']();
    controller.expectOne((r) => r.url === '/api/references/cycles' && r.params.get('universiteId') === 'u1')
      .flush({ data: [{ id: 'cyc1', value: 'LICENCE', label: 'Licence' }] });
    await tick();

    await component['choisirCycle']();

    controller.expectOne((r) => r.url === '/api/references/niveaux' && r.params.get('cycleId') === 'cyc1')
      .flush({ data: [] });
    controller.verify();
  });

  it("cycle sans ossature : charge les filières par école+cycle, pas les niveaux", async () => {
    const { component, controller } = creer({ École: 'u1', Cycle: 'LICENCE' });

    controller.expectOne('/api/references/universites').flush({ data: [{ _id: 'u1', nom: 'ISJ' }] });
    await tick();
    await component['choisirUniversite']();

    controller.expectOne((r) => r.url === '/api/references/cycles')
      // Pas d'`id` : cette école n'a pas d'ossature enregistrée.
      .flush({ data: [{ value: 'LICENCE', label: 'Licence' }] });
    await tick();
    await component['choisirCycle']();

    controller.expectOne(
      (r) => r.url === '/api/references/filieres' && r.params.get('universiteId') === 'u1' && r.params.get('cycle') === 'LICENCE',
    ).flush({ data: [] });
    controller.verify();
  });

  it('la vérification de domaine se déclenche après le délai anti-rebond', async () => {
    const { component, controller } = creer({});
    controller.expectOne('/api/references/universites').flush({ data: [] });

    component['surSaisieEmail']('etu@isj.cm');
    await new Promise((r) => setTimeout(r, 500));

    controller
      .expectOne((r) => r.url.includes('/api/auth/institution-domain/check'))
      .flush({ data: { allowed: true, institutionName: 'ISJ' } });
    await tick();

    expect(component['domaine']().etat).toBe('reconnu');
    controller.verify();
  });

  it('préselectionne Saint Jean Ingénieur (SJI) par défaut et en fait le seul choix', async () => {
    const { component, controller } = creer({});
    controller.expectOne('/api/references/universites').flush({
      data: [
        { _id: 'u1', nom: 'Université de Yaoundé I' },
        { _id: 'u2', nom: 'Saint Jean Ingénieur (SJI)' },
        { _id: 'u3', nom: 'École Polytechnique' },
      ],
    });
    await tick();

    expect(component['universiteId']()).toBe('u2');
    expect(component['universiteNom']()).toBe('Saint Jean Ingénieur (SJI)');
    expect(component['universites']().items.length).toBe(1);
    expect(component['universites']().items[0].nom).toBe('Saint Jean Ingénieur (SJI)');

    controller
      .expectOne((r) => r.url === '/api/references/cycles' && r.params.get('universiteId') === 'u2')
      .flush({ data: [] });
    controller.verify();
  });

  it('filiereDepuisJson : conserve le nom canonique serveur (tiret cadratin —) tout en exposant le libellé affiché', async () => {
    const { controller } = creer({});
    controller.expectOne('/api/references/universites').flush({ data: [] });

    const canonique = 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)';
    const optionFr = filiereDepuisJson({ _id: 'f-srt', nom: canonique });
    expect(optionFr.id).toBe('f-srt');
    expect(optionFr.nom).toBe(canonique);
    expect(optionFr.libelle).toBe('Cycle Ingénieur - Systèmes, Réseaux & Télécoms (SRT)');

    const traductions = TestBed.inject(TraductionService);
    const pEn = traductions.definir('en');
    controller.expectOne('/i18n/en.json').flush({ communFiliere: 'Major' });
    await pEn;

    const optionEn = filiereDepuisJson({ _id: 'f-srt', nom: canonique });
    expect(optionEn.nom).toBe(canonique);
    expect(optionEn.libelle).toBe('Engineering Cycle - Systems, Networks & Telecoms (SRT)');

    const pFr = traductions.definir('fr');
    controller.expectOne('/i18n/fr.json').flush({ communFiliere: 'Filière' });
    await pFr;
    controller.verify();
  });

  it("transmet le nom canonique exact de la filière (avec tiret cadratin —) à POST /api/auth/register même en interface anglaise", async () => {
    const nomCanonique = 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)';
    const { component, controller } = creer({
      Cycle: 'INGENIEUR',
      Level: 'lvl3',
      Niveau: 'lvl3',
      Major: 'f-srt',
      Filière: 'f-srt',
    });

    controller.expectOne('/api/references/universites').flush({
      data: [{ _id: 'u-sji', nom: 'Saint Jean Ingénieur' }],
    });
    await tick();

    // Auto-sélection SJI -> chargement des cycles
    controller
      .expectOne((r) => r.url === '/api/references/cycles' && r.params.get('universiteId') === 'u-sji')
      .flush({ data: [{ id: 'cyc-ing', value: 'INGENIEUR', label: 'Cycle Ingénieur' }] });
    await tick();

    // Bascule en anglais via TraductionService
    const traductions = TestBed.inject(TraductionService);
    const pEn = traductions.definir('en');
    controller.expectOne('/i18n/en.json').flush({
      communCycle: 'Cycle',
      docNiveau: 'Level',
      communFiliere: 'Major',
    });
    await pEn;

    // Étape 1 : informations personnelles (domaine institutionnel reconnu)
    component['prenom'].set('Jean');
    component['nom'].set('Atangana');
    component['email'].set('jean.atangana@saintjeaningenieur.org');
    const pEtape1 = component['suivant']();
    controller
      .expectOne((r) => r.url.includes('/api/auth/institution-domain/check'))
      .flush({ data: { allowed: true, institutionName: 'Saint Jean Ingénieur' } });
    await pEtape1;
    expect(component['etape']()).toBe(1);

    // Sélection Cycle -> Niveau -> Filière
    await component['choisirCycle']();
    controller
      .expectOne((r) => r.url === '/api/references/niveaux' && r.params.get('cycleId') === 'cyc-ing')
      .flush({ data: [{ id: 'lvl3', value: 'N3', label: 'Ingénieur 3' }] });
    await tick();

    await component['choisirNiveau']();
    controller
      .expectOne((r) => r.url === '/api/references/filieres' && r.params.get('levelId') === 'lvl3')
      .flush({ data: [{ _id: 'f-srt', nom: nomCanonique }] });
    await tick();

    await component['choisirFiliere']();
    expect(component['filiereId']()).toBe('f-srt');
    expect(component['filiereNom']()).toBe(nomCanonique);
    expect(component['filiereLibelle']()).toBe('Engineering Cycle - Systems, Networks & Telecoms (SRT)');

    // Validation Étape 2 -> envoi POST /api/auth/register
    const pEtape2 = component['suivant']();
    await tick();

    const reqRegister = controller.expectOne('/api/auth/register');
    expect(reqRegister.request.method).toBe('POST');
    expect(reqRegister.request.body).toEqual(
      expect.objectContaining({
        email: 'jean.atangana@saintjeaningenieur.org',
        nom: 'Atangana',
        prenom: 'Jean',
        universite: 'Saint Jean Ingénieur',
        filiere: nomCanonique,
        niveau: 'N3',
        cycle: 'INGENIEUR',
      }),
    );
    reqRegister.flush({ data: { tempToken: 'tmp-123', expiresIn: 300 } });
    await pEtape2;

    const pFr = traductions.definir('fr');
    controller.expectOne('/i18n/fr.json').flush({});
    await pFr;
    controller.verify();
  });
});
