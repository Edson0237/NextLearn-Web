/**
 * Réunit des pages JPEG en un seul PDF, sans bibliothèque.
 *
 * Un PDF accepte un JPEG tel quel (filtre `DCTDecode`) : il suffit de l'ajouter
 * en objet image, de le dessiner en pleine page, et d'écrire la table des
 * références. Pas de ré-encodage, donc pas de perte, et pas de dépendance de
 * 300 Ko pour ce qui tient en une soixantaine de lignes.
 *
 * Même principe que le scanner de l'application mobile : une page par image,
 * au format exact de l'image (`ScannerService._assemblerEnPdf`).
 */
export interface PageJpeg {
  readonly octets: Uint8Array;
  readonly largeur: number;
  readonly hauteur: number;
}

const enc = new TextEncoder();

export function assemblerPdf(pages: readonly PageJpeg[]): Uint8Array {
  if (pages.length === 0) throw new Error('Aucune page à assembler.');

  const morceaux: Uint8Array[] = [];
  const positions: number[] = []; // position (octet) de chaque objet numéroté, à partir de 1
  let longueur = 0;
  const ecrire = (m: Uint8Array | string): void => {
    const b = typeof m === 'string' ? enc.encode(m) : m;
    morceaux.push(b);
    longueur += b.length;
  };
  const objet = (numero: number, contenu: () => void): void => {
    positions[numero] = longueur;
    ecrire(`${numero} 0 obj\n`);
    contenu();
    ecrire('\nendobj\n');
  };

  // Numérotation : 1 = catalogue, 2 = liste des pages, puis (page, contenu, image) × n.
  const numPage = (i: number): number => 3 + i * 3;

  ecrire('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objet(1, () => ecrire('<< /Type /Catalog /Pages 2 0 R >>'));
  objet(2, () => {
    const kids = pages.map((_, i) => `${numPage(i)} 0 R`).join(' ');
    ecrire(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  });

  pages.forEach((p, i) => {
    const n = numPage(i);
    objet(n, () =>
      ecrire(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.largeur} ${p.hauteur}] ` +
          `/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`,
      ),
    );
    const dessin = `q ${p.largeur} 0 0 ${p.hauteur} 0 0 cm /Im0 Do Q`;
    objet(n + 1, () => ecrire(`<< /Length ${dessin.length} >>\nstream\n${dessin}\nendstream`));
    objet(n + 2, () => {
      ecrire(
        `<< /Type /XObject /Subtype /Image /Width ${p.largeur} /Height ${p.hauteur} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.octets.length} >>\nstream\n`,
      );
      ecrire(p.octets);
      ecrire('\nendstream');
    });
  });

  const total = numPage(pages.length - 1) + 3; // nombre d'objets + 1
  const debutXref = longueur;
  ecrire(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) ecrire(`${String(positions[n]).padStart(10, '0')} 00000 n \n`);
  ecrire(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`);

  const pdf = new Uint8Array(longueur);
  let curseur = 0;
  for (const m of morceaux) {
    pdf.set(m, curseur);
    curseur += m.length;
  }
  return pdf;
}
