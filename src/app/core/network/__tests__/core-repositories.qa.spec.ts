import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProfilRepository } from '../../profil';
import { ChangementEmailRepository, SessionRepository, SupportRepository } from '../../profil';
import { EpreuvesRepository } from '../../epreuves/repositories/epreuves-repository';
import { QuizRepository } from '../../quiz/repositories/quiz-repository';
import { NotificationsRepository } from '../../notifications/repositories/notifications-repository';
import { ProgressionRepository } from '../../progression/repositories/progression-repository';
import { ReportRepository } from '../../moderation/repositories/report-repository';
import { RecoursRepository } from '../../recours/repositories/recours-repository';
import { SecureStorageService } from '../../storage/services/secure-storage.service';
import { Failure } from '../../models';
import { CibleSignalement } from '../../moderation';

describe('Core Repositories & Failure Mapping — QA Coverage Suite', () => {
  let httpMock: HttpTestingController;
  let storage: SecureStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(SecureStorageService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('ProfilRepository gère stats, fusion locale, niveaux, avatar, suppression et profil-etude', async () => {
    const repo = TestBed.inject(ProfilRepository);
    const pStats = repo.getStats();
    httpMock.expectOne('/api/profile').flush({
      data: {
        user: {
          id: 'u-1',
          email: 'etu@enspy.cm',
          nom: 'T',
          prenom: 'A',
          universite: 'ENSPY',
          filiere: 'Info',
          niveau: 'N3',
          role: 'etudiant',
          isVerified: true,
        },
        stats: { docsTelecharges: 3, docsLus: 8, heuresEtude: 4.5, streak: 1 },
      },
    });
    httpMock.expectOne('/api/progression/stats').flush({ data: { streak: 7.4 } });
    const stats = await pStats;
    expect(stats.streak).toBe(7);
    expect(storage.getUser()?.id).toBe('u-1');

    const pNiv = repo.niveauxDuCycle();
    httpMock.expectOne('/api/me/levels').flush({ data: { niveaux: [{ code: 'N3', label: '3e année' }] } });
    expect((await pNiv).niveaux).toHaveLength(1);

    const pSec = repo.changerSection('ANGLOPHONE');
    httpMock.expectOne('/api/profile').flush({
      data: { user: { id: 'u-1', email: 'etu@enspy.cm', nom: 'T', prenom: 'A', universite: 'ENSPY', filiere: 'Info', niveau: 'N3', role: 'etudiant', isVerified: true } },
    });
    expect((await pSec).sectionPreference).toBe('ANGLOPHONE');

    const pAvaUp = repo.televerserAvatar(new File(['png'], 'a.png', { type: 'image/png' }));
    httpMock.expectOne('/api/profile/avatar').flush({
      data: { user: { id: 'u-1', email: 'etu@enspy.cm', nom: 'T', prenom: 'A', avatarUrl: 'https://cdn/a.png', role: 'etudiant', isVerified: true } },
    });
    expect((await pAvaUp).avatarUrl).toBe('https://cdn/a.png');

    const pAvaDel = repo.supprimerAvatar();
    httpMock.expectOne('/api/profile/avatar').flush({
      data: { user: { id: 'u-1', email: 'etu@enspy.cm', nom: 'T', prenom: 'A', role: 'etudiant', isVerified: true } },
    });
    expect((await pAvaDel).avatarUrl).toBeUndefined();

    const pSupInfo = repo.infosSuppression();
    httpMock.expectOne('/api/users/me/suppression').flush({ data: { pinRequis: true, motConfirmation: 'SUPPRIMER' } });
    expect(await pSupInfo).toEqual({ pinRequis: true, motConfirmation: 'SUPPRIMER' });

    const pDel = repo.deleteAccount({ pin: '1234' });
    httpMock.expectOne('/api/users/me').flush({ data: { rapport: { documentsConserves: 2, comptesSupprimes: 1 } } });
    await pDel;

    const pEtude = repo.lireProfilEtude();
    httpMock.expectOne('/api/v2/me/profil-etude').flush({ data: { etude: { objectif: 'REUSSIR_EXAMENS' }, completude: { pourcentage: 50, manquants: [] }, compte: {} } });
    await pEtude;

    const pMajEtude = repo.mettreAJourProfilEtude({ rappels: { actifs: true, heure: '18:00' }, economieDonnees: true });
    httpMock.expectOne('/api/v2/me/profil-etude').flush({ data: { etude: { rappels: { actifs: true, heure: '18:00' }, economieDonnees: true }, completude: { pourcentage: 75, manquants: [] }, compte: {} } });
    await pMajEtude;

    const pRstEtude = repo.reinitialiserProfilEtude();
    httpMock.expectOne('/api/v2/me/profil-etude').flush({ data: { etude: {}, completude: { pourcentage: 0, manquants: [] }, compte: {} } });
    await pRstEtude;
  });

  it('Epreuves, Quiz, Notifications, ChangementEmail, Session, Support, Progression, Report & Recours', async () => {
    const epreuves = TestBed.inject(EpreuvesRepository);
    const pEpAll = epreuves.getEpreuves();
    httpMock.expectOne((r) => r.url === '/api/epreuves' && r.params.get('page') === '1').flush({
      data: [{ _id: 'e1', titre: 'SN 2025' }],
      meta: { totalPages: 2 },
    });
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === '/api/epreuves' && r.params.get('page') === '2').flush({
      data: [{ _id: 'e2', titre: 'CC 2025' }],
      meta: { totalPages: 2 },
    });
    expect(await pEpAll).toHaveLength(2);

    const pEpOne = epreuves.getById('e1');
    httpMock.expectOne('/api/epreuves/e1').flush({ data: { _id: 'e1', titre: 'SN 2025' } });
    expect((await pEpOne)?.id).toBe('e1');

    const pEpDl = epreuves.getDownloadUrl('e1', 'corrige');
    httpMock.expectOne((r) => r.url === '/api/epreuves/e1/download').flush({ data: {} });
    await expect(pEpDl).rejects.toBeInstanceOf(Failure);

    const quiz = TestBed.inject(QuizRepository);
    const pQs = quiz.getQuizzesForDocument('d-1');
    httpMock.expectOne((r) => r.url === '/api/quiz').flush({ data: [{ _id: 'q1', titre: 'Quiz 1', questions: [] }] });
    expect(await pQs).toHaveLength(1);
    const pQSub = quiz.submitQuiz('q1', { qst1: 0 }, 45);
    httpMock.expectOne('/api/quiz/q1/submit').flush({ data: { score: 1, totalQuestions: 1, details: [] } });
    expect((await pQSub).totalQuestions).toBe(1);

    const notifRepo = TestBed.inject(NotificationsRepository);
    const pNotifs = notifRepo.getNotifications();
    httpMock.expectOne((r) => r.url === '/api/notifications').flush({ data: [{ _id: 'n1', title: 'Nouveau' }] });
    expect(await pNotifs).toHaveLength(1);
    const pResLue = notifRepo.marquerRessourceLue('document', 'd-1');
    httpMock.expectOne('/api/notifications/read-by-resource').flush({ data: { nonLues: 3 } });
    expect(await pResLue).toBe(3);
    const pMarkAll = notifRepo.markAllAsRead();
    httpMock.expectOne('/api/notifications/read-all').flush({});
    await pMarkAll;
    const pDelN = notifRepo.deleteNotification('n1');
    httpMock.expectOne('/api/notifications/n1').flush({});
    await pDelN;

    const emailRepo = TestBed.inject(ChangementEmailRepository);
    const pEmStart = emailRepo.demarrer('new@enspy.cm', 'ancienne_adresse');
    httpMock.expectOne('/api/account/email/demarrer').flush({ data: { id: 'dem-1', prochaineEtape: 'preuve' } });
    expect((await pEmStart).id).toBe('dem-1');
    const pEmAnn = emailRepo.annuler('dem-1');
    httpMock.expectOne('/api/account/email/annuler').flush({ data: {} });
    await pEmAnn;

    const sessRepo = TestBed.inject(SessionRepository);
    const pSess = sessRepo.lister();
    httpMock.expectOne('/api/auth/sessions').flush({ data: [{ sessionId: 's1', navigateur: 'Chrome', os: 'Linux', type: 'ordinateur', courante: true }] });
    expect((await pSess)[0].appareil).toBe('Chrome · Linux');

    const suppRepo = TestBed.inject(SupportRepository);
    const pTkt = suppRepo.createTicket('TECHNIQUE', 'Bug', 'Détails');
    httpMock.expectOne('/api/support/tickets').flush({ data: {} });
    await pTkt;

    const progRepo = TestBed.inject(ProgressionRepository);
    const pBadges = progRepo.getBadges();
    httpMock.expectOne('/api/progression/badges/check').flush({}, { status: 500, statusText: 'Err' });
    await Promise.resolve();
    httpMock.expectOne('/api/progression/badges').flush({ data: [{ code: 'FIRST_READ', titre: 'Lecteur', debloque: true }] });
    expect(await pBadges).toHaveLength(1);

    const repRepo = TestBed.inject(ReportRepository);
    const pSign = repRepo.signaler({ cibleType: CibleSignalement.document, cibleId: 'd1', motif: 'AUTRE', commentaire: 'Détail précis' });
    httpMock.expectOne('/api/reports').flush({ data: { message: 'Reçu', slaHeures: 48 } });
    expect((await pSign).slaHeures).toBe(48);

    const recRepo = TestBed.inject(RecoursRepository);
    const pPoss = recRepo.possibilites();
    httpMock.expectOne('/api/recours/possibilites').flush({ data: { delaiJours: 60, longueurMotifMinimale: 30, possibles: [{ type: 'verification', libelle: 'Vérif', decision: 'Refusée', recoursDejaOuvert: false }] } });
    expect((await pPoss).possibles).toHaveLength(1);
    const pMesR = recRepo.mesRecours();
    httpMock.expectOne('/api/recours/me').flush({ data: [{ id: 'r1', type: 'verification', motif: 'Mon motif détaillé', statut: 'en_attente' }] });
    expect(await pMesR).toHaveLength(1);
    const pDepR = recRepo.deposer('verification', 'Un motif très explicite de plus de trente caractères.', 'cible-1');
    httpMock.expectOne('/api/recours').flush({ data: {} });
    await pDepR;
  });

  it('Failure.depuisErreurHttp traduit les codes Lot 4, Retry-After, fields et pré-auth', () => {
    const fLarge = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        url: '/api/submissions',
        status: 413,
        error: { error: { code: 'FILE_TOO_LARGE', message: 'Trop lourd (>20 Mo)', requestId: 'req-9' } },
        headers: new HttpHeaders({ 'Retry-After': '12' }),
      }),
      true,
    );
    expect(fLarge.message).toContain('Trop lourd');
    expect(fLarge.requestId).toBe('req-9');
    expect(fLarge.retryAfterSeconds).toBe(12);

    const fVal = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        url: '/api/submissions',
        status: 422,
        error: { error: { code: 'VALIDATION_ERROR', details: { fields: { titre: 'Titre requis' } } } },
      }),
      true,
    );
    expect(fVal.fields?.['titre']).toBe('Titre requis');
    expect(fVal.message).toBe('Titre requis');

    const fInvalidJson = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        url: '/api/profile',
        status: 400,
        error: { error: { code: 'INVALID_JSON', message: 'Malformed' } },
      }),
      false,
    );
    expect(fInvalidJson.message).toBe('Cette requête est invalide.');

    const fPreAuth = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        url: '/api/auth/verify-otp',
        status: 401,
        error: { error: { message: 'Code incorrect (2 essais restants)' } },
      }),
      true,
    );
    expect(fPreAuth.message).toContain('2 essais restants');
  });
});
