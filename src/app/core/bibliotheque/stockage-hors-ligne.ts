import { Injectable, signal } from '@angular/core';

const NOM_CACHE = 'nl-documents-hors-ligne';
/** Préfixe d'URL interne : le cache est indexé par requête, pas par clé libre. */
const PREFIXE = '/__nl-offline__/';
/** Les métadonnées du document, rangées à côté du fichier. */
const PREFIXE_FICHE = '/__nl-offline-fiche__/';

/**
 * Les documents réellement disponibles hors ligne.
 *
 * `OfflineRepository` ne fait que marquer des identifiants **côté serveur** :
 * utile pour retrouver sa liste d'un appareil à l'autre, inutile sans réseau —
 * et c'est précisément là qu'on en a besoin. Côté Flutter, le fichier est
 * téléchargé puis rangé dans une boîte Hive ; ici il va dans le Cache Storage,
 * le seul stockage du navigateur fait pour des réponses HTTP entières.
 *
 * Pourquoi le Cache Storage et pas IndexedDB : on y range une **réponse**, pas
 * une donnée. Elle se relit telle quelle, garde son type MIME, et se sert
 * directement à pdf.js via une URL d'objet — sans sérialisation intermédiaire.
 *
 * Limite assumée : le navigateur peut évincer ce cache sous pression de
 * stockage, et iOS Safari le fait plus volontiers qu'Android. L'application
 * demande donc la persistance (`navigator.storage.persist`) sans en dépendre :
 * un document évincé se retélécharge, il n'est jamais perdu.
 */
@Injectable({ providedIn: 'root' })
export class StockageHorsLigne {
  /** Identifiants réellement présents sur cet appareil. */
  readonly ids = signal<ReadonlySet<string>>(new Set());

  private pret: Promise<void> | null = null;

  /** Le navigateur sait-il faire ? (pas de Cache Storage hors HTTPS/localhost) */
  get disponible(): boolean {
    return typeof caches !== 'undefined';
  }

  /** Relit l'inventaire local. À appeler avant d'afficher une liste. */
  async rafraichir(): Promise<void> {
    if (!this.disponible) return;
    this.pret ??= this.inventorier();
    await this.pret;
  }

  private async inventorier(): Promise<void> {
    try {
      const cache = await caches.open(NOM_CACHE);
      const cles = await cache.keys();
      const ids = new Set<string>();
      for (const requete of cles) {
        const chemin = new URL(requete.url).pathname;
        if (chemin.startsWith(PREFIXE)) ids.add(decodeURIComponent(chemin.slice(PREFIXE.length)));
      }
      this.ids.set(ids);
    } catch {
      this.ids.set(new Set());
    }
  }

  /**
   * Télécharge le document et le range. Rend `false` si le navigateur ne sait
   * pas faire ou si le fichier n'a pas pu être récupéré — l'appelant décide
   * alors quoi dire, plutôt que de laisser croire à une réussite.
   */
  async enregistrer(documentId: string, url: string): Promise<boolean> {
    if (!this.disponible || !url) return false;
    try {
      await this.demanderPersistance();
      const reponse = await fetch(url, { credentials: 'omit' });
      if (!reponse.ok) return false;
      const cache = await caches.open(NOM_CACHE);
      await cache.put(PREFIXE + encodeURIComponent(documentId), reponse);
      this.ids.set(new Set([...this.ids(), documentId]));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Range la fiche du document à côté de son fichier.
   *
   * Sans elle, la bibliothèque hors ligne connaissait des identifiants sans
   * savoir ce qu'ils désignent : il fallait interroger le serveur pour
   * afficher un titre, c'est-à-dire être en ligne pour lire une liste de
   * documents hors ligne.
   */
  async enregistrerFiche(documentId: string, fiche: unknown): Promise<void> {
    if (!this.disponible) return;
    try {
      const cache = await caches.open(NOM_CACHE);
      await cache.put(
        PREFIXE_FICHE + encodeURIComponent(documentId),
        new Response(JSON.stringify(fiche), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    } catch {
      // La fiche manquera ; le fichier, lui, reste lisible.
    }
  }

  /**
   * Toutes les fiches rangées localement, telles qu'elles ont été
   * enregistrées — c'est-à-dire **déjà analysées**. Les repasser dans le
   * parseur d'API les déformerait : `matiereId` y est redevenu une simple
   * chaîne, et la matière s'afficherait « Matière ».
   */
  async fiches(): Promise<Record<string, unknown>[]> {
    if (!this.disponible) return [];
    try {
      const cache = await caches.open(NOM_CACHE);
      const cles = await cache.keys();
      const fiches: Record<string, unknown>[] = [];
      for (const requete of cles) {
        if (!new URL(requete.url).pathname.startsWith(PREFIXE_FICHE)) continue;
        const reponse = await cache.match(requete);
        if (!reponse) continue;
        try {
          fiches.push((await reponse.json()) as Record<string, unknown>);
        } catch {
          continue;
        }
      }
      return fiches;
    } catch {
      return [];
    }
  }

  /** Une URL d'objet utilisable par le lecteur, ou `null` si absent du cache. */
  async urlLocale(documentId: string): Promise<string | null> {
    if (!this.disponible) return null;
    try {
      const cache = await caches.open(NOM_CACHE);
      const reponse = await cache.match(PREFIXE + encodeURIComponent(documentId));
      if (!reponse) return null;
      return URL.createObjectURL(await reponse.blob());
    } catch {
      return null;
    }
  }

  async supprimer(documentId: string): Promise<void> {
    if (!this.disponible) return;
    try {
      const cache = await caches.open(NOM_CACHE);
      await cache.delete(PREFIXE + encodeURIComponent(documentId));
      await cache.delete(PREFIXE_FICHE + encodeURIComponent(documentId));
      const restants = new Set(this.ids());
      restants.delete(documentId);
      this.ids.set(restants);
    } catch {
      // Rien à faire : le document restera listé, et le prochain inventaire
      // rétablira la vérité.
    }
  }

  /** Vide tout — l'action « Libérer de l'espace » des réglages. */
  async viderTout(): Promise<void> {
    if (!this.disponible) return;
    try {
      await caches.delete(NOM_CACHE);
      this.ids.set(new Set());
      this.pret = null;
    } catch {
      // idem
    }
  }

  /**
   * Place occupée et place totale, en octets, telles que le navigateur les
   * estime. `null` quand il ne sait pas — Safari ne répond pas toujours, et
   * une jauge vaut mieux absente qu'inventée.
   */
  async estimation(): Promise<{ utilise: number; total: number } | null> {
    try {
      const mesure = await navigator.storage?.estimate?.();
      if (!mesure?.quota) return null;
      return { utilise: mesure.usage ?? 0, total: mesure.quota };
    } catch {
      return null;
    }
  }

  /**
   * Demande au navigateur de ne pas évincer ce stockage.
   *
   * Chrome l'accorde silencieusement à une application installée ; Safari iOS
   * l'ignore souvent. Le refus n'est pas traité comme une erreur : on
   * enregistre quand même, en sachant que le document pourra devoir être
   * retéléchargé un jour.
   */
  private async demanderPersistance(): Promise<void> {
    try {
      if (await navigator.storage?.persisted?.()) return;
      await navigator.storage?.persist?.();
    } catch {
      // API absente : rien à demander.
    }
  }
}
