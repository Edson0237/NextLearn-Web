import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfilHome } from './profil-home';
import { AuthService } from '../../../core/auth/auth.service';
import { UserModel, NiveauEtude, Cycle, Langue } from '../../../core/models/user.model';

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('ProfilHome', () => {
  const utilisateur: UserModel = {
    id: 'u1',
    email: 'marie@isj.sn',
    nom: 'Diop',
    prenom: 'Marie',
    universite: 'ISJ',
    filiere: 'Génie Informatique',
    niveau: NiveauEtude.n3,
    cycle: Cycle.ingenieur,
    langue: Langue.fr,
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

  it('affiche le profil et les statistiques', async () => {
    const fixture = TestBed.createComponent(ProfilHome);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/profile').flush({
      data: { stats: { docsTelecharges: 5, docsLus: 10, heuresEtude: 2, streak: 3 } },
    });
    http.expectOne('/api/progression/stats').flush({ data: { streak: 7 } });
    http.verify();
    await tick();

    expect(fixture.componentInstance['nomComplet']()).toBe('Marie Diop');
    expect(fixture.componentInstance['libelleNiveau']()).toBe('Ingénieur 3');
    expect(fixture.componentInstance['stats']().streak).toBe(7);
  });
});
