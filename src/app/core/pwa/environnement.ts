/**
 * Détection de l'appareil, du système et du navigateur, pour choisir le bon
 * guide d'installation.
 *
 * Aucune de ces sources n'est fiable à elle seule : le `userAgent` est gelé ou
 * réduit par les navigateurs récents, `navigator.platform` est déprécié, et
 * iPadOS se fait passer pour un Mac. La détection croise donc le `userAgent`,
 * les Client Hints (`navigator.userAgentData`, quand ils existent) et le nombre
 * de points tactiles, et elle rend `'inconnu'` plutôt que de deviner. Le
 * guide prévoit une voie de secours pour ce cas, et l'utilisateur peut
 * corriger la détection à la main.
 *
 * Ce fichier ne touche à aucune API du navigateur : il reçoit ses sources en
 * paramètre, ce qui le rend testable sans simuler un navigateur.
 */

export type Appareil = 'telephone' | 'tablette' | 'ordinateur' | 'inconnu';
export type Systeme = 'android' | 'ios' | 'ipados' | 'windows' | 'macos' | 'linux' | 'chromeos' | 'inconnu';
export type Navigateur = 'chrome' | 'edge' | 'safari' | 'firefox' | 'samsung' | 'opera' | 'chromium' | 'inconnu';

export interface Environnement {
  readonly appareil: Appareil;
  readonly systeme: Systeme;
  readonly navigateur: Navigateur;
}

/** Ce que l'on sait lire du navigateur, sans l'avoir interrogé ici. */
export interface SourcesEnvironnement {
  readonly userAgent: string;
  /** `navigator.platform` : déprécié, utilisé seulement en renfort. */
  readonly platform?: string;
  readonly maxTouchPoints?: number;
  /** Client Hints de bas niveau (Chromium uniquement). */
  readonly uaData?: {
    readonly platform?: string;
    readonly mobile?: boolean;
    readonly brands?: readonly { readonly brand: string }[];
  };
}

export type ModeAffichage = 'autonome' | 'navigateur';

export function detecterEnvironnement(s: SourcesEnvironnement): Environnement {
  const ua = s.userAgent ?? '';
  const systeme = detecterSysteme(s, ua);
  return {
    systeme,
    appareil: detecterAppareil(s, ua, systeme),
    navigateur: detecterNavigateur(s, ua),
  };
}

function detecterSysteme(s: SourcesEnvironnement, ua: string): Systeme {
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/iPad/.test(ua)) return 'ipados';
  // iPadOS 13+ envoie un userAgent de Mac. Un vrai Mac n'a pas d'écran
  // tactile : plus d'un point de contact trahit l'iPad.
  if (/Macintosh/.test(ua) && (s.maxTouchPoints ?? 0) > 1) return 'ipados';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos';
  if (/Linux|X11/.test(ua)) return 'linux';

  // Dernier recours : les Client Hints, quand le userAgent est vide ou réduit.
  switch (s.uaData?.platform) {
    case 'Android': return 'android';
    case 'Windows': return 'windows';
    case 'macOS': return 'macos';
    case 'Chrome OS': case 'ChromeOS': return 'chromeos';
    case 'Linux': return 'linux';
    default: return 'inconnu';
  }
}

function detecterAppareil(s: SourcesEnvironnement, ua: string, systeme: Systeme): Appareil {
  switch (systeme) {
    case 'ios': return 'telephone';
    case 'ipados': return 'tablette';
    case 'android':
      // Les téléphones Android portent « Mobile » ; les tablettes l'omettent.
      if (s.uaData?.mobile === true) return 'telephone';
      if (s.uaData?.mobile === false && !/Mobile/.test(ua)) return 'tablette';
      return /Mobile/.test(ua) ? 'telephone' : 'tablette';
    case 'windows': case 'macos': case 'linux': case 'chromeos':
      return 'ordinateur';
    default:
      return 'inconnu';
  }
}

function detecterNavigateur(s: SourcesEnvironnement, ua: string): Navigateur {
  // Sur iOS tous les navigateurs sont bâtis sur WebKit mais se signalent par
  // leur propre jeton (CriOS, FxiOS, EdgiOS) ; l'ordre ci-dessous compte, car
  // presque tous contiennent aussi « Safari » ou « Chrome ».
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'edge';
  if (/OPR\/|OPT\/|Opera/.test(ua)) return 'opera';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  // Vues web intégrées (« ; wv) » sur Android, applications sur iOS) : ce
  // ne sont pas des navigateurs, on ne prétend pas en reconnaître un.
  if (/; wv\)|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/.test(ua)) return 'inconnu';
  if (/CriOS/.test(ua)) return 'chrome';
  if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) {
    const marques = s.uaData?.brands?.map((b) => b.brand) ?? [];
    // Chromium sans la marque « Google Chrome » : Chromium nu, Brave, Vivaldi…
    // Ils s'installent comme Chrome, mais on ne s'en porte pas garant.
    if (marques.length > 0 && !marques.includes('Google Chrome') && marques.includes('Chromium')) {
      return 'chromium';
    }
    return /Chromium\//.test(ua) ? 'chromium' : 'chrome';
  }
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';
  // Sur iOS, un navigateur qui n'a ni Version/ ni jeton connu est une vue
  // intégrée à une application : inconnu plutôt que Safari.
  return 'inconnu';
}

/** Lit les sources dans le navigateur réel. Seul point d'accès aux API globales. */
export function lireSourcesNavigateur(nav: Navigator = navigator): SourcesEnvironnement {
  const donnees = (nav as unknown as { userAgentData?: SourcesEnvironnement['uaData'] }).userAgentData;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    uaData: donnees,
  };
}

/**
 * L'application tourne-t-elle déjà comme application installée ?
 * Safari iOS n'implémente pas `display-mode` et expose `navigator.standalone`.
 */
export function lireModeAffichage(
  fenetre: Pick<Window, 'matchMedia'> = window,
  nav: Navigator = navigator,
): ModeAffichage {
  const media = (q: string): boolean => fenetre.matchMedia?.(q).matches ?? false;
  const autonome =
    media('(display-mode: standalone)') ||
    media('(display-mode: minimal-ui)') ||
    media('(display-mode: window-controls-overlay)') ||
    (nav as unknown as { standalone?: boolean }).standalone === true;
  return autonome ? 'autonome' : 'navigateur';
}
