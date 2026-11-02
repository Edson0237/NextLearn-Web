import { Injectable } from '@angular/core';
import { detecterCoins } from '../utils/detection-bords';
import { Quad } from '../utils/geometrie';

/** Définition de l'image envoyée à la détection : assez pour repérer une page, peu pour aller vite. */
export const COTE_TEMPS_REEL = 160;

/**
 * La détection de la page pour la caméra en direct.
 *
 * Elle tourne dans un **Web Worker** : le calcul ne vole plus de temps au flux
 * vidéo ni aux gestes. Une seule image est en cours à la fois ; si l'appelant en
 * propose une autre pendant ce temps, elle est simplement ignorée (`null`) - mieux
 * vaut sauter une image que d'empiler du retard derrière une caméra qui en produit
 * trente par seconde.
 *
 * Sans Worker (navigateur ancien, tests), le calcul se fait sur le fil principal,
 * mais avec la même file d'une image : la détection reste rapide (quelques
 * millisecondes à cette définition) et ne s'accumule jamais.
 */
@Injectable({ providedIn: 'root' })
export class DetectionTempsReel {
  private worker: Worker | null = null;
  private essaye = false;
  private occupe = false;
  private id = 0;
  private enAttente: ((q: Quad | null) => void) | null = null;

  /** `undefined` : une image est déjà en cours, celle-ci est ignorée. */
  detecter(image: ImageData): Promise<Quad | null> | undefined {
    if (this.occupe) return undefined;
    this.occupe = true;
    const w = this.obtenirWorker();

    if (!w) {
      return new Promise((ok) =>
        setTimeout(() => {
          this.occupe = false;
          ok(detecterCoins(image, { flou: false }));
        }),
      );
    }

    const id = ++this.id;
    return new Promise((ok) => {
      this.enAttente = (q) => {
        this.occupe = false;
        this.enAttente = null;
        ok(q);
      };
      w.onmessage = (e: MessageEvent<{ id: number; coins: Quad | null }>) => {
        if (e.data.id === id) this.enAttente?.(e.data.coins);
      };
      // Le tampon part sans copie : l'image n'est plus lisible ici après l'envoi.
      w.postMessage({ id, tampon: image.data.buffer, largeur: image.width, hauteur: image.height }, [image.data.buffer]);
    });
  }

  /** Libère le Worker quand la caméra se ferme. */
  arreter(): void {
    this.enAttente?.(null);
    this.worker?.terminate();
    this.worker = null;
    this.essaye = false;
    this.occupe = false;
  }

  private obtenirWorker(): Worker | null {
    if (this.worker || this.essaye) return this.worker;
    this.essaye = true;
    if (typeof Worker === 'undefined') return null;
    try {
      this.worker = new Worker(new URL('../workers/detection.worker', import.meta.url), { type: 'module' });
      // Un Worker qui échoue (chargement bloqué, CSP) ne casse pas la caméra : repli sur le fil principal.
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
        this.enAttente?.(null);
      };
    } catch {
      this.worker = null;
    }
    return this.worker;
  }
}
