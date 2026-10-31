import { Injectable, signal } from '@angular/core';
import { PageJpeg } from './pdf-assembleur';

/** Côté le plus long d'une page numérisée : assez pour lire un cours, assez léger pour le réseau. */
const COTE_MAX = 2000;
const QUALITE_JPEG = 0.82;

/** Une page prise ou importée, gardée en mémoire pour pouvoir la retourner ou la rééclaircir. */
export interface PageNumerisee {
  readonly id: number;
  /** L'image d'origine, une fois orientée : on repart d'elle à chaque retouche. */
  readonly source: ImageBitmap;
  /** Quarts de tour dans le sens horaire (0 à 3). */
  readonly rotation: number;
  /** Adresse d'aperçu (`blob:`), à libérer quand la page disparaît. */
  readonly apercu: string;
  readonly largeur: number;
  readonly hauteur: number;
  readonly octets: Uint8Array;
}

/**
 * Le scanner de documents de la PWA.
 *
 * L'application mobile passe par ML Kit (détection des bords, redressement).
 * Le navigateur n'en a pas l'équivalent : on prend donc la photo avec la
 * caméra du téléphone (`<input capture>`), puis on la **traite** ici - mise à
 * l'échelle, rotation, et un traitement « document » (niveaux de gris,
 * contraste relevé) qui rend un cahier photographié lisible et léger.
 */
@Injectable({ providedIn: 'root' })
export class Numerisation {
  private prochainId = 1;
  /** Le traitement « document » : actif par défaut, comme la détection de bords du mobile. */
  readonly ameliorer = signal(true);

  async creer(fichier: File): Promise<PageNumerisee> {
    // `from-image` applique l'orientation EXIF : sans elle, une photo prise en
    // portrait arrive couchée.
    const source = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    return this.rendre(this.prochainId++, source, 0);
  }

  /** Refait le rendu d'une page (rotation, traitement) à partir de son image d'origine. */
  async retoucher(page: PageNumerisee, rotation: number): Promise<PageNumerisee> {
    URL.revokeObjectURL(page.apercu);
    return this.rendre(page.id, page.source, ((rotation % 4) + 4) % 4);
  }

  /** Refait le rendu avec le réglage courant du traitement. */
  async retraiter(page: PageNumerisee): Promise<PageNumerisee> {
    return this.retoucher(page, page.rotation);
  }

  liberer(page: PageNumerisee): void {
    URL.revokeObjectURL(page.apercu);
    page.source.close();
  }

  versJpeg(page: PageNumerisee): PageJpeg {
    return { octets: page.octets, largeur: page.largeur, hauteur: page.hauteur };
  }

  private async rendre(id: number, source: ImageBitmap, rotation: number): Promise<PageNumerisee> {
    const echelle = Math.min(1, COTE_MAX / Math.max(source.width, source.height));
    const w = Math.round(source.width * echelle);
    const h = Math.round(source.height * echelle);
    const couche = rotation % 2 === 1;
    const canvas = document.createElement('canvas');
    canvas.width = couche ? h : w;
    canvas.height = couche ? w : h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Le navigateur ne sait pas dessiner l’image.');

    // Fond blanc : un JPEG n'a pas de transparence.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.ameliorer()) ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.08)';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 2);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);

    const blob = await new Promise<Blob>((ok, ko) =>
      canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Encodage de la page impossible.'))), 'image/jpeg', QUALITE_JPEG),
    );
    return {
      id,
      source,
      rotation,
      apercu: URL.createObjectURL(blob),
      largeur: canvas.width,
      hauteur: canvas.height,
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
