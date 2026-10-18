import { Injectable } from '@angular/core';

/**
 * Retour vibratoire — traduction de `RetourHaptique`
 * (`lib/core/ux/retour_haptique.dart`).
 *
 * ## Une différence délibérée avec le web Flutter
 *
 * Côté Flutter, `RetourHaptique` est un no-op complet sur le web : `succes()`
 * et `echec()` testent `kIsWeb` et sortent immédiatement, et les trois autres
 * méthodes ne font jamais rien hors iOS natif. C'est la source de vérité,
 * mais ce n'est pas ce que le portage doit reproduire ici — c'est
 * exactement le cas que la Phase 2 du prompt de portage demande de traiter
 * autrement : « Si une fonctionnalité native est impossible sur le web, [...]
 * implémente la meilleure alternative web ».
 *
 * La meilleure alternative existe : l'API Vibration (`navigator.vibrate`),
 * disponible sur Chrome/Android, absente par conception sur Safari/iOS (qui
 * n'a jamais implémenté cette API, politique d'Apple, pas une lacune de
 * Safari). Le résultat est l'inverse de la répartition Flutter — iOS
 * favorisé côté natif, Android seul capable de vibrer côté web — et c'est
 * documenté ici pour qu'on ne s'attende pas à retrouver le même partage.
 *
 * Silence total si l'API est absente : jamais d'erreur, jamais de détection
 * de plateforme à maintenir à la main.
 */
@Injectable({ providedIn: 'root' })
export class HapticService {
  private vibrer(motif: number | number[]): void {
    navigator.vibrate?.(motif);
  }

  /** Effleurement : une carte qu'on ouvre, une puce qu'on sélectionne. */
  leger(): void {
    this.vibrer(10);
  }

  /** Action qui engage : un téléchargement lancé, une feuille confirmée. */
  moyen(): void {
    this.vibrer(20);
  }

  /** Sélection qui glisse d'un cran : curseur, roue, pagination. */
  selection(): void {
    this.vibrer(8);
  }

  /** Réussite — une vibration brève mais distincte d'un simple effleurement. */
  succes(): void {
    this.vibrer([15, 40, 15]);
  }

  /** Échec — plus appuyé, pour qu'on ne le confonde pas avec une réussite. */
  echec(): void {
    this.vibrer([30, 50, 30, 50, 30]);
  }
}
