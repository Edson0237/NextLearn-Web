import { Environnement, Navigateur, Systeme } from './environnement';

/**
 * Les procédures d'installation réellement distinctes. Plusieurs environnements
 * partagent la même : un Chrome sous Windows et sous Linux s'installent par le
 * même geste, un Firefox sur iPhone s'installe comme Safari.
 */
export type CasInstallation =
  | 'android-chrome'
  | 'android-samsung'
  | 'android-firefox'
  | 'android-edge'
  | 'android-autre'
  | 'ios-safari'
  | 'ios-autre'
  | 'ios-integre'
  | 'ordi-chromium'
  | 'ordi-edge'
  | 'ordi-safari'
  | 'ordi-firefox'
  | 'inconnu';

const estIos = (s: Systeme): boolean => s === 'ios' || s === 'ipados';
const estOrdinateur = (s: Systeme): boolean =>
  s === 'windows' || s === 'macos' || s === 'linux' || s === 'chromeos';

export function casInstallation({ systeme, navigateur }: Pick<Environnement, 'systeme' | 'navigateur'>): CasInstallation {
  if (systeme === 'android') {
    switch (navigateur) {
      case 'chrome': case 'chromium': return 'android-chrome';
      case 'samsung': return 'android-samsung';
      case 'firefox': return 'android-firefox';
      case 'edge': return 'android-edge';
      default: return 'android-autre';
    }
  }

  if (estIos(systeme)) {
    if (navigateur === 'safari') return 'ios-safari';
    // Une vue intégrée (Instagram, Facebook, Messenger…) ne propose pas
    // « Sur l'écran d'accueil » : il faut rouvrir la page dans Safari.
    if (navigateur === 'inconnu') return 'ios-integre';
    return 'ios-autre';
  }

  if (estOrdinateur(systeme)) {
    switch (navigateur) {
      case 'chrome': case 'chromium': case 'opera': return 'ordi-chromium';
      case 'edge': return 'ordi-edge';
      case 'safari': return systeme === 'macos' ? 'ordi-safari' : 'inconnu';
      case 'firefox': return 'ordi-firefox';
      default: return 'inconnu';
    }
  }

  return 'inconnu';
}

/** Navigateurs que le sélecteur manuel propose pour un système donné. */
export function navigateursProposes(systeme: Systeme): readonly Navigateur[] {
  switch (systeme) {
    case 'android': return ['chrome', 'samsung', 'firefox', 'edge', 'inconnu'];
    case 'ios': case 'ipados': return ['safari', 'chrome', 'edge', 'firefox', 'inconnu'];
    case 'macos': return ['safari', 'chrome', 'edge', 'firefox', 'inconnu'];
    case 'windows': case 'linux': case 'chromeos': return ['chrome', 'edge', 'firefox', 'inconnu'];
    default: return ['inconnu'];
  }
}
