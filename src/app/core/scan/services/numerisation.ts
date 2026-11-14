import { Injectable, signal } from '@angular/core';
import { PageJpeg } from '../utils/pdf-assembleur';
import { COTE_DETECTION, detecterCoins } from '../utils/detection-bords';
import { PLEIN_CADRE, Pixels, Quad, quadValide, redresser, tailleSortie } from '../utils/geometrie';
import { appliquerReglages, pivoter, REGLAGES_PAR_DEFAUT, Reglages } from '../utils/filtres-image';

/** Côté le plus long d'une page numérisée : assez pour lire un cours, assez léger pour le réseau. */
const COTE_MAX = 2000;
/** Définition de travail de la photo : au-delà, on ne gagne que du temps de calcul. */
const COTE_SOURCE = 2400;
const QUALITE_JPEG = 0.85;
const CLE_AUTO_CADRAGE = 'nl_scan_cadrage_auto';

/** Une page prise ou importée, gardée en mémoire pour pouvoir la recadrer, la retourner ou la retoucher. */
export interface PageNumerisee {
  readonly id: number;
  /** L'image d'origine, une fois orientée : on repart d'elle à chaque retouche. */
  readonly source: ImageBitmap;
  /** Les quatre coins de la page sur la photo (0 à 1). Plein cadre quand rien n'a été repéré. */
  readonly coins: Quad;
  /** Les coins viennent de la détection automatique (sinon : plein cadre ou ajustés à la main). */
  readonly detectee: boolean;
  /** Quarts de tour dans le sens horaire (0 à 3). */
  readonly rotation: number;
  readonly reglages: Reglages;
  /** Adresse d'aperçu de la page rendue (`blob:`), à libérer quand la page disparaît. */
  readonly apercu: string;
  /** Adresse de la photo entière, pour l'écran de recadrage. */
  readonly apercuSource: string;
  readonly largeur: number;
  readonly hauteur: number;
  readonly octets: Uint8Array;
}

/** Ce qu'on peut changer sur une page ; le reste est recalculé à partir de la photo d'origine. */
export interface Retouche {
  readonly coins?: Quad;
  readonly detectee?: boolean;
  readonly rotation?: number;
  readonly reglages?: Reglages;
}

/**
 * Le scanner de documents de la PWA.
 *
 * Tout se passe sur l'appareil : la photo est orientée, la page y est repérée
 * (quatre coins), redressée (perspective), éclaircie (mode, luminosité,
 * contraste) puis encodée en JPEG. Aucune image ne quitte le téléphone avant
 * l'envoi du PDF final, et aucune bibliothèque de vision n'est téléchargée.
 */
@Injectable({ providedIn: 'root' })
export class Numerisation {
  private prochainId = 1;
  /** Les réglages donnés à une nouvelle page : ceux de la dernière retouche « pour toutes les pages ». */
  readonly reglagesParDefaut = signal<Reglages>(REGLAGES_PAR_DEFAUT);

  /**
   * Le cadrage automatique : repérer la page pendant la prise de vue et la recadrer
   * après. Actif par défaut, et désactivable - pour qui préfère prendre la photo
   * telle quelle et cadrer à la main. Le choix est gardé d'une visite à l'autre.
   */
  readonly autoCadrage = signal(this.lireAutoCadrage());

  definirAutoCadrage(actif: boolean): void {
    this.autoCadrage.set(actif);
    try {
      localStorage.setItem(CLE_AUTO_CADRAGE, actif ? '1' : '0');
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session.
    }
  }

  private lireAutoCadrage(): boolean {
    try {
      return localStorage.getItem(CLE_AUTO_CADRAGE) !== '0';
    } catch {
      return true;
    }
  }

  /** Crée une page depuis une photo ; la page y est cherchée automatiquement. */
  async creer(fichier: File): Promise<PageNumerisee> {
    const source = await this.chargerImage(fichier);
    // Désactivé : la photo est prise telle quelle, plein cadre, à recadrer à la main si besoin.
    const coins = this.autoCadrage() ? this.detecter(source) : null;
    return this.rendre({
      id: this.prochainId++,
      source,
      coins: coins ?? PLEIN_CADRE,
      detectee: coins !== null,
      rotation: 0,
      reglages: this.reglagesParDefaut(),
      apercuSource: await this.apercuSource(source),
    });
  }

  private async chargerImage(fichier: File): Promise<ImageBitmap> {
    try {
      // `from-image` applique l'orientation EXIF : sans elle, une photo prise en portrait arrive couchée.
      return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    } catch {
      try {
        return await createImageBitmap(fichier);
      } catch {
        const url = URL.createObjectURL(fichier);
        try {
          const img = await new Promise<HTMLImageElement>((ok, ko) => {
            const el = new Image();
            el.onload = () => ok(el);
            el.onerror = () => ko(new Error('Image illisible.'));
            el.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          return await createImageBitmap(canvas);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    }
  }

  /** Cherche la page dans une image ; `null` quand la détection n'est pas sûre. */
  detecter(source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement): Quad | null {
    const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    if (!w || !h) return null;
    const echelle = Math.min(1, COTE_DETECTION / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * echelle));
    canvas.height = Math.max(1, Math.round(h * echelle));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return detecterCoins(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  /** Refait le rendu d'une page avec la retouche demandée, à partir de sa photo d'origine. */
  async retoucher(page: PageNumerisee, retouche: Retouche): Promise<PageNumerisee> {
    URL.revokeObjectURL(page.apercu);
    return this.rendre({
      id: page.id,
      source: page.source,
      coins: retouche.coins ?? page.coins,
      detectee: retouche.detectee ?? page.detectee,
      rotation: retouche.rotation !== undefined ? ((retouche.rotation % 4) + 4) % 4 : page.rotation,
      reglages: retouche.reglages ?? page.reglages,
      apercuSource: page.apercuSource,
    });
  }

  liberer(page: PageNumerisee): void {
    URL.revokeObjectURL(page.apercu);
    URL.revokeObjectURL(page.apercuSource);
    page.source.close();
  }

  versJpeg(page: PageNumerisee): PageJpeg {
    return { octets: page.octets, largeur: page.largeur, hauteur: page.hauteur };
  }

  private async apercuSource(source: ImageBitmap): Promise<string> {
    const echelle = Math.min(1, 1400 / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * echelle);
    canvas.height = Math.round(source.height * echelle);
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    return URL.createObjectURL(await this.versBlob(canvas, 0.8));
  }

  private versBlob(canvas: HTMLCanvasElement, qualite: number): Promise<Blob> {
    return new Promise<Blob>((ok, ko) =>
      canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Encodage de la page impossible.'))), 'image/jpeg', qualite),
    );
  }

  private async rendre(base: Omit<PageNumerisee, 'apercu' | 'largeur' | 'hauteur' | 'octets'>): Promise<PageNumerisee> {
    const { source } = base;
    const echelle = Math.min(1, COTE_SOURCE / Math.max(source.width, source.height));
    const sw = Math.max(1, Math.round(source.width * echelle));
    const sh = Math.max(1, Math.round(source.height * echelle));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Le navigateur ne sait pas dessiner l’image.');
    ctx.drawImage(source, 0, 0, sw, sh);
    const photo: Pixels = ctx.getImageData(0, 0, sw, sh);

    // Des coins dégénérés (déplacés n'importe comment) ne doivent jamais faire échouer le rendu.
    const coins = quadValide(base.coins) ? base.coins : PLEIN_CADRE;
    const { largeur, hauteur } = tailleSortie(coins, sw, sh, COTE_MAX);
    const droite = redresser(photo, coins, largeur, hauteur) ?? redresser(photo, PLEIN_CADRE, sw, sh) ?? photo;
    appliquerReglages(droite, base.reglages);
    const finale = pivoter(droite, base.rotation);

    const sortie = document.createElement('canvas');
    sortie.width = finale.width;
    sortie.height = finale.height;
    const sctx = sortie.getContext('2d');
    if (!sctx) throw new Error('Le navigateur ne sait pas dessiner l’image.');
    sctx.putImageData(new ImageData(new Uint8ClampedArray(finale.data), finale.width, finale.height), 0, 0);
    const blob = await this.versBlob(sortie, QUALITE_JPEG);
    return {
      ...base,
      coins,
      apercu: URL.createObjectURL(blob),
      largeur: finale.width,
      hauteur: finale.height,
      octets: new Uint8Array(await blob.arrayBuffer()),
    };
  }
}

/**
 * Le fichier scanné, en route vers le formulaire de dépôt.
 *
 * Le scanner est un écran à part ; le formulaire, lui, garde ce qu'on y a déjà
 * saisi. Le PDF passe de l'un à l'autre par ce relais plutôt que par l'URL.
 */
@Injectable({ providedIn: 'root' })
export class ScanTransfert {
  private fichier: File | null = null;

  deposer(f: File): void {
    this.fichier = f;
  }

  /** Rend le fichier en attente, une seule fois. */
  reprendre(): File | null {
    const f = this.fichier;
    this.fichier = null;
    return f;
  }
}
