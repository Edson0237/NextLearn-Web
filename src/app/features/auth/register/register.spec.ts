import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Register } from './register';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';

/**
 * Ce que ce test protège : les deux chemins de la cascade École → Cycle →
 * Niveau → Filière. Une école « à ossature » (le cycle porte un `id`)
 * déroule Niveau puis Filière ; une école de secours (le cycle n'a pas
 * d'`id`) charge la Filière dès le cycle connu, et c'est elle qui débloque
 * Niveau. Les deux chemins partagent le même code de remise à zéro —
 * confondre les deux enverrait une requête au mauvais étage, silencieusement
 * (aucune erreur réseau, juste la liste qu'il ne fallait pas).
 */
/** Laisse les micro-tâches en attente (la suite d'un `await` résolu par
 * `flush()`) s'exécuter avant de continuer le scénario. */
function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('Register — cascade académique', () => {
  function creer(reponses: Record<string, unknown>) {
    const ouvrir = vi.fn((data: { title: string }) => Promise.resolve(reponses[data.title]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: FeuilleSelectionService, useValue: { ouvrir } },
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
});
