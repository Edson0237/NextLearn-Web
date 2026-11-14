import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { AuthService } from '../../core/auth';
import { NiveauEtude, Cycle, Langue, UserModel } from '../../core/models';

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('Home', () => {
  const utilisateur: UserModel = {
    id: 'u1', email: 'a@b.sn', nom: 'Diop', prenom: 'Aminata',
    universite: 'ISJ', filiere: 'GI', niveau: NiveauEtude.n3, cycle: Cycle.ingenieur, langue: Langue.fr,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { state: () => ({ user: utilisateur }) } },
      ],
    });
  });

  it('affiche les recommandations et le sous-titre utilisateur', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/documents/recommended').flush({ data: [{ _id: 'd1', titre: 'Cours', type: 'COURS', niveau: 'N3', anneeAcademique: '2025', tailleMb: 1, pages: 10, urlPdf: '' }] });
    http.expectOne('/api/documents/popular').flush({ data: [] });
    http.expectOne('/api/documents/recent').flush({ data: [] });
    http.expectOne('/api/profile').flush({ data: { stats: { docsTelecharges: 0, docsLus: 0, heuresEtude: 0, streak: 0 } } });
    http.expectOne('/api/progression/stats').flush({ data: { streak: 0 } });
    // L'accueil charge aussi le contexte (matières du programme), la
    // progression de lecture (section « Reprendre ») et le compteur de
    // notifications non lues - les trois sections que la PWA n'affichait pas.
    http.expectOne('/api/me/context').flush({ data: { resolved: true, subjects: [] } });
    http.expectOne('/api/progress/lecture').flush({ data: [] });
    http.expectOne('/api/notifications/unread-count').flush({ data: { count: 0 } });
    // Les formats proposés (voir `FormatsService`), demandés par l'accueil.
    http.match('/api/references/document-types').forEach((r) => r.flush({ data: [] }));
    http.match('/api/favorites').forEach((r) => r.flush({ data: [] }));
    http.verify();
    await tick();

    expect(fixture.componentInstance['subtitle']()).toBe('Ingénieur 3 · GI');
    expect(fixture.componentInstance['recommended']().length).toBe(1);
  });
});
