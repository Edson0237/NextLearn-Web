import { inject, Injectable } from '@angular/core';
import { langueCourante, tr } from '../../../core/i18n';
import { Failure } from '../../../core/models';
import { CibleSignalement, ReportRepository, traduireMotifSignalement } from '../../../core/moderation';
import { BottomSheetService } from '../bottom-sheet/bottom-sheet';
import { SignalementSaisi, SignalementSheet, SignalementSheetData } from './signalement-sheet';
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
  private readonly sheets = inject(BottomSheetService);
  private readonly toast = inject(ToastService);

  async signaler(cibleType: CibleSignalement, cibleId: string): Promise<void> {
    let catalogue;
    try {
      catalogue = await this.reports.getMotifs();
    } catch {
      this.toast.erreur(tr('pwaMotifsIndisponibles', 'Les motifs de signalement sont indisponibles.'));
      return;
    }

    const titre = cibleType === CibleSignalement.epreuve
      ? tr('epreuveSignaler', 'Signaler cette épreuve')
      : tr('docSignaler', 'Signaler ce document');
    if (catalogue.motifs.length === 0) {
      this.toast.erreur(tr('pwaAucunMotifDisponible', 'Aucun motif disponible.'));
      return;
    }

    let saisie: SignalementSaisi | undefined;
    // Après un échec récupérable la feuille se rouvre avec ce qui était saisi :
    // réécrire une explication de dix lignes parce que le réseau a flanché
    // pousserait à renoncer.
    for (;;) {
      saisie = await this.sheets.open<SignalementSheet, SignalementSaisi>(SignalementSheet, {
        titre,
        motifs: catalogue.motifs.map((m) => {
          const trad = traduireMotifSignalement(m.code, m.label, m.description);
          return { code: m.code, label: trad.label, description: trad.description };
        }),
        motifsMasquants: catalogue.motifs.filter((m) => m.masquageImmediat).map((m) => m.code),
        information: tr(
          'signalementInfoDelai',
          `Un modérateur examinera ce signalement sous ${catalogue.slaHeures} h.`,
          { heures: catalogue.slaHeures },
        ),
        motifInitial: saisie?.motif,
        explicationInitiale: saisie?.commentaire,
      } satisfies SignalementSheetData).result;
      if (!saisie) return;

      try {
        const resultat = await this.reports.signaler({
          cibleType,
          cibleId,
          motif: saisie.motif,
          commentaire: saisie.commentaire,
        });
        this.toast.succes(
          langueCourante() === 'en' ? tr('signalementEnregistre', resultat.message) : resultat.message,
        );
        return;
      } catch (e) {
        // `Failure` masque volontairement les messages bruts du serveur : on
        // dit ici, selon le statut, ce que l'étudiant peut comprendre et faire.
        this.toast.erreur(this.messagePour(e));
        const statut = e instanceof Failure ? e.statusCode : undefined;
        if (statut === 409 || statut === 404 || statut === 403) return;
      }
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
