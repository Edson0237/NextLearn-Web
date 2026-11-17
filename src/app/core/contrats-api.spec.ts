import { describe, expect, it } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { notificationDepuisApi, routeDeNotification } from './notifications';
import {
  badgeDepuisApi,
  jourDepuisApi,
  matiereDepuisApi,
  statsDepuisApi,
} from './progression';
import { resultatQuizDepuisApi } from './quiz';
import { Failure, verificationDepuisJson, VerificationStatut, bloqueAcces } from './models';
import {
  DocumentType,
  cleCacheCatalogue,
  reponseCatalogueDepuisApi,
  ressourceVersDocumentModel,
} from './bibliotheque';
import { couleurTypeDocument } from '../shared/ui/type-document/presentation-type-document';
import { LienProfond } from './partage';
import {
  nettoyerModificationProfilEtude,
  profilEtudeDepuisApi,
  sessionDepuisApi,
} from './profil';
import { configGithubDepuisApi } from './auth';
import { normaliserMotifFinSession } from './network';

/**
 * Contrats d'API, épinglés sur des charges utiles **réelles**.
 *
 * Chaque cas ci-dessous est recopié de ce que `nextlearn_api_v1` renvoie
 * vraiment (modèles Mongo et services, vérifiés sur le dépôt backend), et non
 * de ce que la PWA espérait recevoir. C'est précisément l'écart entre les deux
 * qui laissait passer six défauts muets : un corps de notification vide, des
 * badges sans nom, un graphe de semaine vide, des matières sans libellé, un
 * dénominateur de quiz à zéro et un dossier de vérification jamais reconnu
 * comme validé.
 *
 * Ces tests ne valent que tant qu'ils collent au serveur : si l'API change de
 * clé, c'est ici que ça doit casser, pas dans un écran.
 */
describe('contrats API', () => {
  it('notification : le corps vient de `corps`, la destination de `metadata`', () => {
    const n = notificationDepuisApi({
      _id: 'n1',
      titre: 'Nouveau document',
      corps: 'Chapitre 3 vient d’être publié.',
      type: 'DOCUMENT',
      lu: false,
      metadata: { documentId: 'd42' },
      createdAt: '2026-10-20T09:00:00.000Z',
    });

    expect(n.corps).toBe('Chapitre 3 vient d’être publié.');
    expect(routeDeNotification(n)).toBe('bibliotheque/doc/d42');
  });

  it('notification : sans métadonnée reconnue, aucune destination inventée', () => {
    const n = notificationDepuisApi({ _id: 'n2', titre: 'Info', corps: 'Coucou', metadata: {} });
    expect(routeDeNotification(n)).toBeNull();
  });

  it('badge : type, titre, description, earnedAt', () => {
    const b = badgeDepuisApi({
      type: 'semaine_parfaite',
      titre: 'Semaine Parfaite',
      description: "7 jours consécutifs d'étude",
      earnedAt: '2026-09-15T10:00:00.000Z',
    });

    expect(b.titre).toBe('Semaine Parfaite');
    expect(b.type).toBe('semaine_parfaite');
    expect(b.earnedAt).toBe('2026-09-15T10:00:00.000Z');
  });

  it('activité : la clé du jour est `day`, celle de la matière est `matiere`', () => {
    expect(jourDepuisApi({ day: '2026-10-21', minutes: 45 })).toEqual({
      day: '2026-10-21',
      minutes: 45,
    });
    expect(matiereDepuisApi({ matiere: 'Algorithmique', minutes: 320 })).toEqual({
      matiere: 'Algorithmique',
      minutes: 320,
    });
  });

  it('stats : `/api/progression/stats` ne porte ni docsTelecharges ni heuresEtude', () => {
    const s = statsDepuisApi({
      totalMinutes: 845,
      sessionCount: 12,
      streak: 5,
      streakDoneToday: true,
      docsLus: 23,
      matiereTop: 'Algorithmique',
    });

    expect(s.totalMinutes).toBe(845);
    expect(s.sessionCount).toBe(12);
    expect(s.matiereTop).toBe('Algorithmique');
    expect(s.streakDoneToday).toBe(true);
  });

  it('quiz : le dénominateur est `totalQuestions`, et `details` porte la correction', () => {
    const r = resultatQuizDepuisApi({
      score: 3,
      totalQuestions: 4,
      details: [
        { questionId: 'q1', estCorrect: true, bonneReponseIndex: 1, explication: 'Dichotomie.' },
        { questionId: 'q2', estCorrect: false, bonneReponseIndex: 0, explication: '' },
      ],
    });

    expect(r.score).toBe(3);
    expect(r.totalQuestions).toBe(4);
    expect(r.details).toHaveLength(2);
    expect(r.details[1].bonneReponseIndex).toBe(0);
  });

  it('vérification : `approuve` ouvre l’accès, `en_revue` le garde fermé', () => {
    const approuve = verificationDepuisJson({ requis: true, statut: 'approuve', tentatives: 1 });
    expect(approuve.statut).toBe(VerificationStatut.approuve);
    expect(bloqueAcces(approuve)).toBe(false);

    const enRevue = verificationDepuisJson({
      requis: true,
      statut: 'en_revue',
      tentatives: 2,
      resoumissionsRestantes: 1,
    });
    expect(enRevue.statut).toBe(VerificationStatut.enRevue);
    expect(bloqueAcces(enRevue)).toBe(true);
    expect(enRevue.resoumissionsRestantes).toBe(1);
  });

  it('vérification : le motif de rejet lisible prime sur le code', () => {
    const rejete = verificationDepuisJson({
      requis: true,
      statut: 'rejete',
      motifRejetCode: 'ILLISIBLE',
      motifRejetTexte: 'La photo est floue.',
    });
    expect(rejete.motifRejet).toBe('La photo est floue.');
  });

  it('couleur de type : une variable de thème, pas un hexadécimal figé', () => {
    expect(couleurTypeDocument(DocumentType.cours)).toBe('var(--type-cours)');
    expect(couleurTypeDocument(DocumentType.autre)).toBe('var(--neutral)');
  });

  it('lien profond : même format qu’en mobile, et relu sans se tromper', () => {
    const lien = LienProfond.document('abc123');
    expect(lien).toMatch(/\/d\/abc123$/);
    expect(LienProfond.documentDepuisChemin('/d/abc123')).toBe('abc123');
    expect(LienProfond.documentDepuisChemin('/app/home')).toBeNull();
    expect(LienProfond.documentDepuisChemin('/d/')).toBeNull();
  });

  it('P1 /auth/sessions : lit les champs enrichis et gère une session ancienne sans métadonnées', () => {
    const enrichie = sessionDepuisApi({
      sessionId: '665f001',
      appareil: 'Chrome · Windows',
      navigateur: 'Chrome',
      os: 'Windows',
      type: 'ordinateur',
      pays: 'CM',
      ip: '41.202.207.0',
      courante: true,
      creeeLe: '2026-11-15T09:12:00.000Z',
      derniereActiviteLe: '2026-11-15T10:40:00.000Z',
      expireLe: '2026-12-15T10:40:00.000Z',
    });
    expect(enrichie.sessionId).toBe('665f001');
    expect(enrichie.appareil).toBe('Chrome · Windows');
    expect(enrichie.navigateur).toBe('Chrome');
    expect(enrichie.os).toBe('Windows');
    expect(enrichie.type).toBe('ordinateur');
    expect(enrichie.pays).toBe('CM');
    expect(enrichie.ip).toBe('41.202.207.0');
    expect(enrichie.courante).toBe(true);
    expect(enrichie.expireLe).toBeInstanceOf(Date);

    const ancienne = sessionDepuisApi({ sessionId: 'old1', courante: false });
    expect(ancienne.appareil).toBe('Appareil inconnu');
    expect(ancienne.navigateur).toBeUndefined();
    expect(ancienne.pays).toBeUndefined();
  });

  it('P2 /auth/refresh & 401 : conserve les motifs précis et reformule le motif banal', () => {
    expect(
      normaliserMotifFinSession('Ta session a expiré par inactivité. Reconnecte-toi pour continuer.'),
    ).toBe('Ta session a expiré par inactivité. Reconnecte-toi pour continuer.');
    expect(
      normaliserMotifFinSession('Session fermée par sécurité : un ancien jeton a été réutilisé. Reconnecte-toi.'),
    ).toBe('Session fermée par sécurité : un ancien jeton a été réutilisé. Reconnecte-toi.');
    expect(normaliserMotifFinSession('Session fermée. Reconnecte-toi.')).toBe(
      'Session fermée. Reconnecte-toi.',
    );
    expect(normaliserMotifFinSession('Refresh token invalide ou révoqué')).toBe(
      'Ta session s’est terminée. Reconnecte-toi.',
    );
  });

  it('P4 /auth/github/config : gère les deux formes (activé et désactivé)', () => {
    const active = configGithubDepuisApi({
      enabled: true,
      clientId: 'Iv1.abc123',
      scope: 'read:user user:email',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
    });
    expect(active.enabled).toBe(true);
    expect(active.clientId).toBe('Iv1.abc123');
    expect(active.scope).toBe('read:user user:email');

    const inactive = configGithubDepuisApi({ enabled: false });
    expect(inactive.enabled).toBe(false);
    expect(inactive.clientId).toBeUndefined();
  });

  it('P5 /v2/catalogue : parse ressources, facettes avec compteurs et pagination par curseur', () => {
    const rep = reponseCatalogueDepuisApi({
      data: {
        ressources: [
          {
            id: 'doc-1',
            titre: 'Analyse 1 - SN (2024-2025)',
            type: 'EPREUVE',
            typeEpreuve: 'SN',
            matiere: { id: 'mat-1', nom: 'Analyse 1' },
            enseignant: { id: 'ens-1', nom: 'Dr Paul MBALLA' },
            anneeAcademique: '2024-2025',
            semestre: 'S1',
            niveau: 'N1',
            section: 'FRANCOPHONE',
            avecCorrige: true,
            dureeMinutes: 120,
            fichier: { pages: 4, tailleMb: 1.2 },
            dateAjout: '2026-10-02T08:00:00.000Z',
          },
        ],
        total: 137,
        pagination: { limit: 20, page: 1, hasMore: true, nextCursor: 'eyJ cursor' },
        filtresActifs: {
          type: [],
          typeEpreuve: ['SN'],
          semestre: ['S1'],
          matiere: [],
          enseignant: [],
          annee: [],
          section: [],
          avecCorrige: null,
          q: null,
          tri: 'recent',
        },
        facettes: {
          type: [{ valeur: 'EPREUVE', label: 'Épreuve', labelEn: 'Exam', n: 137, selectionne: false }],
          typeEpreuve: [
            { valeur: 'SN', label: 'Session normale', labelEn: 'Final exam', n: 137, selectionne: true },
            { valeur: 'CC', label: 'Contrôle continu', labelEn: 'Continuous assessment', n: 84, selectionne: false },
          ],
          semestre: [{ valeur: 'S1', label: 'Semestre 1', labelEn: 'Semester 1', n: 137, selectionne: true }],
          matiere: [{ valeur: 'mat-1', label: 'Analyse 1', labelEn: 'Analyse 1', n: 12, selectionne: false }],
          enseignant: [{ valeur: 'ens-1', label: 'Dr Paul MBALLA', labelEn: 'Dr Paul MBALLA', n: 8, selectionne: false }],
          annee: [{ valeur: '2024-2025', label: '2024-2025', labelEn: '2024-2025', n: 45, selectionne: false }],
          section: [{ valeur: 'FRANCOPHONE', label: 'Francophone', labelEn: 'Francophone', n: 120, selectionne: false }],
          avecCorrige: [{ valeur: true, label: 'Avec corrigé', labelEn: 'With solution', n: 5, selectionne: false }],
        },
      },
    });

    expect(rep.total).toBe(137);
    expect(rep.pagination.hasMore).toBe(true);
    expect(rep.pagination.nextCursor).toBe('eyJ cursor');
    expect(rep.facettes.typeEpreuve).toHaveLength(2);
    expect(rep.facettes.typeEpreuve[1].n).toBe(84);

    const doc = ressourceVersDocumentModel(rep.ressources[0]);
    expect(doc.id).toBe('doc-1');
    expect(doc.type).toBe(DocumentType.epreuve);
    expect(doc.typeEpreuve).toBe('SN');
    expect(doc.matiereId).toBe('mat-1');
    expect(doc.enseignantId).toBe('ens-1');
    expect(doc.pages).toBe(4);
    expect(doc.tailleMb).toBe(1.2);
  });

  it('P6 /v2/me/profil-etude : lit compte, étude et complétude, et filtre les clés inconnues au PUT', () => {
    const profil = profilEtudeDepuisApi({
      data: {
        compte: {
          id: 'u1',
          prenom: 'Amina',
          nom: 'Ndiaye',
          email: 'amina@institutsaintjean.org',
          avatarUrl: null,
          universite: { id: 'uni1', nom: 'Saint Jean Ingénieur (SJI)' },
          filiere: { id: 'fil1', nom: 'ISI' },
          cycle: 'INGENIEUR',
          niveau: 'N3',
          section: 'FRANCOPHONE',
          langue: 'fr',
          verifie: true,
          premium: false,
          membreDepuis: '2026-09-01T00:00:00.000Z',
        },
        etude: {
          matieresDifficiles: [{ id: 'm1', nom: 'Analyse 1' }],
          objectif: 'reussir',
          dateProchainExamen: '2027-01-12',
          joursAvantExamen: 58,
          languesDocuments: ['fr'],
          formatsPreferes: ['pdf'],
          economieDonnees: false,
          rappels: { actifs: true, heure: '18:30' },
          consentementSuivi: true,
        },
        completude: {
          pourcentage: 65,
          manquants: [{ cle: 'objectif', fr: 'Quel est ton objectif ?', en: 'What is your goal?' }],
        },
      },
    });

    expect(profil.compte.universite.nom).toBe('Saint Jean Ingénieur (SJI)');
    expect(profil.etude.objectif).toBe('reussir');
    expect(profil.etude.joursAvantExamen).toBe(58);
    expect(profil.completude.pourcentage).toBe(65);
    expect(profil.completude.manquants[0].en).toBe('What is your goal?');

    const corps = nettoyerModificationProfilEtude({
      objectif: 'mention',
      rappels: { actifs: true, heure: '19:00' },
      ...({ champInconnu: 'interdit' } as Record<string, unknown>),
    });
    expect(corps).toEqual({
      objectif: 'mention',
      rappels: { actifs: true, heure: '19:00' },
    });
  });

  it('P8 /documents/submissions : conserve details.code = DUPLICATE_FILE, existant et conseil sur 409', () => {
    const httpErr = new HttpErrorResponse({
      status: 409,
      url: '/api/documents/submissions',
      error: {
        error: {
          code: 'CONFLICT',
          message: 'Ce fichier est déjà présent dans NextLearn comme une épreuve : « SN Analyse 1 ».',
          details: {
            code: 'DUPLICATE_FILE',
            existant: { type: 'epreuve', id: 'ep-99', titre: 'SN Analyse 1' },
            conseil: 'Inutile de le renvoyer : ouvrez la fiche existante.',
          },
        },
      },
    });

    const failure = Failure.depuisErreurHttp(httpErr, true);
    expect(failure.statusCode).toBe(409);
    expect(failure.code).toBe('CONFLICT');
    expect(failure.message).toContain('SN Analyse 1');
    expect(failure.details?.['code']).toBe('DUPLICATE_FILE');
    expect((failure.details?.['existant'] as Record<string, unknown>)?.['id']).toBe('ep-99');
    expect(failure.details?.['conseil']).toBe('Inutile de le renvoyer : ouvrez la fiche existante.');
  });

  it('P11 : cleCacheCatalogue isole par utilisateur, mode de classe, classe et filtres (y compris avecCorrige=false)', () => {
    const cleProfilU1 = cleCacheCatalogue('user-1', 'profil', { tri: 'recent', avecCorrige: false });
    const cleProfilU2 = cleCacheCatalogue('user-2', 'profil', { tri: 'recent', avecCorrige: false });
    const cleAltB = cleCacheCatalogue('user-1', 'alternative', {
      universiteId: 'u-b',
      filiereId: 'f-b',
      niveau: 'N1',
      tri: 'recent',
      avecCorrige: false,
    });
    const cleSansCorrigeNonDefini = cleCacheCatalogue('user-1', 'profil', { tri: 'recent', avecCorrige: null });

    expect(cleProfilU1).not.toBe(cleProfilU2);
    expect(cleProfilU1).not.toBe(cleAltB);
    expect(cleProfilU1).not.toBe(cleSansCorrigeNonDefini);
    expect(cleProfilU1).toContain(':false:');
  });

  it('P12 & P13 : extrait requestId, details.fields (sans issues) et les codes FILE_TOO_LARGE, UPLOAD_INVALID, PAYLOAD_TOO_LARGE', () => {
    const validationErr = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        status: 400,
        url: '/api/documents/submissions',
        error: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Le titre est requis',
            requestId: 'req-val-123',
            details: {
              fields: { titre: 'Le titre est requis', matiereId: 'Choisis une matière' },
              issues: [{ path: ['titre'], message: 'schéma interne' }],
            },
          },
        },
      }),
      true,
    );
    expect(validationErr.code).toBe('VALIDATION_ERROR');
    expect(validationErr.requestId).toBe('req-val-123');
    expect(validationErr.fields).toEqual({
      titre: 'Le titre est requis',
      matiereId: 'Choisis une matière',
    });
    expect(validationErr.details?.['issues']).toBeUndefined();

    const fileTooLarge = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        status: 413,
        url: '/api/documents/submissions',
        error: {
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Le fichier est trop volumineux.',
            requestId: 'req-413-file',
          },
        },
      }),
      true,
    );
    expect(fileTooLarge.statusCode).toBe(413);
    expect(fileTooLarge.code).toBe('FILE_TOO_LARGE');
    expect(fileTooLarge.message).toBe('Le fichier est trop volumineux.');
    expect(fileTooLarge.requestId).toBe('req-413-file');

    const uploadInvalid = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        status: 400,
        url: '/api/documents/submissions',
        error: {
          error: {
            code: 'UPLOAD_INVALID',
            message: 'L’envoi du fichier est invalide.',
          },
        },
      }),
      true,
    );
    expect(uploadInvalid.code).toBe('UPLOAD_INVALID');
    expect(uploadInvalid.message).toBe('L’envoi du fichier est invalide.');

    const internalErr = Failure.depuisErreurHttp(
      new HttpErrorResponse({
        status: 500,
        url: '/api/v2/catalogue',
        error: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Stack trace interne MongoError',
            requestId: 'req-500-xyz',
          },
        },
      }),
      true,
    );
    expect(internalErr.statusCode).toBe(500);
    expect(internalErr.requestId).toBe('req-500-xyz');
    expect(internalErr.message).toBe('Une erreur est survenue de notre côté. Réessaie dans un instant.');
  });
});
