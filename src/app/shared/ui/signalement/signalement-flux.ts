import { inject, Injectable } from '@angular/core';
import { tr } from '../../../core/i18n';
import { Failure } from '../../../core/models';
import { ReportRepository } from '../../../core/moderation';
import { CibleSignalement } from '../../../core/moderation';
import { FeuilleActionService } from '../bottom-sheet/feuille-action';
import { FeuilleSelectionService } from '../bottom-sheet/feuille-selection';
import { ToastService } from '../toast/toast';

/**
 * Le parcours de signalement, commun aux documents et aux épreuves : choix du
 * motif, confirmation, envoi, retour à l'étudiant.
 *
 * Les motifs viennent du serveur (`/api/reports/motifs`) et ne sont pas
 * recopiés ici : le catalogue évolue côté back-office, et un client qui en
 * garde une copie finit par proposer un motif que l'API refuse.
 */
@Injectable({ providedIn: 'root' })
export class SignalementFlux {
  private readonly reports = inject(ReportRepository);
  private readonly selections = inject(FeuilleSelectionService);
  private readonly actions = inject(FeuilleActionService);
  private readonly toast = inject(ToastService);

  async signaler(cibleType: CibleSignalement, cibleId: string): Promise<void> {
    let catalogue;
    try {
      catalogue = await this.reports.getMotifs();
    } catch {
      this.toast.erreur(tr('pwaMotifsIndisponibles', 'Les motifs de signalement sont indisponibles.'));
      return;
    }

    const motif = await this.selections.ouvrir<string>({
      title: cibleType === CibleSignalement.epreuve
        ? tr('epreuveSignaler', 'Signaler cette épreuve')
        : tr('docSignaler', 'Signaler ce document'),
      choices: catalogue.motifs.map((m) => ({ value: m.code, label: m.label, description: m.description })),
      emptyMessage: tr('pwaAucunMotifDisponible', 'Aucun motif disponible.'),
    });
    if (!motif) return;

    const choisi = catalogue.motifs.find((m) => m.code === motif);
    const confirme = await this.actions.confirmer({
      title: tr('pwaEnvoyerSignalementQuestion', 'Envoyer ce signalement ?'),
      description: choisi?.masquageImmediat
        ? 'Ce motif retire le contenu immédiatement, le temps qu’un modérateur statue.'
        : `Un modérateur examinera ce signalement sous ${catalogue.slaHeures} h.`,
      confirmLabel: tr('pwaSignaler', 'Signaler'),
      cancelLabel: tr('actionAnnuler', 'Annuler'),
      destructive: true,
    });
    if (!confirme) return;

    try {
      const resultat = await this.reports.signaler({ cibleType, cibleId, motif });
      this.toast.succes(resultat.message);
    } catch (e) {
      // `Failure` masque volontairement les messages bruts du serveur : on
      // dit ici, selon le statut, ce que l'étudiant peut comprendre et faire.
      this.toast.erreur(this.messagePour(e));
    }
  }

  private messagePour(e: unknown): string {
    const statut = e instanceof Failure ? e.statusCode : undefined;
    switch (statut) {
      case 409:
        return tr('pwaDejaSignale', 'Tu as déjà signalé ce contenu. Un modérateur l’examine.');
      case 404:
        return tr('pwaContenuIntrouvable', 'Ce contenu n’existe plus ou n’est plus disponible.');
      case 403:
        return tr('pwaSignalementRefuse', 'Ton compte ne peut pas signaler pour l’instant.');
      default:
        return tr('pwaSignalementNonEnvoye', 'Le signalement n’a pas pu être envoyé.');
    }
  }
}
