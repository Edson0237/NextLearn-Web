import { describe, expect, it } from 'vitest';
import { notificationDepuisApi, routeDeNotification } from './notifications';
import {
  badgeDepuisApi,
  jourDepuisApi,
  matiereDepuisApi,
  statsDepuisApi,
} from './progression';
import { resultatQuizDepuisApi } from './quiz';
import { verificationDepuisJson, VerificationStatut, bloqueAcces } from './models';
import { DocumentType } from './bibliotheque';
import { couleurTypeDocument } from '../shared/ui/type-document/presentation-type-document';
import { LienProfond } from './partage';

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
});
