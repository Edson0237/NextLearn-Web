import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProfilRepository } from '../repositories/profil-repository';

describe('ProfilRepository', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('récupère les statistiques et préfère le streak de progression', async () => {
    const repo = TestBed.inject(ProfilRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.getStats();
    const reqProfil = http.expectOne('/api/profile');
    reqProfil.flush({
      data: {
        stats: { docsTelecharges: 12, docsLus: 34, heuresEtude: 56, streak: 1 },
      },
    });
    const reqStreak = http.expectOne('/api/progression/stats');
    reqStreak.flush({ data: { streak: 9 } });

    const stats = await promesse;
    expect(stats.docsTelecharges).toBe(12);
    expect(stats.docsLus).toBe(34);
    expect(stats.heuresEtude).toBe(56);
    expect(stats.streak).toBe(9);
    http.verify();
  });

  it('envoie { niveau } seul ou { niveau, filiere } sur PUT /api/profile', async () => {
    const repo = TestBed.inject(ProfilRepository);
    const http = TestBed.inject(HttpTestingController);

    const p1 = repo.changerNiveau('N2');
    const r1 = http.expectOne('/api/profile');
    expect(r1.request.method).toBe('PUT');
    expect(r1.request.body).toEqual({ niveau: 'N2' });
    r1.flush({ data: { user: { id: 'u1', email: 'a@sji.cm', nom: 'A', prenom: 'B', universite: 'SJI', filiere: 'Cycle Ingénieur — ISI', niveau: 'N2', langue: 'FR' } } });
    const u1 = await p1;
    expect(u1.niveau).toBe('n2');

    const p2 = repo.changerNiveau('N3', 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)');
    const r2 = http.expectOne('/api/profile');
    expect(r2.request.body).toEqual({ niveau: 'N3', filiere: 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)' });
    r2.flush({
      data: {
        user: {
          id: 'u1',
          email: 'a@sji.cm',
          nom: 'A',
          prenom: 'B',
          universite: 'SJI',
          filiere: 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)',
          filiereOrigine: 'Cycle Ingénieur — Tronc commun',
          niveau: 'N3',
          langue: 'FR',
        },
      },
    });
    const u2 = await p2;
    expect(u2.filiereOrigine).toBe('Cycle Ingénieur — Tronc commun');
    expect(u2.filiere).toContain('SRT');
    http.verify();
  });

  it('supprime le compte avec le PIN dans le corps', async () => {
    const repo = TestBed.inject(ProfilRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.deleteAccount({ pin: '1234' });
    const req = http.expectOne('/api/users/me');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ pin: '1234' });
    req.flush({
      data: {
        rapport: { supprime: { documents: 5, signalements: 2 }, justificatifsPurges: 3, justificatifsEnEchec: 0 },
      },
    });

    const rapport = await promesse;
    expect(rapport.elementsEffaces).toBe(7);
    expect(rapport.justificatifsPurges).toBe(3);
    http.verify();
  });
});
