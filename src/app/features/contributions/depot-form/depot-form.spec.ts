import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DepotForm } from './depot-form';
import { DepotLicence } from '../../../core/contributions/depot.model';

/**
 * Ce que ce test protège : un dépôt incomplet ne doit jamais partir en
 * requête réseau (chaque garde bloque avant l'envoi), et un dépôt complet
 * doit effectivement produire un `multipart/form-data` avec le fichier
 * sous le nom de champ exact qu'attend le serveur (`file`) — un autre nom
 * y produit un 400 sans jamais dire que c'est le nom qui est en cause.
 */
describe('DepotForm — envoi', () => {
  function creer() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'app/depots', children: [] }])],
    });
    const fixture = TestBed.createComponent(DepotForm);
    const controller = TestBed.inject(HttpTestingController);
    controller.expectOne((r) => r.url === '/api/references/document-types').flush({ data: [] });
    controller.expectOne((r) => r.url === '/api/references/matieres').flush({ data: [] });
    return { component: fixture.componentInstance, controller, router: TestBed.inject(Router) };
  }

  it("n'envoie rien tant que le formulaire est incomplet", async () => {
    const { component, controller } = creer();
    component['titre'].set('Al');

    await component['envoyer']();

    controller.verify();
  });

  it('envoie un multipart avec le fichier sous le champ "file"', async () => {
    const { component, controller } = creer();
    component['titre'].set('Chapitre 3');
    component['description'].set('Les intégrales multiples, cours complet.');
    component['type'].set('cours');
    component['matiereId'].set('mat-1');
    component['licence'].set(DepotLicence.auteur);
    component['fichier'].set(new File([new Uint8Array([1, 2, 3])], 'cours.pdf', { type: 'application/pdf' }));

    const promesse = component['envoyer']();

    const requete = controller.expectOne('/api/documents/submissions');
    expect(requete.request.body instanceof FormData).toBe(true);
    const formData = requete.request.body as FormData;
    expect(formData.get('titre')).toBe('Chapitre 3');
    expect(formData.get('matiereId')).toBe('mat-1');
    expect(formData.get('licence')).toBe('auteur');
    const fichierEnvoye = formData.get('file') as File;
    expect(fichierEnvoye.name).toBe('cours.pdf');

    requete.flush({ data: {} });
    await promesse;
    controller.verify();
  });
});
