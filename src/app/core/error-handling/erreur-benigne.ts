/**
 * Distingue une erreur qui casse l'écran d'une erreur qui n'est que le bruit
 * normal d'un navigateur : requête interrompue, onglet mis en arrière-plan.
 *
 * `provideBrowserGlobalErrorListeners` envoie à `ErrorHandler` *toute* promesse
 * rejetée et toute erreur de la fenêtre, et `AppErrorHandler` remplaçait alors
 * la page entière par « Quelque chose s'est mal passé ». Or, sur Safari
 * surtout, ouvrir la feuille Partager (le geste d'installation sur iPhone et
 * iPad), changer d'onglet ou verrouiller l'écran suspend la page et fait
 * échouer les requêtes en cours (`TypeError: Load failed`, `AbortError`). Rien
 * n'est cassé - l'application continue de fonctionner - mais l'utilisateur
 * voyait un écran d'erreur par-dessus.
 *
 * On ne masque que ce qui est connu pour être sans conséquence ; une erreur
 * inconnue reste fatale, et la console garde tout dans les deux cas.
 */

const MESSAGES_RESEAU =
  /load failed|failed to fetch|networkerror|network request failed|network connection was lost|operation was aborted|request (was )?aborted|the user aborted|cancelled|resizeobserver loop|service ?worker/i;

/** Un module de code qui ne se charge pas n'est pas du bruit : l'écran en dépend. */
const MODULE_PERDU = /dynamically imported module|importing a module script|chunk/i;

export function estErreurBenigne(erreur: unknown, pageVisible: boolean): boolean {
  // Page en arrière-plan ou à peine revenue : ce qui échoue maintenant est
  // surtout une requête coupée par la suspension.
  if (!pageVisible) return true;

  const nom = nomDe(erreur);
  const message = messageDe(erreur);

  if (MODULE_PERDU.test(message)) return false;
  if (nom === 'AbortError' || nom === 'NetworkError') return true;
  // `HttpErrorResponse` avec statut 0 : le réseau n'a pas répondu.
  if (nom === 'HttpErrorResponse' && (erreur as { status?: number }).status === 0) return true;
  return MESSAGES_RESEAU.test(message);
}

function nomDe(erreur: unknown): string {
  return typeof erreur === 'object' && erreur !== null && 'name' in erreur
    ? String((erreur as { name: unknown }).name)
    : '';
}

function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) return erreur.message;
  if (typeof erreur === 'string') return erreur;
  if (typeof erreur === 'object' && erreur !== null && 'message' in erreur) {
    return String((erreur as { message: unknown }).message);
  }
  return '';
}
