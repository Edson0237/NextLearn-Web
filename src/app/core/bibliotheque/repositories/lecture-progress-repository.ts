import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { enFailure } from '../../network';
import { StockageHorsLigne } from '../services/stockage-hors-ligne';

/**
 * Progression de lecture - traduction de `LectureProgressRemoteRepository`.
 *
 * Tout un pan du produit manquait côté PWA : `/api/progress/lecture` n'était
 * appelé nulle part. Concrètement, rouvrir un document le rouvrait page 1,
 * l'accueil ne pouvait pas proposer « Reprendre », et le tableau de bord
 * comptait zéro document lu - les trois reposent sur cette seule ressource.
 */
export interface LectureProgress {
  readonly documentId: string;
  readonly pageCourante: number;
  readonly totalPages: number;
  readonly derniereLecture: string;
  readonly tempsTotalSecondes: number;
}

export function pourcentageLu(p: LectureProgress): number {
  if (p.totalPages === 0) return 0;
  return Math.min(1, Math.max(0, p.pageCourante / p.totalPages));
}

function depuisApi(json: Record<string, unknown>): LectureProgress {
  const nombre = (v: unknown): number => (typeof v === 'number' ? v : 0);
  const doc = json['documentId'];
  const id =
    doc && typeof doc === 'object' && !Array.isArray(doc)
      ? String((doc as Record<string, unknown>)['_id'] ?? (doc as Record<string, unknown>)['id'] ?? '')
      : String(doc ?? '');
  return {
    documentId: id,
    pageCourante: nombre(json['pageCourante']),
    totalPages: nombre(json['totalPages']),
    derniereLecture: String(json['derniereLecture'] ?? json['updatedAt'] ?? ''),
    tempsTotalSecondes: nombre(json['tempsTotalSecondes']),
  };
}

/** La clé sous laquelle le miroir local de la progression est rangé. */
const CLE_MIROIR = 'nl_lecture_progress';

@Injectable({ providedIn: 'root' })
export class LectureProgressRepository {
  private readonly http = inject(HttpClient);
  private readonly stockage = inject(StockageHorsLigne);

  private cleMiroir(): string {
    const userId = this.stockage.utilisateurActif();
    return userId && userId !== 'anonyme' ? `${CLE_MIROIR}:${userId}` : CLE_MIROIR;
  }

  // ── Miroir local ─────────────────────────────────────────────────────────
  //
  // La progression ne vivait que sur le serveur. Rouvrir un document sans
  // réseau le rouvrait donc page 1 - précisément dans le cas où l'on vient
  // lire ce qu'on a téléchargé pour s'en passer. Et une requête perdue
  // effaçait la position sans que rien ne le dise.
  //
  // Elle est désormais écrite ici **d'abord**, puis poussée au serveur. Le
  // local fait foi quand il est plus récent : c'est lui qui a vu la dernière
  // page tournée. Le serveur reste la mémoire partagée entre appareils.

  private lireMiroir(): Record<string, LectureProgress> {
    try {
      const cle = this.cleMiroir();
      const brut = localStorage.getItem(cle) ?? (cle !== CLE_MIROIR ? localStorage.getItem(CLE_MIROIR) : null);
      if (!brut) return {};
      const objet = JSON.parse(brut) as unknown;
      return objet && typeof objet === 'object' ? (objet as Record<string, LectureProgress>) : {};
    } catch {
      // Stockage illisible ou JSON corrompu : on repart d'un miroir vide
      // plutôt que de refuser la lecture.
      return {};
    }
  }

  private ecrireMiroir(progres: LectureProgress): void {
    try {
      const miroir = this.lireMiroir();
      miroir[progres.documentId] = progres;
      localStorage.setItem(this.cleMiroir(), JSON.stringify(miroir));
    } catch {
      // Quota atteint ou stockage refusé : la position sera perdue à la
      // fermeture, ce qui reste préférable à une lecture interrompue.
    }
  }

  /** De deux positions, celle qui a vu la dernière page tournée. */
  private laPlusRecente(
    a: LectureProgress | null,
    b: LectureProgress | null,
  ): LectureProgress | null {
    if (!a) return b;
    if (!b) return a;
    const da = Date.parse(a.derniereLecture) || 0;
    const db = Date.parse(b.derniereLecture) || 0;
    return db > da ? b : a;
  }

  /** Toute la progression de l'étudiant, indexée par document. */
  async getAll(): Promise<Map<string, LectureProgress>> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/progress/lecture'));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const par = new Map<string, LectureProgress>();
      for (const brut of liste) {
        const p = depuisApi(brut);
        if (p.documentId) par.set(p.documentId, p);
      }
      // Le miroir complète : un document lu hors ligne n'est encore nulle
      // part côté serveur, et une position locale plus récente le corrige.
      for (const [id, local] of Object.entries(this.lireMiroir())) {
        const retenu = this.laPlusRecente(par.get(id) ?? null, local);
        if (retenu) par.set(id, retenu);
      }
      return par;
    } catch (e) {
      // Serveur injoignable : le miroir seul vaut mieux qu'une erreur, car
      // c'est de lui que vivent « Reprendre » et les jauges hors ligne.
      const local = this.lireMiroir();
      if (Object.keys(local).length > 0) {
        return new Map(Object.entries(local));
      }
      throw enFailure(e);
    }
  }

  async getPour(documentId: string): Promise<LectureProgress | null> {
    const local = this.lireMiroir()[documentId] ?? null;
    try {
      const reponse = await firstValueFrom(this.http.get(`/api/progress/lecture/${documentId}`));
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      if (!data) return local;
      const p = depuisApi(data);
      const distant = p.documentId ? p : { ...p, documentId };
      return this.laPlusRecente(local, distant);
    } catch {
      // Serveur muet, hors ligne, ou simplement aucune progression connue :
      // aucun de ces cas n'est une erreur, et le miroir répond pour lui.
      return local;
    }
  }

  /**
   * Enregistre la page atteinte. Volontairement silencieux en cas d'échec :
   * perdre une position de lecture ne doit jamais interrompre la lecture
   * elle-même.
   */
  async enregistrer(progress: {
    documentId: string;
    pageCourante: number;
    totalPages: number;
  }): Promise<void> {
    // Le miroir d'abord, et sans attendre le réseau : c'est lui qui répondra
    // à la prochaine ouverture, avec ou sans serveur.
    this.ecrireMiroir({
      documentId: progress.documentId,
      pageCourante: progress.pageCourante,
      totalPages: progress.totalPages,
      derniereLecture: new Date().toISOString(),
      tempsTotalSecondes: 0,
    });

    try {
      await firstValueFrom(
        this.http.put(`/api/progress/lecture/${progress.documentId}`, {
          pageCourante: progress.pageCourante,
          totalPages: progress.totalPages,
        }),
      );
    } catch {
      // Silencieux : voir ci-dessus. La position est déjà au chaud.
    }
  }

}
