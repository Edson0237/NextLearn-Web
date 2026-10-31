import { Injectable, computed, effect, signal } from '@angular/core';

/**
 * Échelle de texte - mêmes clés et mêmes facteurs que `EchelleTexte`
 * (`lib/app/theme/preferences_accessibilite.dart`).
 *
 * Le facteur multiplie celui du système plutôt que de le remplacer : quelqu'un
 * qui a déjà grossi le texte de son téléphone et qui le grossit encore ici
 * obtient les deux.
 */
export enum EchelleTexte {
  normale = 'normale',
  grande = 'grande',
  tresGrande = 'tres_grande',
}

const FACTEURS: Record<EchelleTexte, number> = {
  [EchelleTexte.normale]: 1,
  [EchelleTexte.grande]: 1.15,
  [EchelleTexte.tresGrande]: 1.3,
};

export const LIBELLES_ECHELLE: Record<EchelleTexte, string> = {
  [EchelleTexte.normale]: 'Normale',
  [EchelleTexte.grande]: 'Grande',
  [EchelleTexte.tresGrande]: 'Très grande',
};

const CLE = 'nl_acces_prefs';

interface EtatAccessibilite {
  /** `null` = suivre le réglage du téléphone. */
  readonly reduireAnimations: boolean | null;
  readonly echelleTexte: EchelleTexte;
}

const DEFAUT: EtatAccessibilite = {
  reduireAnimations: null,
  echelleTexte: EchelleTexte.normale,
};

/**
 * Réglages d'accessibilité - traduction de `PreferencesAccessibilite`.
 *
 * Les deux lignes existaient dans les réglages de la PWA mais affichaient
 * « bientôt » : une personne qui a activé « réduire les animations » sur son
 * téléphone l'a fait pour une raison, et une personne qui agrandit le texte
 * aussi. Le contrat est celui de Flutter : **le choix explicite l'emporte sur
 * le réglage du système**, et son absence veut dire « suivre le téléphone ».
 */
@Injectable({ providedIn: 'root' })
export class PreferencesAccessibilite {
  private readonly etat = signal<EtatAccessibilite>(this.lire());

  readonly reduireAnimations = computed(() => this.etat().reduireAnimations);
  readonly echelleTexte = computed(() => this.etat().echelleTexte);

  /** Faut-il réduire le mouvement, tout compte fait ? */
  readonly mouvementReduit = computed(() => {
    const choix = this.etat().reduireAnimations;
    if (choix !== null) return choix;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  constructor() {
    // Les deux réglages n'agissent que par deux attributs posés sur la racine
    // du document : `_motion.scss` et `_tokens.scss` font le reste, et aucun
    // écran n'a à les connaître.
    effect(() => {
      const racine = document.documentElement;
      racine.classList.toggle('nl-motion-reduced', this.mouvementReduit());
      // L'échelle agit sur la taille de base du document : toute la
      // typographie est exprimée en `rem`, donc tout suit - titres, corps,
      // puces - sans qu'aucun composant n'ait à s'en occuper.
      const facteur = FACTEURS[this.echelleTexte()];
      racine.style.fontSize = facteur === 1 ? '' : `${Math.round(facteur * 100)}%`;
    });
  }

  definirReduction(valeur: boolean | null): void {
    this.ecrire({ ...this.etat(), reduireAnimations: valeur });
  }

  definirEchelle(echelle: EchelleTexte): void {
    this.ecrire({ ...this.etat(), echelleTexte: echelle });
  }

  private ecrire(etat: EtatAccessibilite): void {
    this.etat.set(etat);
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
    } catch {
      // Le réglage vaut pour la session en cours ; il ne sera pas retenu.
    }
  }

  private lire(): EtatAccessibilite {
    try {
      const brut = localStorage.getItem(CLE);
      if (!brut) return DEFAUT;
      const json = JSON.parse(brut) as Partial<EtatAccessibilite>;
      const echelle = Object.values(EchelleTexte).includes(json.echelleTexte as EchelleTexte)
        ? (json.echelleTexte as EchelleTexte)
        : EchelleTexte.normale;
      return {
        reduireAnimations:
          json.reduireAnimations === true || json.reduireAnimations === false
            ? json.reduireAnimations
            : null,
        echelleTexte: echelle,
      };
    } catch {
      return DEFAUT;
    }
  }
}
