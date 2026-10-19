import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { AuthService } from '../../core/auth/auth.service';
import { NiveauEtude, Cycle, Langue, UserModel } from '../../core/models/user.model';

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
    http.verify();
    await tick();

    expect(fixture.componentInstance['subtitle']()).toBe('Ingénieur 3 · GI');
    expect(fixture.componentInstance['recommended']().length).toBe(1);
  });
});
