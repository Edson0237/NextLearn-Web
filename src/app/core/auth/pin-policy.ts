/**
 * Règle de choix d'un PIN, partagée par la création de compte et la
 * réinitialisation.
 *
 * Seul le format est contrôlé (4 chiffres). Le choix du code appartient à
 * l'utilisateur : « 1234 » ou « 0000 » sont acceptés. Une ancienne liste de
 * codes « trop courants » (suites, chiffres répétés) a été retirée.
 */
const LONGUEUR = 4;

/** `undefined` si le PIN est acceptable, sinon le motif de refus à afficher. */
export function validerPin(pin: string): string | undefined {
  if (pin.length !== LONGUEUR) return `Le PIN doit contenir ${LONGUEUR} chiffres.`;
  if (!/^\d+$/.test(pin)) return 'Le PIN ne doit contenir que des chiffres.';
  return undefined;
}
