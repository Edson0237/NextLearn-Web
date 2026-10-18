import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SupportRepository, SupportTicketStatus } from './support-repository';

describe('SupportRepository', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('crée un ticket avec les bons champs', async () => {
    const repo = TestBed.inject(SupportRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.createTicket('BUG', 'Connexion', 'Impossible de me connecter');
    const req = http.expectOne('/api/support/tickets');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ categorie: 'BUG', sujet: 'Connexion', message: 'Impossible de me connecter' });
    req.flush({});

    await promesse;
    http.verify();
  });

  it('liste les tickets et normalise le statut', async () => {
    const repo = TestBed.inject(SupportRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.listMyTickets();
    const req = http.expectOne('/api/support/tickets');
    req.flush({
      data: [
        { _id: 't1', sujet: 'Bug', message: 'Détail', status: 'in_progress', createdAt: '2026-10-18T10:00:00Z' },
      ],
    });

    const tickets = await promesse;
    expect(tickets[0].id).toBe('t1');
    expect(tickets[0].status).toBe(SupportTicketStatus.inProgress);
    http.verify();
  });
});
