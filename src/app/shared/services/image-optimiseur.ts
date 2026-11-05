/**
 * Utilitaire d'optimisation et compression d'images et documents côté client.
 *
 * Résout les contraintes clés :
 * 1. Formats propriétaires iOS (HEIC / HEIF) convertis en JPEG universel.
 * 2. Plafond Vercel Serverless / Proxy (4,5 Mo max) : compression sous 1 Mo pour les justificatifs,
 *    et sous 100 Ko pour les avatars.
 * 3. Normalisation des fichiers PDF (MIME 'application/pdf' garanti sur iOS Safari et nom sain).
 */

export interface OptionsCompression {
  readonly maxDimension?: number;
  readonly qualite?: number;
  readonly carre?: boolean;
}

/**
 * Normalise un justificatif pour la vérification académique.
 * - Les PDF sont vérifiés en taille (<= 4.5 Mo) et leur type MIME est garanti 'application/pdf'.
 * - Les photos (JPG, PNG, HEIC, HEIF) sont redimensionnées (max 1920px) et compressées en JPEG haute qualité.
 */
export async function optimiserJustificatif(file: File): Promise<File> {
  const nomMinuscule = file.name.toLowerCase();
  const estPdf = file.type === 'application/pdf' ||
    file.type === 'application/x-pdf' ||
    nomMinuscule.endsWith('.pdf');

  if (estPdf) {
    if (file.size > 4.5 * 1024 * 1024) {
      throw new Error('Ce document PDF dépasse 4,5 Mo. Utilise un PDF plus léger ou prends-le en photo.');
    }
    // Nettoyer les caractères spéciaux du nom (&, espaces, etc.) qui perturbent les entêtes HTTP
    const base = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.pdf$/i, '');
    const nomFinal = `${base || 'justificatif'}.pdf`;
    try {
      return new File([file], nomFinal, { type: 'application/pdf' });
    } catch {
      return file;
    }
  }

  // C'est une image : compression et conversion en JPEG universel
  return compresserImage(file, {
    maxDimension: 1920,
    qualite: 0.85,
    carre: false,
  });
}

/**
 * Optimise une photo de profil avant téléversement vers Cloudinary.
 * - Recadre en carré centré si nécessaire.
 * - Réduit à 512x512 pixels maximum (taille idéale pour un avatar Retina).
 * - Compresse en JPEG à 85% (~40 à 80 Ko au lieu de 5 Mo).
 */
export async function optimiserAvatar(file: File): Promise<File> {
  return compresserImage(file, {
    maxDimension: 512,
    qualite: 0.85,
    carre: true,
  });
}

/**
 * Compresse une image via Canvas et rend un objet File standard JPEG.
 * Si l'environnement ne supporte pas Canvas (ex: SSR / tests jsdom), rend le fichier d'origine.
 */
export async function compresserImage(file: File, options: OptionsCompression = {}): Promise<File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  // Si le contexte Canvas 2D n'est pas disponible (ex: environnement de test jsdom)
  const testCanvas = document.createElement('canvas');
  if (!testCanvas.getContext || !testCanvas.getContext('2d')) {
    return file;
  }

  const maxDim = options.maxDimension ?? 1920;
  const qualite = options.qualite ?? 0.85;
  const carre = options.carre ?? false;

  try {
    let width = 0;
    let height = 0;
    let sourceImage: CanvasImageSource | null = null;
    let bmp: ImageBitmap | null = null;
    let objectUrl: string | null = null;

    if (typeof createImageBitmap === 'function') {
      try {
        bmp = await createImageBitmap(file);
        width = bmp.width;
        height = bmp.height;
        sourceImage = bmp;
      } catch {
        bmp = null;
      }
    }

    if (!sourceImage) {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Délai dépassé')), 3000);
        img.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Format image non pris en charge'));
        };
        img.src = objectUrl!;
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      sourceImage = img;
    }

    if (!width || !height) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (bmp) bmp.close();
      return file;
    }

    let srcX = 0;
    let srcY = 0;
    let srcW = width;
    let srcH = height;
    let destW = width;
    let destH = height;

    if (carre) {
      // Recadrage centré en carré
      const minDimension = Math.min(width, height);
      srcX = Math.round((width - minDimension) / 2);
      srcY = Math.round((height - minDimension) / 2);
      srcW = minDimension;
      srcH = minDimension;
      destW = Math.min(minDimension, maxDim);
      destH = destW;
    } else {
      // Redimensionnement proportionnel
      if (destW > maxDim || destH > maxDim) {
        if (destW > destH) {
          destH = Math.round((destH * maxDim) / destW);
          destW = maxDim;
        } else {
          destW = Math.round((destW * maxDim) / destH);
          destH = maxDim;
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (bmp) bmp.close();
      return file;
    }

    // Fond blanc pour éviter la transparence noire des PNG convertis en JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, destW, destH);
    ctx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, destW, destH);

    if (bmp) bmp.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', qualite);
    });

    if (!blob) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomFinal = `${baseName || (carre ? 'avatar' : 'image')}.jpg`;
    return new File([blob], nomFinal, { type: 'image/jpeg' });
  } catch {
    // Repli sûr en cas d'erreur de décodage
    return file;
  }
}
