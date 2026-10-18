/**
 * Règles de choix d'un PIN, partagées par la création de compte et la
 * réinitialisation — traduction de `lib/domains/auth/domain/pin_policy.dart`.
 *
 * Un PIN à 4 chiffres n'offre que 10 000 combinaisons : écarter les
 * quelques centaines essayées en premier change réellement la difficulté
 * d'une attaque, pour un coût nul côté utilisateur.
 */
const LONGUEUR = 4;

/** Codes les plus fréquemment relevés dans les fuites de PIN à 4 chiffres. */
const LISTE_NOIRE = new Set([
  '1234', '1111', '0000', '1212', '7777', '1004', '2000', '4444',
  '2222', '6969', '9999', '3333', '5555', '6666', '1122', '1313',
  '8888', '4321', '2001', '1010',
]);

function memeChiffreRepete(pin: string): boolean {
  return pin.split('').every((c) => c === pin[0]);
}

/** Suites croissantes (1234) comme décroissantes (4321), en tolérant le
 * passage 9→0 qui reste une suite pour qui la compose au clavier. */
function estSuite(pin: string): boolean {
  let croissant = true;
  let decroissant = true;
  for (let i = 1; i < pin.length; i++) {
    const prec = Number(pin[i - 1]);
    const courant = Number(pin[i]);
    if ((prec + 1) % 10 !== courant) croissant = false;
    if ((courant + 1) % 10 !== prec) decroissant = false;
  }
  return croissant || decroissant;
}

/** `undefined` si le PIN est acceptable, sinon le motif de refus à afficher. */
export function validerPin(pin: string): string | undefined {
  if (pin.length !== LONGUEUR) return `Le PIN doit contenir ${LONGUEUR} chiffres.`;
  if (!/^\d+$/.test(pin)) return 'Le PIN ne doit contenir que des chiffres.';
  if (LISTE_NOIRE.has(pin)) return 'Ce code est trop courant. Choisis-en un autre.';
  if (memeChiffreRepete(pin)) return 'Évite un code fait du même chiffre répété.';
  if (estSuite(pin)) return 'Évite une suite de chiffres qui se suivent.';
  return undefined;
}
