import { Injectable, signal } from '@angular/core';
import {
  ContexteClasseBibliotheque,
  ModeClasse,
  ReponseCatalogue,
  RequeteCatalogue,
  cleCacheCatalogue,
} from '../models/catalogue.model';

const PREFIXE_STOCKAGE_CLASSE = 'nl_classe_consultation_';
const TTL_CACHE_CATALOGUE_MS = 30_000;
const MAX_ENTREES_CACHE = 40;

interface EntreeCacheCatalogue {
  readonly reponse: ReponseCatalogue;
  readonly expireA: number;
}

/**
 * Gère le cache applicatif isolé en mémoire (§9.3) et garantit que la Bibliothèque
 * fonctionne automatiquement selon le parcours du compte (`mode: 'profil'`), sans
 * sélecteur ni persistance de classe alternative.
 */
@Injectable({ providedIn: 'root' })
export class ClasseBibliothequeService {
  private readonly _contexte = signal<ContexteClasseBibliotheque>({
    mode: 'profil',
    classe: null,
  });
  readonly contexte = this._contexte.asReadonly();

  private utilisateurCourantId: string | null = null;
  private readonly cacheMemoire = new Map<string, EntreeCacheCatalogue>();

  /**
   * Synchronise le service avec l'utilisateur actif :
   * purge le cache en cas de changement de compte / déconnexion et nettoie
   * d'éventuelles anciennes préférences de classe alternative stockées localement.
   */
  synchroniserUtilisateur(userId: string | null): ContexteClasseBibliotheque {
    const idNormalise = userId?.trim() || null;
    if (this.utilisateurCourantId !== idNormalise) {
      this.invaliderCache();
      this.utilisateurCourantId = idNormalise;
      if (idNormalise) {
        this.supprimerClasseStockee(idNormalise);
      }
      const ctx: ContexteClasseBibliotheque = { mode: 'profil', classe: null };
      this._contexte.set(ctx);
      return ctx;
    }
    return this._contexte();
  }

  /** Restaure explicitement l'état par défaut (`profil`). */
  revenirAMaClasse(userId?: string | null): void {
    const idNormalise = userId?.trim() || this.utilisateurCourantId;
    if (idNormalise) {
      this.supprimerClasseStockee(idNormalise);
    }
    this._contexte.set({ mode: 'profil', classe: null });
  }

  /**
   * Nettoie l'état mémoire et le cache applicatif lors de la déconnexion
   * ou d'un changement de session (§9.3, §20.3).
   */
  reinitialiserSession(): void {
    this.invaliderCache();
    this.utilisateurCourantId = null;
    this._contexte.set({ mode: 'profil', classe: null });
  }

  // ── Cache mémoire isolé par utilisateur, classe et filtres (§9.3) ──────────

  lireCache(
    userId: string | null | undefined,
    modeClasse: ModeClasse,
    requete: RequeteCatalogue,
  ): ReponseCatalogue | null {
    if (!userId) return null;
    const cle = cleCacheCatalogue(userId, modeClasse, requete);
    const entree = this.cacheMemoire.get(cle);
    if (!entree) return null;
    if (Date.now() > entree.expireA) {
      this.cacheMemoire.delete(cle);
      return null;
    }
    return entree.reponse;
  }

  ecrireCache(
    userId: string | null | undefined,
    modeClasse: ModeClasse,
    requete: RequeteCatalogue,
    reponse: ReponseCatalogue,
    ttlMs = TTL_CACHE_CATALOGUE_MS,
  ): void {
    if (!userId) return;
    if (this.cacheMemoire.size >= MAX_ENTREES_CACHE) {
      const premiereCle = this.cacheMemoire.keys().next().value;
      if (premiereCle) this.cacheMemoire.delete(premiereCle);
    }
    const cle = cleCacheCatalogue(userId, modeClasse, requete);
    this.cacheMemoire.set(cle, {
      reponse,
      expireA: Date.now() + ttlMs,
    });
  }

  invaliderCache(): void {
    this.cacheMemoire.clear();
  }

  private cleStockage(userId: string): string {
    return `${PREFIXE_STOCKAGE_CLASSE}${userId}`;
  }

  private supprimerClasseStockee(userId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.cleStockage(userId));
    } catch {
      // Ignoré
    }
  }
}
