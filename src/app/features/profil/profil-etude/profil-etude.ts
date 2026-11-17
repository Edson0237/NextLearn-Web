import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormatPrefereEtude,
  LangueDocumentEtude,
  ManquantProfilEtude,
  ModificationProfilEtude,
  ObjectifEtude,
  ProfilEtude,
  ProfilRepository,
} from '../../../core/profil';
import { MatiereOption, ReferencesRepository } from '../../../core/references';
import { Failure } from '../../../core/models';
import { tr, TraductionPipe, TraductionService } from '../../../core/i18n';
import { AppRoutes } from '../../../core/router';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';

const CLE_ECONOMIE_DONNEES = 'nl_economie_donnees';

/**
 * Écran « Mon profil d'étude » (Chantier P6 : `GET/PUT/DELETE /api/v2/me/profil-etude`).
 *
 * - Affiche la barre de progression `completude.pourcentage` %.
 * - Affiche **une invitation à la fois** pilotée par `completude.manquants[0]`,
 *   dans la langue active (`fr` ou `en`), et la retire dès que le champ est rempli.
 * - Permet d'enregistrer chaque champ indépendamment (mise à jour partielle).
 * - Relie chaque matière difficile à Explorer (`/app/bibliotheque?matiere=…`).
 */
@Component({
  selector: 'app-profil-etude',
  standalone: true,
  imports: [TraductionPipe, PageBar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profil-etude.html',
  styleUrl: './profil-etude.scss',
})
export class ProfilEtudePage implements OnInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly repo = inject(ProfilRepository);
  private readonly refs = inject(ReferencesRepository);
  private readonly toast = inject(ToastService);
  private readonly actions = inject(FeuilleActionService);
  private readonly traductions = inject(TraductionService);

  protected readonly chargement = signal(true);
  protected readonly sauvegarde = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly profil = signal<ProfilEtude | null>(null);
  protected readonly catalogueMatieres = signal<MatiereOption[]>([]);
  protected readonly rechercheMatiere = signal('');

  protected readonly objectifs: readonly { value: ObjectifEtude; labelCle: string; defaut: string }[] = [
    { value: 'reussir', labelCle: 'profilEtudeObjReussir', defaut: 'Réussir mes examens' },
    { value: 'mention', labelCle: 'profilEtudeObjMention', defaut: 'Viser une mention' },
    { value: 'rattrapage', labelCle: 'profilEtudeObjRattrapage', defaut: 'Préparer les rattrapages' },
    { value: 'perfectionnement', labelCle: 'profilEtudeObjPerfectionnement', defaut: 'Approfondir mes cours' },
  ];

  /** Une seule invitation affichée à la fois (`completude.manquants[0]`). */
  protected readonly invitationActive = computed< { cle: string; texte: string } | null >(() => {
    const lang = this.traductions.langue();
    const premier: ManquantProfilEtude | undefined = this.profil()?.completude.manquants[0];
    if (!premier) return null;
    return {
      cle: premier.cle,
      texte: lang === 'en' ? (premier.en || premier.fr) : premier.fr,
    };
  });

  protected readonly matieresProposees = computed<MatiereOption[]>(() => {
    const q = this.rechercheMatiere().trim().toLowerCase();
    const toutes = this.catalogueMatieres();
    if (!q) return toutes.slice(0, 30);
    return toutes.filter((m) => m.nom.toLowerCase().includes(q)).slice(0, 30);
  });

  protected readonly idsDifficiles = computed<ReadonlySet<string>>(
    () => new Set((this.profil()?.etude.matieresDifficiles ?? []).map((m) => m.id)),
  );

  async ngOnInit(): Promise<void> {
    await this.charger();
  }

  protected async charger(): Promise<void> {
    this.chargement.set(true);
    this.erreur.set(null);
    try {
      const donnees = await this.repo.lireProfilEtude();
      this.appliquerProfil(donnees);
      void this.chargerCatalogueMatieres(donnees.compte.niveau);
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Impossible de charger ton profil d’étude.');
    } finally {
      this.chargement.set(false);
    }
  }

  private async chargerCatalogueMatieres(niveau?: string): Promise<void> {
    try {
      const liste = await this.refs.getMatieres(niveau ? { niveau } : {});
      this.catalogueMatieres.set(liste);
    } catch {
      // Facultatif : les matières déjà choisies restent affichées
    }
  }

  private appliquerProfil(donnees: ProfilEtude): void {
    this.profil.set(donnees);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CLE_ECONOMIE_DONNEES, donnees.etude.economieDonnees ? '1' : '0');
      }
    } catch {
      // Ignoré
    }
  }

  protected async enregistrerChamp(modif: ModificationProfilEtude): Promise<void> {
    if (this.sauvegarde()) return;
    this.sauvegarde.set(true);
    this.erreur.set(null);
    try {
      const maj = await this.repo.mettreAJourProfilEtude(modif);
      this.appliquerProfil(maj);
      this.toast.succes(tr('profilEtudeEnregistre', 'Profil d’étude mis à jour.'));
    } catch (e) {
      const msg = e instanceof Failure ? e.message : 'Enregistrement impossible.';
      this.toast.erreur(msg);
    } finally {
      this.sauvegarde.set(false);
    }
  }

  protected choisirObjectif(obj: ObjectifEtude): void {
    const actuel = this.profil()?.etude.objectif ?? null;
    void this.enregistrerChamp({ objectif: actuel === obj ? null : obj });
  }

  protected basculerMatiereDifficile(id: string): void {
    const actuelles = (this.profil()?.etude.matieresDifficiles ?? []).map((m) => m.id);
    const existe = actuelles.includes(id);
    if (!existe && actuelles.length >= 15) {
      this.toast.info(tr('profilEtudeMaxMatieres', 'Tu peux choisir au plus 15 matières difficiles.'));
      return;
    }
    const suivantes = existe ? actuelles.filter((x) => x !== id) : [...actuelles, id];
    void this.enregistrerChamp({ matieresDifficiles: suivantes });
  }

  protected explorerMatiere(id: string): void {
    void this.router.navigate(['/app', AppRoutes.bibliotheque], {
      queryParams: { matiere: id },
    });
  }

  protected surChangementDateExamen(e: Event): void {
    const valeur = (e.target as HTMLInputElement).value.trim();
    void this.enregistrerChamp({ dateProchainExamen: valeur || null });
  }

  protected effacerDateExamen(): void {
    void this.enregistrerChamp({ dateProchainExamen: null });
  }

  protected basculerLangueDoc(langue: LangueDocumentEtude): void {
    const actuelles = [...(this.profil()?.etude.languesDocuments ?? [])];
    const suivantes = actuelles.includes(langue)
      ? actuelles.filter((l) => l !== langue)
      : [...actuelles, langue];
    void this.enregistrerChamp({ languesDocuments: suivantes });
  }

  protected basculerFormatPrefere(format: FormatPrefereEtude): void {
    const actuels = [...(this.profil()?.etude.formatsPreferes ?? [])];
    const suivants = actuels.includes(format)
      ? actuels.filter((f) => f !== format)
      : [...actuels, format];
    void this.enregistrerChamp({ formatsPreferes: suivants });
  }

  protected basculerRappels(): void {
    const r = this.profil()?.etude.rappels ?? { actifs: false, heure: null };
    const actifs = !r.actifs;
    void this.enregistrerChamp({
      rappels: { actifs, heure: actifs ? (r.heure ?? '18:30') : r.heure },
    });
  }

  protected surChangementHeureRappel(e: Event): void {
    const heure = (e.target as HTMLInputElement).value.trim();
    if (!/^\d{2}:\d{2}$/.test(heure)) return;
    void this.enregistrerChamp({
      rappels: { actifs: true, heure },
    });
  }

  protected basculerEconomieDonnees(): void {
    const actuel = this.profil()?.etude.economieDonnees === true;
    void this.enregistrerChamp({ economieDonnees: !actuel });
  }

  protected basculerConsentementSuivi(): void {
    const actuel = this.profil()?.etude.consentementSuivi === true;
    void this.enregistrerChamp({ consentementSuivi: !actuel });
  }

  protected async reinitialiserProfil(): Promise<void> {
    const confirme = await this.actions.confirmer({
      title: tr('profilEtudeResetTitre', 'Réinitialiser ton profil d’étude ?'),
      description: tr(
        'profilEtudeResetDescription',
        'Tes préférences d’étude (objectif, matières difficiles, date d’examen et rappels) seront remises à zéro.',
      ),
      confirmLabel: tr('actionReinitialiser', 'Réinitialiser'),
      destructive: true,
    });
    if (!confirme) return;
    this.sauvegarde.set(true);
    try {
      const vide = await this.repo.reinitialiserProfilEtude();
      this.appliquerProfil(vide);
      this.toast.succes(tr('profilEtudeReinitialise', 'Profil d’étude réinitialisé.'));
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Réinitialisation impossible.');
    } finally {
      this.sauvegarde.set(false);
    }
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected retour(): void {
    this.location.back();
  }
}
