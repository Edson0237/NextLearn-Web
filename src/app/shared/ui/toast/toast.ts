import { inject, Injectable, signal } from '@angular/core';
import { IconName } from '../icon/icon-paths';
import { HapticService } from '../../services/haptic';

export type ToastTone = 'info' | 'succes' | 'erreur';

export interface ToastActif {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

const DUREE_BREVE_MS = 3000;
const DUREE_AVEC_ACTION_MS = 5000;

const ICONES: Readonly<Record<ToastTone, IconName>> = {
  info: 'info',
  succes: 'check_circle',
  erreur: 'error',
};

/**
 * Messages brefs affichés en bas d'écran — traduction de `MessageFlottant`
 * (`message_flottant.dart`).
 *
 * Chaque message chasse le précédent (même `clearSnackBars()` +
 * `showSnackBar()` côté Flutter) : un seul slot, jamais d'empilement — le
 * second d'une paire rapprochée n'attend pas la fin du premier pour
 * paraître, ce qui serait trop tard pour se rapporter à quoi que ce soit.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly haptic = inject(HapticService);
  private prochainId = 0;
  private minuteur: ReturnType<typeof setTimeout> | undefined;

  readonly actif = signal<ToastActif | undefined>(undefined);

  /** Accusé de réception neutre. */
  info(message: string): void {
    this.montrer(message, 'info');
  }

  /** Réussite — vibre discrètement : on regarde souvent ailleurs à la fin d'une opération. */
  succes(message: string): void {
    this.haptic.succes();
    this.montrer(message, 'succes');
  }

  /** Échec — réservé à ce qui n'empêche pas de continuer. */
  erreur(message: string): void {
    this.haptic.echec();
    this.montrer(message, 'erreur');
  }

  /** Un message assorti d'un retour en arrière — le bon patron pour une suppression. */
  avecAnnulation(message: string, actionLabel: string, onAction: () => void): void {
    this.montrer(message, 'info', actionLabel, onAction);
  }

  ferme(): void {
    clearTimeout(this.minuteur);
    this.actif.set(undefined);
  }

  private montrer(
    message: string,
    tone: ToastTone,
    actionLabel?: string,
    onAction?: () => void,
  ): void {
    clearTimeout(this.minuteur);
    const id = ++this.prochainId;
    this.actif.set({ id, message, tone, actionLabel, onAction });
    this.minuteur = setTimeout(
      () => {
        if (this.actif()?.id === id) this.actif.set(undefined);
      },
      actionLabel ? DUREE_AVEC_ACTION_MS : DUREE_BREVE_MS,
    );
  }

  icone(tone: ToastTone): IconName {
    return ICONES[tone];
  }
}
