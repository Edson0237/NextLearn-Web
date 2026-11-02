/**
 * La géométrie du redressement : quatre coins repérés sur la photo, et la
 * transformation qui les ramène à un rectangle.
 *
 * Tout est en coordonnées **normalisées** (0 à 1 sur chaque axe) : les coins
 * restent valables quelle que soit la définition à laquelle on travaille, et se
 * rangent tels quels avec la page.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Haut-gauche, haut-droite, bas-droite, bas-gauche. */
export type Quad = readonly [Point, Point, Point, Point];

export const PLEIN_CADRE: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Image brute : le strict nécessaire de `ImageData`, pour rester testable hors navigateur. */
export interface Pixels {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * La taille du rectangle de sortie, d'après les côtés du quadrilatère en
 * pixels de la source : le plus long de chaque paire de côtés opposés, pour ne
 * rien écraser.
 */
export function tailleSortie(quad: Quad, largeurSource: number, hauteurSource: number, coteMax: number): { largeur: number; hauteur: number } {
  const px = (p: Point): Point => ({ x: p.x * largeurSource, y: p.y * hauteurSource });
  const [a, b, c, d] = quad.map(px) as [Point, Point, Point, Point];
  let largeur = Math.max(distance(a, b), distance(d, c));
  let hauteur = Math.max(distance(a, d), distance(b, c));
  const echelle = Math.min(1, coteMax / Math.max(largeur, hauteur, 1));
  largeur = Math.max(1, Math.round(largeur * echelle));
  hauteur = Math.max(1, Math.round(hauteur * echelle));
  return { largeur, hauteur };
}

/**
 * Résout A·x = b par élimination de Gauss avec pivot partiel.
 * Rend `null` si le système est singulier (quatre coins alignés, par exemple).
 */
function resoudre(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((ligne, i) => [...ligne, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-10) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let k = col; k <= n; k++) m[r][k] -= f * m[col][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let k = r + 1; k < n; k++) s -= m[r][k] * x[k];
    x[r] = s / m[r][r];
  }
  return x;
}

/** Les huit coefficients de l'homographie qui envoie `depuis[i]` sur `vers[i]`. */
export function homographie(depuis: Quad, vers: Quad): number[] | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = depuis[i];
    const { x: u, y: v } = vers[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return resoudre(a, b);
}

/**
 * Redresse la photo : chaque pixel du rectangle de sortie va chercher sa
 * couleur dans le quadrilatère de la source, par interpolation bilinéaire.
 * Rend `null` si les quatre coins sont dégénérés.
 */
export function redresser(source: Pixels, quad: Quad, largeur: number, hauteur: number): Pixels | null {
  // On calcule la transformation inverse (sortie -> source) : c'est elle qu'on évalue.
  const sortie: Quad = [
    { x: 0, y: 0 },
    { x: largeur, y: 0 },
    { x: largeur, y: hauteur },
    { x: 0, y: hauteur },
  ];
  const enPixels = quad.map((p) => ({ x: p.x * source.width, y: p.y * source.height })) as unknown as Quad;
  const h = homographie(sortie, enPixels);
  if (!h) return null;

  const data = new Uint8ClampedArray(largeur * hauteur * 4);
  const sw = source.width;
  const sh = source.height;
  const s = source.data;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const w = h[6] * x + h[7] * y + 1;
      const sx = (h[0] * x + h[1] * y + h[2]) / w;
      const sy = (h[3] * x + h[4] * y + h[5]) / w;
      const o = (y * largeur + x) * 4;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        // Hors de la photo : blanc, comme une marge de papier.
        data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        data[o + c] =
          s[i00 + c] * (1 - fx) * (1 - fy) + s[i10 + c] * fx * (1 - fy) + s[i01 + c] * (1 - fx) * fy + s[i11 + c] * fx * fy;
      }
      data[o + 3] = 255;
    }
  }
  return { data, width: largeur, height: hauteur };
}

/** Le quadrilatère est-il exploitable : convexe, d'aire suffisante, dans la photo ? */
export function quadValide(quad: Quad, aireMinimale = 0.05): boolean {
  if (quad.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < -0.01 || p.x > 1.01 || p.y < -0.01 || p.y > 1.01)) {
    return false;
  }
  let signe = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const vecteur = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(vecteur) < 1e-9) return false;
    const s = Math.sign(vecteur);
    if (signe !== 0 && s !== signe) return false;
    signe = s;
  }
  return aire(quad) >= aireMinimale;
}

export function aire(quad: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % quad.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
