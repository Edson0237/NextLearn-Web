import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Langue = 'fr' | 'en';
export type PreferenceLangue = Langue | 'systeme';

const CLE = 'nl_langue';
const PREFIXE_COPIE = 'nl_i18n_';

/**
 * Traductions de l'application.
 *
 * ## Pourquoi un service d'exécution plutôt que `@angular/localize`
 *
 * L'i18n intégrée d'Angular compile **une application par langue** : deux
 * dossiers à déployer, deux URL, et surtout aucun moyen de changer de langue
 * sans recharger sur une autre adresse. Or le contrat à reprendre est celui
 * de Flutter : un sélecteur dans les réglages, effet immédiat, et « suivre le
 * téléphone » par défaut (`locale_provider.dart`). Un dictionnaire chargé à
 * l'exécution donne exactement cela, pour un fichier de 46 Ko par langue.
 *
 * ## D'où viennent les textes
 *
 * Des mêmes fichiers que l'application mobile : `lib/l10n/app_fr.arb` et
 * `app_en.arb`, exportés tels quels dans `public/i18n/`. Les deux plateformes
 * disent donc littéralement la même chose, et une correction de formulation
 * faite côté Flutter se réimporte sans être retraduite.
 *
 * La PWA n'avait aucune traduction : tout était écrit en français dans les
 * gabarits, et le sélecteur des réglages affichait « bientôt disponible ».
 */
/**
 * L'instance courante, pour les messages qui naissent hors d'un composant.
 *
 * C'est le pendant de `Traductions.courantes` côté Flutter, et il existe pour
 * la même raison : une bonne part des textes destinés à l'utilisateur naît là
 * où l'injection de dépendances n'a pas cours - un dépôt qui lève « ce code a
 * expiré », une règle de validation du PIN, le libellé d'une licence. Les
 * remonter tous jusqu'à un composant reviendrait à faire voyager un code
 * d'erreur à travers toute l'application pour refaire le libellé à l'arrivée.
 */
let instance: TraductionService | null = null;

/**
 * Le texte d'une clé, sans injection. `secours` est affiché si la clé manque.
 *
 * À n'employer que hors composant : dans un gabarit, le tube `| t` suit les
 * changements de langue, là où cette fonction ne fait que lire.
 */
export function tr(
  cle: string,
  secours?: string,
  params?: Record<string, string | number>,
): string {
  return instance ? instance.t(cle, params, secours) : (secours ?? cle);
}

/** Langue active courante (`'fr'` tant qu'un dictionnaire anglais n'est pas chargé). */
export function langueCourante(): Langue {
  if (!instance) return 'fr';
  return instance.langue() === 'en' && instance.aDesMessages() ? 'en' : 'fr';
}

@Injectable({ providedIn: 'root' })
export class TraductionService {
  private readonly http = inject(HttpClient);

  private readonly messages = signal<Record<string, string>>({});
  private readonly preference = signal<PreferenceLangue>(this.lirePreference());

  /** La langue réellement appliquée, préférence et système confondus. */
  readonly langue = computed<Langue>(() => {
    const choix = this.preference();
    if (choix !== 'systeme') return choix;
    return this.langueDuNavigateur();
  });

  /** Les messages sont-ils arrivés ? Sert à ne pas afficher de clés brutes. */
  readonly pret = signal(false);

  aDesMessages(): boolean {
    return Object.keys(this.messages()).length > 0;
  }

  constructor() {
    instance = this;
  }

  /**
   * Le français n'a pas besoin d'attendre son catalogue.
   *
   * Chaque texte est écrit dans les gabarits avec son libellé français en
   * secours : tant que le dictionnaire n'est pas arrivé, l'écran affiche
   * exactement ce qu'il affichera après. Faire patienter le premier rendu
   * derrière 46 Ko de JSON ne corrigerait donc rien de visible, et retardait
   * le premier affichage d'autant.
   *
   * En anglais, l'attente se justifie : sans elle, l'écran s'afficherait en
   * français une fraction de seconde avant de basculer.
   */
  demarrage(): Promise<void> | void {
    const promesse = this.charger();
    return this.langue() === 'fr' ? undefined : promesse;
  }

  async charger(): Promise<void> {
    const langue = this.langue();
    try {
      const messages = await firstValueFrom(
        this.http.get<Record<string, string>>(`/i18n/${langue}.json`),
      );
      this.messages.set(messages ?? {});
      this.garderCopie(langue, messages);
    } catch {
      // Dictionnaire injoignable (hors ligne, et le service worker ne l'a pas
      // encore en cache) : la dernière copie reçue sert de filet. Sans elle,
      // les écrans qui n'ont pas de texte de secours montraient leurs clés
      // brutes - « authCreerCompte », « vitrineTitreLigne1 ». À défaut de
      // copie, mieux vaut afficher les textes de secours passés aux appels que
      // de bloquer l'application sur un fichier de traduction.
      this.messages.set(this.lireCopie(langue) ?? {});
    } finally {
      this.pret.set(true);
      document.documentElement.lang = langue;
    }
  }

  /**
   * Le message d'une clé, avec ses paramètres.
   *
   * `secours` est le texte à afficher si la clé est absente - c'est ce qui
   * permet de migrer les écrans un par un sans qu'aucun n'affiche jamais un
   * identifiant technique à l'utilisateur.
   */
  t(cle: string, params?: Record<string, string | number>, secours?: string): string {
    const brut = this.messages()[cle] ?? secours ?? cle;
    return params ? this.interpoler(brut, params) : this.interpoler(brut, {});
  }

  async definir(preference: PreferenceLangue): Promise<void> {
    this.preference.set(preference);
    try {
      localStorage.setItem(CLE, preference);
    } catch {
      // Le choix vaut pour la session en cours.
    }
    await this.charger();
  }

  preferenceCourante(): PreferenceLangue {
    return this.preference();
  }

  /**
   * Remplace les paramètres, y compris les formes plurielles ICU simples
   * (`{n, plural, =0{…} =1{…} other{…}}`) - les 64 messages du catalogue qui
   * en contiennent sont tous de cette forme. Une bibliothèque ICU complète
   * pèserait plus lourd que le catalogue lui-même.
   */
  /**
   * Remplace les paramètres, formes plurielles ICU simples comprises
   * (`{n, plural, =0{…} =1{…} other{…}}`) - les 64 messages du catalogue qui
   * en contiennent sont tous de cette forme. Une bibliothèque ICU complète
   * pèserait plus lourd que le catalogue lui-même.
   *
   * Les accolades sont appariées par comptage plutôt que par expression
   * régulière : une branche contient elle-même `{nombre}`, et un motif qui
   * s'arrête à la première accolade fermante découpe le message au mauvais
   * endroit - ce que le test de pluriel a montré du premier coup.
   */
  private interpoler(message: string, params: Record<string, string | number>): string {
    const resolu = this.resoudrePluriels(message, params);
    return resolu.replace(/\{(\w+)\}/g, (tout, nom: string) =>
      nom in params ? String(params[nom]) : tout,
    );
  }

  private resoudrePluriels(message: string, params: Record<string, string | number>): string {
    const debut = message.search(/\{\s*\w+\s*,\s*plural\s*,/);
    if (debut === -1) return message;

    const fin = this.accoladeFermante(message, debut);
    if (fin === -1) return message;

    const bloc = message.slice(debut + 1, fin);
    const nom = bloc.slice(0, bloc.indexOf(',')).trim();
    const branches = bloc.slice(bloc.indexOf('plural,') + 'plural,'.length);
    const valeur = Number(params[nom] ?? 0);

    const choisie =
      this.brancheDe(branches, `=${valeur}`) ??
      this.brancheDe(branches, valeur === 1 ? 'one' : 'other') ??
      this.brancheDe(branches, 'other') ??
      '';

    // Le reste du message peut contenir d'autres blocs.
    return (
      message.slice(0, debut) +
      choisie +
      this.resoudrePluriels(message.slice(fin + 1), params)
    );
  }

  /** L'index de l'accolade qui ferme celle ouverte en `ouverture`. */
  private accoladeFermante(texte: string, ouverture: number): number {
    let profondeur = 0;
    for (let i = ouverture; i < texte.length; i++) {
      if (texte[i] === '{') profondeur++;
      else if (texte[i] === '}') {
        profondeur--;
        if (profondeur === 0) return i;
      }
    }
    return -1;
  }

  /** Le contenu de la branche `cle{…}`, ou `null` si elle n'existe pas. */
  private brancheDe(branches: string, cle: string): string | null {
    const marque = branches.indexOf(`${cle}{`);
    if (marque === -1) return null;
    const ouverture = marque + cle.length;
    const fin = this.accoladeFermante(branches, ouverture);
    return fin === -1 ? null : branches.slice(ouverture + 1, fin);
  }

  private langueDuNavigateur(): Langue {
    try {
      return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
    } catch {
      return 'fr';
    }
  }

  private garderCopie(langue: Langue, messages: Record<string, string> | null): void {
    if (!messages) return;
    try {
      localStorage.setItem(PREFIXE_COPIE + langue, JSON.stringify(messages));
    } catch {
      // Stockage plein ou bloqué : le service worker reste la voie principale.
    }
  }

  private lireCopie(langue: Langue): Record<string, string> | null {
    try {
      const brut = localStorage.getItem(PREFIXE_COPIE + langue);
      return brut ? (JSON.parse(brut) as Record<string, string>) : null;
    } catch {
      return null;
    }
  }

  private lirePreference(): PreferenceLangue {
    try {
      const stocke = localStorage.getItem(CLE);
      return stocke === 'fr' || stocke === 'en' || stocke === 'systeme' ? stocke : 'systeme';
    } catch {
      return 'systeme';
    }
  }
}
