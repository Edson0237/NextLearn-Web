import { describe, expect, it } from 'vitest';
import { casInstallation } from '../utils/cas-installation';
import { detecterEnvironnement, lireModeAffichage, SourcesEnvironnement } from '../utils/environnement';

// Des userAgent réels (ou leurs formes réduites) : la détection doit tenir sur
// ce que les navigateurs envoient vraiment, pas sur des chaînes idéalisées.
const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  androidTabletteChrome: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
  androidEdge: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0',
  ipadSafari: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ en mode « site de bureau » : indiscernable d'un Mac par le seul userAgent.
  ipadSembleMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linuxChromium: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/130.0.0.0 Chrome/130.0.0.0 Safari/537.36',
};

const lire = (userAgent: string, extra: Partial<SourcesEnvironnement> = {}) =>
  detecterEnvironnement({ userAgent, ...extra });

describe('detecterEnvironnement', () => {
  it('Android + Chrome : téléphone', () => {
    expect(lire(UA.androidChrome)).toEqual({ appareil: 'telephone', systeme: 'android', navigateur: 'chrome' });
  });

  it('Android sans « Mobile » : tablette', () => {
    expect(lire(UA.androidTabletteChrome).appareil).toBe('tablette');
  });

  it('Android + navigateurs autres que Chrome', () => {
    expect(lire(UA.androidSamsung).navigateur).toBe('samsung');
    expect(lire(UA.androidFirefox).navigateur).toBe('firefox');
    expect(lire(UA.androidEdge).navigateur).toBe('edge');
  });

  it('une vue web Android n’est pas prise pour Chrome', () => {
    expect(lire(UA.androidWebview).navigateur).toBe('inconnu');
  });

  it('iPhone : Safari, mais aussi Chrome et Firefox (WebKit sous un autre nom)', () => {
    expect(lire(UA.iphoneSafari)).toEqual({ appareil: 'telephone', systeme: 'ios', navigateur: 'safari' });
    expect(lire(UA.iphoneChrome).navigateur).toBe('chrome');
    expect(lire(UA.iphoneFirefox).navigateur).toBe('firefox');
  });

  it('un navigateur intégré à une application iOS reste inconnu, pas Safari', () => {
    expect(lire(UA.iphoneInstagram)).toMatchObject({ systeme: 'ios', navigateur: 'inconnu' });
  });

  it('iPad : userAgent d’iPad', () => {
    expect(lire(UA.ipadSafari)).toEqual({ appareil: 'tablette', systeme: 'ipados', navigateur: 'safari' });
  });

  it('iPadOS qui se présente comme un Mac est reconnu par son écran tactile', () => {
    expect(lire(UA.ipadSembleMac, { maxTouchPoints: 5 })).toMatchObject({ appareil: 'tablette', systeme: 'ipados' });
  });

  it('un vrai Mac, sans écran tactile, reste un Mac', () => {
    expect(lire(UA.macSafari, { maxTouchPoints: 0 })).toEqual({ appareil: 'ordinateur', systeme: 'macos', navigateur: 'safari' });
  });

  it('Windows : Chrome, Edge, Firefox', () => {
    expect(lire(UA.windowsChrome)).toEqual({ appareil: 'ordinateur', systeme: 'windows', navigateur: 'chrome' });
    expect(lire(UA.windowsEdge).navigateur).toBe('edge');
    expect(lire(UA.windowsFirefox).navigateur).toBe('firefox');
  });

  it('macOS + Chrome', () => {
    expect(lire(UA.macChrome, { maxTouchPoints: 0 })).toMatchObject({ systeme: 'macos', navigateur: 'chrome' });
  });

  it('Linux : Chrome, et Chromium nu', () => {
    expect(lire(UA.linuxChrome)).toMatchObject({ systeme: 'linux', navigateur: 'chrome' });
    expect(lire(UA.linuxChromium).navigateur).toBe('chromium');
  });

  it('un Chromium sans la marque « Google Chrome » (Client Hints) n’est pas déclaré Chrome', () => {
    const uaData = { platform: 'Linux', brands: [{ brand: 'Chromium' }, { brand: 'Brave' }] };
    expect(lire(UA.linuxChrome, { uaData }).navigateur).toBe('chromium');
  });

  it('les Client Hints complètent un userAgent vide', () => {
    expect(lire('', { uaData: { platform: 'Windows' } })).toMatchObject({ systeme: 'windows', appareil: 'ordinateur' });
  });

  it('un environnement qui ne dit rien est inconnu, sans exception', () => {
    expect(lire('')).toEqual({ appareil: 'inconnu', systeme: 'inconnu', navigateur: 'inconnu' });
    expect(lire('curl/8.0')).toMatchObject({ systeme: 'inconnu', navigateur: 'inconnu' });
  });
});

describe('casInstallation', () => {
  const cas = (ua: string, extra: Partial<SourcesEnvironnement> = {}) => casInstallation(lire(ua, extra));

  it('choisit la bonne procédure pour chaque environnement exigé', () => {
    expect(cas(UA.androidChrome)).toBe('android-chrome');
    expect(cas(UA.androidSamsung)).toBe('android-samsung');
    expect(cas(UA.androidFirefox)).toBe('android-firefox');
    expect(cas(UA.androidEdge)).toBe('android-edge');
    expect(cas(UA.androidWebview)).toBe('android-autre');
    expect(cas(UA.iphoneSafari)).toBe('ios-safari');
    expect(cas(UA.ipadSafari)).toBe('ios-safari');
    expect(cas(UA.iphoneChrome)).toBe('ios-autre');
    expect(cas(UA.iphoneInstagram)).toBe('ios-integre');
    expect(cas(UA.windowsChrome)).toBe('ordi-chromium');
    expect(cas(UA.windowsEdge)).toBe('ordi-edge');
    expect(cas(UA.macChrome)).toBe('ordi-chromium');
    expect(cas(UA.macSafari)).toBe('ordi-safari');
    expect(cas(UA.linuxChrome)).toBe('ordi-chromium');
    expect(cas(UA.linuxChromium)).toBe('ordi-chromium');
    expect(cas(UA.windowsFirefox)).toBe('ordi-firefox');
  });

  it('retombe sur la procédure générale quand l’environnement est inconnu', () => {
    expect(cas('')).toBe('inconnu');
    expect(casInstallation({ systeme: 'windows', navigateur: 'inconnu' })).toBe('inconnu');
    // Safari n'existe pas sous Windows : mieux vaut le guide général qu'une procédure fausse.
    expect(casInstallation({ systeme: 'windows', navigateur: 'safari' })).toBe('inconnu');
  });
});

describe('lireModeAffichage', () => {
  const fenetre = (vrai: string[]) => ({ matchMedia: (q: string) => ({ matches: vrai.some((v) => q.includes(v)) }) }) as unknown as Window;

  it('reconnaît le mode autonome', () => {
    expect(lireModeAffichage(fenetre(['standalone']), {} as Navigator)).toBe('autonome');
  });

  it('reconnaît le mode autonome de Safari iOS (navigator.standalone)', () => {
    expect(lireModeAffichage(fenetre([]), { standalone: true } as unknown as Navigator)).toBe('autonome');
  });

  it('dans un onglet de navigateur, rend « navigateur »', () => {
    expect(lireModeAffichage(fenetre([]), {} as Navigator)).toBe('navigateur');
  });

  it('survit à un navigateur sans matchMedia', () => {
    expect(lireModeAffichage({} as Window, {} as Navigator)).toBe('navigateur');
  });
});
