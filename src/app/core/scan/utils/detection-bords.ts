import { aire, Pixels, Point, Quad, quadValide } from './geometrie';

/** Définition à laquelle on cherche : assez fine pour les bords, assez petite pour tenir dans une image de caméra. */
export const COTE_DETECTION = 240;

/** Niveaux de gris (0 à 255) d'une image, légèrement flou pour ignorer le grain. */
function grises(img: Pixels): Uint8Array {
  const { data, width: w, height: h } = img;
  const brut = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    brut[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  }
  const flou = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += brut[yy * w + xx];
          n++;
        }
      }
      flou[y * w + x] = s / n;
    }
  }
  return flou;
}

/** Seuil d'Otsu : celui qui sépare le mieux deux populations de gris. */
export function seuilOtsu(gris: Uint8Array): number {
  const histo = new Array<number>(256).fill(0);
  for (const v of gris) histo[v]++;
  const total = gris.length;
  let somme = 0;
  for (let i = 0; i < 256; i++) somme += i * histo[i];
  let sommeFond = 0;
  let poidsFond = 0;
  let meilleur = 0;
  let seuil = 128;
  for (let t = 0; t < 256; t++) {
    poidsFond += histo[t];
    if (poidsFond === 0) continue;
    const poidsForme = total - poidsFond;
    if (poidsForme === 0) break;
    sommeFond += t * histo[t];
    const mFond = sommeFond / poidsFond;
    const mForme = (somme - sommeFond) / poidsForme;
    const variance = poidsFond * poidsForme * (mFond - mForme) ** 2;
    if (variance > meilleur) {
      meilleur = variance;
      seuil = t;
    }
  }
  return seuil;
}

/** La plus grande zone connexe du masque, et ses pixels de contour. */
function plusGrandeZone(masque: Uint8Array, w: number, h: number): { aire: number; contour: Point[] } | null {
  const vu = new Uint8Array(w * h);
  let meilleure: number[] = [];
  const pile: number[] = [];
  for (let depart = 0; depart < w * h; depart++) {
    if (!masque[depart] || vu[depart]) continue;
    const zone: number[] = [];
    pile.push(depart);
    vu[depart] = 1;
    while (pile.length > 0) {
      const p = pile.pop()!;
      zone.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && masque[p - 1] && !vu[p - 1]) { vu[p - 1] = 1; pile.push(p - 1); }
      if (x < w - 1 && masque[p + 1] && !vu[p + 1]) { vu[p + 1] = 1; pile.push(p + 1); }
      if (y > 0 && masque[p - w] && !vu[p - w]) { vu[p - w] = 1; pile.push(p - w); }
      if (y < h - 1 && masque[p + w] && !vu[p + w]) { vu[p + w] = 1; pile.push(p + w); }
    }
    if (zone.length > meilleure.length) meilleure = zone;
  }
  if (meilleure.length === 0) return null;
  // Contour : les pixels de la zone qui touchent un pixel hors zone ou le bord de l'image.
  const dedans = new Uint8Array(w * h);
  for (const p of meilleure) dedans[p] = 1;
  const contour: Point[] = [];
  for (const p of meilleure) {
    const x = p % w;
    const y = (p - x) / w;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !dedans[p - 1] || !dedans[p + 1] || !dedans[p - w] || !dedans[p + w]) {
      contour.push({ x, y });
    }
  }
  return { aire: meilleure.length, contour };
}

/** Enveloppe convexe (chaîne monotone d'Andrew). */
export function enveloppeConvexe(points: readonly Point[]): Point[] {
  const tries = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (tries.length < 3) return tries;
  const croix = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const bas: Point[] = [];
  for (const p of tries) {
    while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop();
    bas.push(p);
  }
  const haut: Point[] = [];
  for (const p of [...tries].reverse()) {
    while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop();
    haut.push(p);
  }
  return [...bas.slice(0, -1), ...haut.slice(0, -1)];
}

/** Les quatre coins d'une enveloppe : les extrêmes selon les deux diagonales. */
function quatreCoins(hull: readonly Point[]): [Point, Point, Point, Point] {
  const extreme = (score: (p: Point) => number): Point => hull.reduce((m, p) => (score(p) > score(m) ? p : m), hull[0]);
  return [
    extreme((p) => -(p.x + p.y)), // haut-gauche
    extreme((p) => p.x - p.y), // haut-droite
    extreme((p) => p.x + p.y), // bas-droite
    extreme((p) => p.y - p.x), // bas-gauche
  ];
}

/**
 * Cherche une page dans une photo : la plus grande zone claire (ou, à défaut,
 * sombre) qui a la forme d'un quadrilatère. Les coins sont rendus en
 * coordonnées normalisées.
 *
 * Volontairement simple et locale : pas de bibliothèque de vision à
 * télécharger, rien d'envoyé nulle part. Quand elle n'est pas sûre - fond
 * chargé, page qui touche le bord, peu de contraste - elle rend `null` et
 * l'écran propose le cadrage à la main, sans rien deviner.
 */
export function detecterCoins(img: Pixels): Quad | null {
  const { width: w, height: h } = img;
  if (w < 20 || h < 20) return null;
  const gris = grises(img);
  const seuil = seuilOtsu(gris);

  let meilleur: { quad: Quad; score: number } | null = null;
  for (const clair of [true, false]) {
    const masque = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) masque[i] = (clair ? gris[i] > seuil : gris[i] <= seuil) ? 1 : 0;
    const zone = plusGrandeZone(masque, w, h);
    if (!zone) continue;
    const fraction = zone.aire / (w * h);
    // Une page occupe une bonne part de l'image, mais pas tout : sinon c'est le fond.
    if (fraction < 0.15 || fraction > 0.92) continue;

    const hull = enveloppeConvexe(zone.contour);
    if (hull.length < 4) continue;
    const coins = quatreCoins(hull);
    const quad = coins.map((p) => ({ x: p.x / (w - 1), y: p.y / (h - 1) })) as unknown as Quad;
    if (!quadValide(quad, 0.12)) continue;

    // La zone doit épouser son quadrilatère : une forme en L ou un fond chargé n'est pas une page.
    const remplissage = zone.aire / (w * h) / aire(quad);
    if (remplissage < 0.85 || remplissage > 1.15) continue;

    const score = remplissage > 1 ? 1 / remplissage : remplissage;
    if (!meilleur || score > meilleur.score) meilleur = { quad, score };
  }
  return meilleur?.quad ?? null;
}
