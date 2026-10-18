import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import { inject, Injectable, InjectionToken, Injector } from '@angular/core';

/** Ce que reçoit le contenu ouvert dans une feuille — sa façon de se fermer. */
export abstract class BottomSheetRef<R = unknown> {
  abstract close(result?: R): void;
}

/**
 * Service de feuilles glissantes — traduction de `FeuilleAction.ouvrir`
 * (`feuille_action.dart`), bâtie sur `@angular/cdk/overlay`.
 *
 * ## Le piège du Navigator, traduit en piège du routeur
 *
 * Le commentaire Flutter prévient : une feuille ouverte depuis le
 * `Navigator` d'une route enfant (un `ShellRoute`) ne se referme pas si on
 * la ferme avec le contexte de la *page* plutôt qu'avec celui de la
 * feuille. L'équivalent CDK est plus simple à bien faire — l'overlay vit
 * dans son propre conteneur, attaché à `<body>`, hors de l'arbre de
 * routage — mais la même règle vaut en esprit : c'est `BottomSheetRef`,
 * reçu par le contenu ouvert, qui ferme la feuille, jamais une référence
 * prise ailleurs.
 */
@Injectable({ providedIn: 'root' })
export class BottomSheetService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  /** Ouvre une feuille portant un composant quelconque. */
  open<T, R = unknown>(component: ComponentType<T>, data?: unknown): BottomSheetHandle<T, R> {
    const config = new OverlayConfig({
      positionStrategy: this.overlay.position().global().bottom('0').centerHorizontally(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: true,
      backdropClass: 'nl-sheet-backdrop',
      panelClass: 'nl-sheet-panel',
      width: '100%',
      maxWidth: '560px',
    });

    const overlayRef = this.overlay.create(config);

    let resoudre!: (valeur: R | undefined) => void;
    const resultat = new Promise<R | undefined>((r) => (resoudre = r));

    const refFermeture: BottomSheetRef<R> = {
      close: (result?: R) => {
        resoudre(result);
        overlayRef.dispose();
      },
    };

    const injecteurEnfant = Injector.create({
      parent: this.injector,
      providers: [
        { provide: BottomSheetRef, useValue: refFermeture },
        { provide: BOTTOM_SHEET_DATA, useValue: data },
      ],
    });

    const portail = new ComponentPortal(component, undefined, injecteurEnfant);
    const instanceRef = overlayRef.attach(portail);

    // Glisser le fond fait exactement ce que fermer d'un geste fait côté
    // Flutter : la feuille se referme sans valeur — un refus, pas un choix.
    overlayRef.backdropClick().subscribe(() => refFermeture.close(undefined));

    return { instance: instanceRef.instance, result: resultat, close: refFermeture.close };
  }
}

export interface BottomSheetHandle<T, R> {
  readonly instance: T;
  readonly result: Promise<R | undefined>;
  readonly close: (result?: R) => void;
}

/** Jeton d'injection pour les données passées à `open()`. */
export const BOTTOM_SHEET_DATA = new InjectionToken<unknown>('nl-bottom-sheet-data');
