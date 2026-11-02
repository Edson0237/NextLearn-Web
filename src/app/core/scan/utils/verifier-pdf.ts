/**
 * Vérifie qu'un PDF produit par `assemblerPdf` est bien formé avant l'envoi :
 * en-tête, fin de fichier, table des références pointant exactement sur chaque
 * objet, et nombre de pages attendu.
 *
 * Ce n'est pas un lecteur de PDF : c'est le contrôle qui évite d'envoyer au
 * serveur un fichier tronqué ou corrompu, et dit pourquoi.
 */
export interface RapportPdf {
  readonly valide: boolean;
  readonly pages: number;
  readonly raison?: string;
}

export function verifierPdf(octets: Uint8Array, pagesAttendues: number): RapportPdf {
  const texte = new TextDecoder('latin1').decode(octets);
  const refus = (raison: string): RapportPdf => ({ valide: false, pages: 0, raison });

  if (!texte.startsWith('%PDF-')) return refus('en-tête absent');
  if (!texte.trimEnd().endsWith('%%EOF')) return refus('fin de fichier absente');

  const depart = /startxref\n(\d+)\n%%EOF\s*$/.exec(texte);
  if (!depart) return refus('table de références introuvable');
  const posXref = Number(depart[1]);
  if (texte.slice(posXref, posXref + 5) !== 'xref\n') return refus('table de références mal placée');

  const entrees = [...texte.slice(posXref).matchAll(/(\d{10}) \d{5} n /g)].map((m) => Number(m[1]));
  for (let i = 0; i < entrees.length; i++) {
    if (!new RegExp(`^${i + 1} 0 obj`).test(texte.slice(entrees[i], entrees[i] + 12))) {
      return refus(`objet ${i + 1} introuvable à sa position`);
    }
  }

  const pages = Number(/\/Type \/Pages [^>]*\/Count (\d+)/.exec(texte)?.[1] ?? 0);
  if (pages !== pagesAttendues) return refus(`${pages} page(s) au lieu de ${pagesAttendues}`);
  const reellesPages = (texte.match(/\/Type \/Page /g) ?? []).length;
  if (reellesPages !== pagesAttendues) return refus('pages manquantes');
  return { valide: true, pages };
}
