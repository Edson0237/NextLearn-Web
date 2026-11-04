/**
 * Détection du format de document (PDF ou DOCX)
 *
 * Combine plusieurs sources d'information ordonnées par fiabilité :
 * 1. Signature binaire (magic numbers) : 100% fiable, insensible au renommage ou aux URL signées.
 * 2. Type MIME HTTP (Content-Type).
 * 3. Extension de fichier dans l'URL ou le chemin.
 */

export type FormatDocument = 'pdf' | 'docx' | 'inconnu';

/**
 * Signature magique des fichiers PDF : `%PDF-` (0x25 0x50 0x44 0x46)
 */
const SIGNATURE_PDF = [0x25, 0x50, 0x44, 0x46];

/**
 * Signature magique des archives ZIP (incluant DOCX OpenXML) : `PK\x03\x04` (0x50 0x4b 0x03 0x04)
 */
const SIGNATURE_ZIP_DOCX = [0x50, 0x4b, 0x03, 0x04];

/**
 * Détecte le format à partir des premiers octets du fichier.
 */
export function detecterFormatParEntete(entete: Uint8Array | ArrayBuffer): FormatDocument {
  const vue = entete instanceof Uint8Array ? entete : new Uint8Array(entete);
  if (vue.length < 4) return 'inconnu';

  if (
    vue[0] === SIGNATURE_PDF[0] &&
    vue[1] === SIGNATURE_PDF[1] &&
    vue[2] === SIGNATURE_PDF[2] &&
    vue[3] === SIGNATURE_PDF[3]
  ) {
    return 'pdf';
  }

  if (
    vue[0] === SIGNATURE_ZIP_DOCX[0] &&
    vue[1] === SIGNATURE_ZIP_DOCX[1] &&
    vue[2] === SIGNATURE_ZIP_DOCX[2] &&
    vue[3] === SIGNATURE_ZIP_DOCX[3]
  ) {
    return 'docx';
  }

  return 'inconnu';
}

/**
 * Détecte le format à partir d'un type MIME.
 */
export function detecterFormatParMime(mime?: string | null): FormatDocument {
  if (!mime) return 'inconnu';
  const nettoye = mime.trim().toLowerCase();

  if (nettoye.includes('application/pdf')) {
    return 'pdf';
  }

  if (
    nettoye.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    nettoye.includes('application/docx') ||
    nettoye.includes('application/msword')
  ) {
    return 'docx';
  }

  return 'inconnu';
}

/**
 * Détecte le format à partir d'une URL ou d'un nom de fichier.
 * Ignore la chaîne de requête (?token=...) et le fragment (#...).
 */
export function detecterFormatParUrl(url?: string | null): FormatDocument {
  if (!url) return 'inconnu';

  try {
    // Si c'est une URL absolue valide
    const sansParams = url.split(/[?#]/)[0] ?? '';
    const extension = sansParams.split('.').pop()?.toLowerCase();

    if (extension === 'docx' || extension === 'doc') {
      return 'docx';
    }
    if (extension === 'pdf') {
      return 'pdf';
    }
  } catch {
    // Si l'analyse échoue, repli simple
    const sansParams = url.split(/[?#]/)[0] ?? '';
    if (/\.docx$/i.test(sansParams) || /\.doc$/i.test(sansParams)) return 'docx';
    if (/\.pdf$/i.test(sansParams)) return 'pdf';
  }

  return 'inconnu';
}

/**
 * Résout le format final en évaluant l'en-tête binaire, le MIME et l'URL.
 * Repli sur 'pdf' si aucune indication ne permet de décider.
 */
export function detecterFormatDocument(options: {
  url?: string | null;
  typeMime?: string | null;
  octets?: Uint8Array | ArrayBuffer | null;
  repliParDefaut?: 'pdf' | 'docx';
}): 'pdf' | 'docx' {
  if (options.octets) {
    const formatBinaire = detecterFormatParEntete(options.octets);
    if (formatBinaire !== 'inconnu') return formatBinaire;
  }

  if (options.typeMime) {
    const formatMime = detecterFormatParMime(options.typeMime);
    if (formatMime !== 'inconnu') return formatMime;
  }

  if (options.url) {
    const formatUrl = detecterFormatParUrl(options.url);
    if (formatUrl !== 'inconnu') return formatUrl;
  }

  return options.repliParDefaut ?? 'pdf';
}
