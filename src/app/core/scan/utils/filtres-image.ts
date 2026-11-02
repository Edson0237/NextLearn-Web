import { Pixels } from './geometrie';

/** Comment la page est rendue : en couleur, en niveaux de gris, ou en noir et blanc (texte net). */
export type ModeScan = 'couleur' | 'gris' | 'nb';

export interface Reglages {
  readonly mode: ModeScan;
  /** De -100 à 100. */
  readonly luminosite: number;
  /** De -100 à 100. */
  readonly contraste: number;
}

export const REGLAGES_PAR_DEFAUT: Reglages = { mode: 'gris', luminosite: 8, contraste: 35 };

const borner = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Applique le mode, la luminosité et le contraste. Modifie l'image sur place. */
export function appliquerReglages(img: Pixels, r: Reglages): void {
  const { data, width: w, height: h } = img;
  const facteur = (259 * (r.contraste + 255)) / (255 * (259 - r.contraste));
  const ajuste = (v: number): number => borner(facteur * (v - 128) + 128 + r.luminosite * 1.28);

  if (r.mode === 'couleur') {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = ajuste(data[i]);
      data[i + 1] = ajuste(data[i + 1]);
      data[i + 2] = ajuste(data[i + 2]);
    }
    return;
  }

  const gris = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gris[i] = ajuste(data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
  }

  if (r.mode === 'gris') {
    for (let i = 0; i < w * h; i++) data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = gris[i];
    return;
  }

  // Noir et blanc : seuil **local** (image intégrale), pour qu'une ombre sur un
  // coin de la page ne la noircisse pas.
  const largeurIntegrale = w + 1;
  const integrale = new Float64Array(largeurIntegrale * (h + 1));
  for (let y = 0; y < h; y++) {
    let ligne = 0;
    for (let x = 0; x < w; x++) {
      ligne += gris[y * w + x];
      integrale[(y + 1) * largeurIntegrale + x + 1] = integrale[y * largeurIntegrale + x + 1] + ligne;
    }
  }
  const demi = Math.max(8, Math.round(Math.min(w, h) / 16));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - demi);
    const y1 = Math.min(h - 1, y + demi);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - demi);
      const x1 = Math.min(w - 1, x + demi);
      const somme =
        integrale[(y1 + 1) * largeurIntegrale + x1 + 1] -
        integrale[y0 * largeurIntegrale + x1 + 1] -
        integrale[(y1 + 1) * largeurIntegrale + x0] +
        integrale[y0 * largeurIntegrale + x0];
      const moyenne = somme / ((x1 - x0 + 1) * (y1 - y0 + 1));
      const v = gris[y * w + x] < moyenne * 0.9 ? 0 : 255;
      const o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
    }
  }
}

/** Tourne une image de `quarts` quarts de tour horaires. Rend une nouvelle image. */
export function pivoter(img: Pixels, quarts: number): Pixels {
  const q = ((quarts % 4) + 4) % 4;
  if (q === 0) return img;
  const { width: w, height: h, data } = img;
  const largeur = q % 2 === 1 ? h : w;
  const hauteur = q % 2 === 1 ? w : h;
  const sortie = new Uint8ClampedArray(largeur * hauteur * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx: number;
      let ny: number;
      if (q === 1) { nx = h - 1 - y; ny = x; }
      else if (q === 2) { nx = w - 1 - x; ny = h - 1 - y; }
      else { nx = y; ny = w - 1 - x; }
      const s = (y * w + x) * 4;
      const d = (ny * largeur + nx) * 4;
      sortie[d] = data[s]; sortie[d + 1] = data[s + 1]; sortie[d + 2] = data[s + 2]; sortie[d + 3] = data[s + 3];
    }
  }
  return { data: sortie, width: largeur, height: hauteur };
}
