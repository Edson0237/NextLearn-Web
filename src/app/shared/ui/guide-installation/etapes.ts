import { CasInstallation } from '../../../core/pwa/cas-installation';
import { IconName } from '../icon/icon-paths';

/** Une étape du guide : une clé de traduction, et l'icône du geste quand il en a une. */
export interface EtapeGuide {
  readonly cle: string;
  readonly icone?: IconName;
}

export interface ProcedureGuide {
  readonly titre: string;
  readonly etapes: readonly EtapeGuide[];
}

/**
 * Les gestes d'installation, par procédure.
 *
 * Les libellés de menu sont ceux des navigateurs à la date de rédaction ; ils
 * changent d'une version à l'autre (Chrome a renommé son entrée plusieurs
 * fois), d'où la mention du guide qui invite à chercher « Installer » quand un
 * intitulé diffère. Les clés sont écrites en toutes lettres pour que
 * `verifier-design` voie qu'elles sont employées.
 */
export const PROCEDURES: Record<CasInstallation, ProcedureGuide> = {
  'android-chrome': {
    titre: 'installAndroidChromeTitre',
    etapes: [
      { cle: 'installAndroidChromeEtape1', icone: 'more_vert' },
      { cle: 'installAndroidChromeEtape2' },
      { cle: 'installAndroidChromeEtape3' },
    ],
  },
  'android-samsung': {
    titre: 'installAndroidSamsungTitre',
    etapes: [
      { cle: 'installAndroidSamsungEtape1' },
      { cle: 'installAndroidSamsungEtape2' },
    ],
  },
  'android-firefox': {
    titre: 'installAndroidFirefoxTitre',
    etapes: [
      { cle: 'installAndroidFirefoxEtape1', icone: 'more_vert' },
      { cle: 'installAndroidFirefoxEtape2' },
    ],
  },
  'android-edge': {
    titre: 'installAndroidEdgeTitre',
    etapes: [
      { cle: 'installAndroidEdgeEtape1', icone: 'more_horiz' },
      { cle: 'installAndroidEdgeEtape2' },
    ],
  },
  'android-autre': {
    titre: 'installAndroidAutreTitre',
    etapes: [
      { cle: 'installAndroidAutreEtape1' },
      { cle: 'installAndroidAutreEtape2' },
    ],
  },
  'ios-safari': {
    titre: 'installIosSafariTitre',
    etapes: [
      { cle: 'installIosSafariEtape1', icone: 'share' },
      { cle: 'installIosSafariEtape2' },
      { cle: 'installIosSafariEtape3' },
    ],
  },
  'ios-autre': {
    titre: 'installIosAutreTitre',
    etapes: [
      { cle: 'installIosAutreEtape1', icone: 'share' },
      { cle: 'installIosAutreEtape2' },
      { cle: 'installIosAutreEtape3' },
    ],
  },
  'ios-integre': {
    titre: 'installIosIntegreTitre',
    etapes: [
      { cle: 'installIosIntegreEtape1', icone: 'open_in_new' },
      { cle: 'installIosIntegreEtape2' },
    ],
  },
  'ordi-chromium': {
    titre: 'installOrdiChromiumTitre',
    etapes: [
      { cle: 'installOrdiChromiumEtape1', icone: 'download' },
      { cle: 'installOrdiChromiumEtape2', icone: 'more_vert' },
    ],
  },
  'ordi-edge': {
    titre: 'installOrdiEdgeTitre',
    etapes: [
      { cle: 'installOrdiEdgeEtape1', icone: 'download' },
      { cle: 'installOrdiEdgeEtape2', icone: 'more_horiz' },
    ],
  },
  'ordi-safari': {
    titre: 'installOrdiSafariTitre',
    etapes: [
      { cle: 'installOrdiSafariEtape1' },
      { cle: 'installOrdiSafariEtape2', icone: 'share' },
    ],
  },
  'ordi-firefox': {
    titre: 'installOrdiFirefoxTitre',
    etapes: [
      { cle: 'installOrdiFirefoxEtape1' },
      { cle: 'installOrdiFirefoxEtape2' },
    ],
  },
  inconnu: {
    titre: 'installInconnuTitre',
    etapes: [
      { cle: 'installInconnuEtape1' },
      { cle: 'installInconnuEtape2' },
      { cle: 'installInconnuEtape3' },
    ],
  },
};
