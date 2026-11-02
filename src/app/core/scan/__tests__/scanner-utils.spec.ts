import { describe, expect, it } from 'vitest';
import { assemblerPdf } from '../utils/pdf-assembleur';
import { detecterCoins } from '../utils/detection-bords';
import { PLEIN_CADRE, Pixels, Point, Quad, quadValide, redresser, tailleSortie } from '../utils/geometrie';
import { appliquerReglages, pivoter } from '../utils/filtres-image';
import { verifierPdf } from '../utils/verifier-pdf';

/** Une photo synthétique : fond sombre, page claire (quadrilatère) avec quelques lignes de « texte ». */
function photo(w: number, h: number, page: Quad | null, fond = 50, clair = 230): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  const dedans = (px: number, py: number): boolean => {
    if (!page) return false;
    const p = page.map((c) => ({ x: c.x * w, y: c.y * h }));
    let signe = 0;
    for (let i = 0; i < 4; i++) {
      const a = p[i];
      const b = p[(i + 1) % 4];
      const v = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
      if (v === 0) continue;
      if (signe === 0) signe = Math.sign(v);
      else if (Math.sign(v) !== signe) return false;
    }
    return true;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let v = dedans(x, y) ? clair : fond;
      if (v === clair && y % 14 < 2 && x % 40 < 28) v = 40; // du « texte »
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const proche = (a: Point, b: Point, tol = 0.05): boolean => Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol;

describe('détection des bords', () => {
  const page: Quad = [{ x: 0.15, y: 0.1 }, { x: 0.85, y: 0.14 }, { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.86 }];

  it('retrouve les quatre coins d’une page posée sur un fond sombre', () => {
    const coins = detecterCoins(photo(240, 320, page));
    expect(coins).not.toBeNull();
    coins!.forEach((c, i) => expect(proche(c, page[i])).toBe(true));
  });

  it('retrouve aussi une page sombre sur un fond clair', () => {
    const coins = detecterCoins(photo(240, 320, page, 235, 60));
    expect(coins).not.toBeNull();
  });

  it('ne devine rien sur une image sans page : null, donc cadrage à la main', () => {
    expect(detecterCoins(photo(240, 320, null))).toBeNull();
  });

  it('refuse une page minuscule perdue dans l’image', () => {
    const minuscule: Quad = [{ x: 0.45, y: 0.45 }, { x: 0.55, y: 0.45 }, { x: 0.55, y: 0.55 }, { x: 0.45, y: 0.55 }];
    expect(detecterCoins(photo(240, 320, minuscule))).toBeNull();
  });
});

describe('redressement de perspective', () => {
  it('ramène la page à un rectangle plein, sans le fond', () => {
    const page: Quad = [{ x: 0.15, y: 0.1 }, { x: 0.85, y: 0.14 }, { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.86 }];
    const src = photo(240, 320, page);
    const { largeur, hauteur } = tailleSortie(page, 240, 320, 2000);
    const sortie = redresser(src, page, largeur, hauteur)!;
    expect(sortie).not.toBeNull();
    // Au centre : la page. Près des coins : toujours la page (on a coupé le fond), pas le fond sombre.
    const lum = (x: number, y: number) => sortie.data[(Math.round(y) * sortie.width + Math.round(x)) * 4];
    const marge = 6;
    for (const [x, y] of [[marge, marge], [sortie.width - marge, marge], [sortie.width - marge, sortie.height - marge], [marge, sortie.height - marge]]) {
      expect(lum(x, y)).toBeGreaterThan(150);
    }
  });

  it('plein cadre : l’image ressort à l’identique', () => {
    const src = photo(60, 80, null, 123, 123);
    const sortie = redresser(src, PLEIN_CADRE, 58, 78)!;
    expect(sortie.data[(40 * 58 + 30) * 4]).toBeGreaterThan(110);
    expect(sortie.data[(40 * 58 + 30) * 4]).toBeLessThan(130);
  });

  it('rend null pour des coins alignés', () => {
    const plat: Quad = [{ x: 0, y: 0 }, { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.6 }, { x: 1, y: 1 }];
    expect(redresser(photo(40, 40, null), plat, 20, 20)).toBeNull();
    expect(quadValide(plat)).toBe(false);
  });

  it('valide un quadrilatère convexe, refuse un papillon', () => {
    expect(quadValide(PLEIN_CADRE)).toBe(true);
    const papillon: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(quadValide(papillon)).toBe(false);
  });
});

describe('réglages de lisibilité et rotation', () => {
  const gris = (v: number): Pixels => ({ data: new Uint8ClampedArray([v, v, v, 255, v, v, v, 255]), width: 2, height: 1 });

  it('niveaux de gris : les trois canaux s’égalisent', () => {
    const img: Pixels = { data: new Uint8ClampedArray([200, 100, 50, 255]), width: 1, height: 1 };
    appliquerReglages(img, { mode: 'gris', luminosite: 0, contraste: 0 });
    expect(img.data[0]).toBe(img.data[1]);
    expect(img.data[1]).toBe(img.data[2]);
  });

  it('la luminosité éclaircit, sans dépasser 255', () => {
    const img = gris(200);
    appliquerReglages(img, { mode: 'couleur', luminosite: 100, contraste: 0 });
    expect(img.data[0]).toBe(255);
    const sombre = gris(40);
    appliquerReglages(sombre, { mode: 'couleur', luminosite: 30, contraste: 0 });
    expect(sombre.data[0]).toBeGreaterThan(40);
  });

  it('noir et blanc : seulement 0 ou 255, le texte reste noir malgré une ombre', () => {
    const w = 64;
    const h = 64;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const ombre = x < 32 ? 120 : 220; // moitié gauche dans l'ombre
      const v = y === 32 ? ombre - 70 : ombre; // une ligne de texte
      data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
    }
    const img: Pixels = { data, width: w, height: h };
    appliquerReglages(img, { mode: 'nb', luminosite: 0, contraste: 0 });
    const lum = (x: number, y: number) => img.data[(y * w + x) * 4];
    expect(new Set([lum(5, 5), lum(5, 32), lum(50, 5), lum(50, 32)])).toEqual(new Set([0, 255]));
    expect(lum(5, 5)).toBe(255); // le papier dans l'ombre reste blanc
    expect(lum(5, 32)).toBe(0); // le texte dans l'ombre reste noir
  });

  it('pivoter : un quart de tour horaire échange largeur et hauteur', () => {
    const img: Pixels = { data: new Uint8ClampedArray([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255]), width: 3, height: 2 };
    const r = pivoter(img, 1);
    expect([r.width, r.height]).toEqual([2, 3]);
    expect(Array.from({ length: 6 }, (_, i) => r.data[i * 4])).toEqual([4, 1, 5, 2, 6, 3]);
    expect(pivoter(pivoter(img, 2), 2).data).toEqual(img.data);
  });
});

describe('vérification du PDF', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const page = { octets: jpeg, largeur: 100, hauteur: 140 };

  it('accepte un PDF assemblé, avec le bon nombre de pages', () => {
    expect(verifierPdf(assemblerPdf([page, page, page]), 3)).toEqual({ valide: true, pages: 3 });
  });

  it('refuse un PDF tronqué', () => {
    const pdf = assemblerPdf([page, page]);
    expect(verifierPdf(pdf.slice(0, pdf.length - 40), 2).valide).toBe(false);
  });

  it('refuse un PDF dont les références sont décalées', () => {
    const pdf = assemblerPdf([page]);
    const texte = new TextDecoder('latin1').decode(pdf).replace('1 0 obj', '1 0 obj ');
    const decale = Uint8Array.from(texte, (c) => c.charCodeAt(0));
    expect(verifierPdf(decale, 1).valide).toBe(false);
  });

  it('refuse un nombre de pages inattendu', () => {
    expect(verifierPdf(assemblerPdf([page]), 2).valide).toBe(false);
  });

  it('refuse un fichier qui n’est pas un PDF', () => {
    expect(verifierPdf(new TextEncoder().encode('<html></html>'), 1).valide).toBe(false);
  });
});
