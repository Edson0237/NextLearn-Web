import { computed, ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { AuthRepository } from '../../../core/auth';
import { ReferencesRepository } from '../../../core/references';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { ToastService } from '../../../shared/ui/toast/toast';
import { Icon } from '../../../shared/ui/icon/icon';
import { MentionsLegales } from '../../../shared/ui/consentements/mentions-legales';
import { GoogleBouton } from '../../../shared/ui/google-bouton/google-bouton';
import { GoogleIdentite } from '../../../core/auth';
import { AppRoutes } from '../../../core/router';
import { DOMAINE_VIDE, EtatDomaine, ReponseDomaine } from '../../../core/models';
import { Cycle, NiveauEtude, cycleDepuisApi, cycleVersApi, niveauCourt, niveauDepuisTexte } from '../../../core/models';
import { FiliereOption, JustificatifType, OptionReference, Universite } from '../../../core/references';
import { Failure } from '../../../core/models';

type Statut = 'verrouille' | 'chargement' | 'pret' | 'erreur';

interface Cascade<T> {
  readonly statut: Statut;
  readonly items: readonly T[];
  readonly erreur: string;
}

const VERROUILLE: Cascade<never> = { statut: 'verrouille', items: [], erreur: '' };
const CHARGEMENT: Cascade<never> = { statut: 'chargement', items: [], erreur: '' };

/**
 * Inscription - traduction de `RegisterPage`
 * (`lib/domains/auth/presentation/pages/register/register_page.dart`).
 *
 * Cascade École → Cycle → Niveau → Filière fidèle aux deux chemins de la
 * source : les écoles à « ossature » enregistrée (un `cycleId` existe)
 * déroulent Niveau puis Filière dans cet ordre ; les écoles sans ossature
 * (catalogue de secours) chargent la Filière dès École+Cycle connus, et
 * c'est elle qui débloque Niveau - un ordre visuel inchangé qui cache un
 * second chemin de données, exactement comme dans la source.
 *
 * **Non repris** : le sélecteur de langue (pas de couche i18n ici) et la
 * reconnaissance de domaine en continu pendant la frappe au-delà du
 * nécessaire - le contrôle serveur à l'envoi (`register()`) reste
 * l'autorité ; cet écran n'est qu'une aide visuelle, fidèle sur ce point
 * précis à l'intention de la source elle-même.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [TraductionPipe, Icon, GoogleBouton, MentionsLegales],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly authRepo = inject(AuthRepository);
  private readonly refs = inject(ReferencesRepository);
  private readonly feuilles = inject(FeuilleSelectionService);
  private readonly toast = inject(ToastService);

  // ── Étape 1 : informations personnelles ──────────────────────────────────
  protected readonly prenom = signal('');
  protected readonly nom = signal('');
  protected readonly email = signal('');
  /**
   * La procédure se déduit de l'adresse saisie : celle d'un établissement suit
   * le parcours normal ; une adresse que nous ne reconnaissons pas (Gmail,
   * autre organisation) suit celui des personnes sans adresse institutionnelle -
   * justificatif à joindre. Plus de case à cocher : l'étudiant n'a pas à savoir
   * dans quelle catégorie il se trouve.
   */
  protected readonly sansEmailInstitutionnel = computed(() => this.domaine().etat === EtatDomaine.refuse);
  protected readonly domaine = signal<ReponseDomaine>(DOMAINE_VIDE);
  private rebondDomaine: ReturnType<typeof setTimeout> | undefined;

  // ── Étape 2 : parcours académique ────────────────────────────────────────
  protected readonly universiteId = signal<string | undefined>(undefined);
  protected readonly universiteNom = signal<string | undefined>(undefined);
  protected readonly cycle = signal<Cycle | undefined>(undefined);
  protected readonly cycleId = signal<string | undefined>(undefined);
  protected readonly cycleLabel = signal<string | undefined>(undefined);
  protected readonly niveau = signal<NiveauEtude | undefined>(undefined);
  protected readonly niveauLabel = signal<string | undefined>(undefined);
  protected readonly levelId = signal<string | undefined>(undefined);
  protected readonly filiereId = signal<string | undefined>(undefined);
  protected readonly filiereNom = signal<string | undefined>(undefined);

  protected readonly universites = signal<Cascade<Universite>>(CHARGEMENT);
  protected readonly cycles = signal<Cascade<OptionReference>>(VERROUILLE);
  protected readonly niveaux = signal<Cascade<OptionReference>>(VERROUILLE);
  protected readonly filieres = signal<Cascade<FiliereOption>>(VERROUILLE);

  // ── Étape 3 : justificatif (sans e-mail institutionnel) ──────────────────
  protected readonly matricule = signal('');
  protected readonly justificatifType = signal<string | undefined>(undefined);
  protected readonly justificatifFichier = signal<File | undefined>(undefined);
  protected readonly typesJustificatif = signal<Cascade<JustificatifType>>(CHARGEMENT);

  protected readonly etape = signal(0);
  protected readonly chargement = signal(false);

  /**
   * Première visite par Google : l'identité (nom, adresse) est déjà vérifiée,
   * il ne manque que le parcours académique. On saute l'étape « Qui es-tu ? »
   * et on termine par `inscriptionGoogle` au lieu d'envoyer un code par e-mail.
   */
  protected readonly modeGoogle = signal(false);
  /** L'identité Google en cours est-elle celle d'un établissement ? Sinon : justificatif à fournir ensuite. */
  protected readonly profilGoogleInstitutionnel = computed(() => this.auth.profilGoogle()?.institutionnel !== false);

  /** Google est-il configuré ? Sans lui, pas de bouton, donc pas de « ou » à afficher. */
  protected readonly google = inject(GoogleIdentite);

  constructor() {
    void this.chargerUniversites();
    // Une adresse hors établissement demande un justificatif : on charge ses types
    // dès que la procédure bascule, sans attendre le troisième pas.
    effect(() => {
      if (this.sansEmailInstitutionnel()) untracked(() => void this.chargerTypesJustificatif());
    });
    // L'identité peut arriver après la création de la page (bouton Google touché
    // ici même) : on réagit, on ne lit pas une seule fois.
    effect(() => {
      const profil = this.auth.profilGoogle();
      if (!profil) return;
      untracked(() => {
        this.modeGoogle.set(true);
        this.prenom.set(profil.prenom);
        this.nom.set(profil.nom);
        this.email.set(profil.email);
        this.etape.set(1);
      });
    });
  }

  /** Angular n'autorise pas les assertions de type (`as`) dans un gabarit
   * - ce petit détour les déplace là où elles sont permises. */
  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected coche(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected totalEtapes(): number {
    if (this.modeGoogle()) return 1;
    return this.sansEmailInstitutionnel() ? 3 : 2;
  }

  // ── Chargement de la cascade ──────────────────────────────────────────────
  private async chargerUniversites(): Promise<void> {
    this.universites.set(CHARGEMENT);
    try {
      this.universites.set({ statut: 'pret', items: await this.refs.getUniversites(), erreur: '' });
    } catch (e) {
      this.universites.set({ statut: 'erreur', items: [], erreur: this.messageErreur(e) });
    }
  }

  private async chargerCycles(universiteId: string): Promise<void> {
    this.cycles.set(CHARGEMENT);
    try {
      this.cycles.set({ statut: 'pret', items: await this.refs.getCycles(universiteId), erreur: '' });
    } catch (e) {
      this.cycles.set({ statut: 'erreur', items: [], erreur: this.messageErreur(e) });
    }
  }

  private async chargerNiveaux(filtres: { cycleId?: string; filiereId?: string }): Promise<void> {
    this.niveaux.set(CHARGEMENT);
    try {
      this.niveaux.set({ statut: 'pret', items: await this.refs.getNiveaux(filtres), erreur: '' });
    } catch (e) {
      this.niveaux.set({ statut: 'erreur', items: [], erreur: this.messageErreur(e) });
    }
  }

  private async chargerFilieresDuNiveau(levelId: string): Promise<void> {
    this.filieres.set(CHARGEMENT);
    try {
      this.filieres.set({ statut: 'pret', items: await this.refs.getFilieres({ levelId }), erreur: '' });
    } catch (e) {
      this.filieres.set({ statut: 'erreur', items: [], erreur: this.messageErreur(e) });
    }
  }

  private async chargerFilieresCascade(universiteId: string, cycleApi: string): Promise<void> {
    this.filieres.set(CHARGEMENT);
    try {
      this.filieres.set({
        statut: 'pret',
        items: await this.refs.getFilieres({ universiteId, cycle: cycleApi }),
        erreur: '',
      });
    } catch (e) {
      this.filieres.set({ statut: 'erreur', items: [], erreur: this.messageErreur(e) });
    }
  }

  private async chargerTypesJustificatif(): Promise<void> {
    this.typesJustificatif.set(CHARGEMENT);
    try {
      this.typesJustificatif.set({ statut: 'pret', items: await this.refs.getJustificatifTypes(), erreur: '' });
    } catch (e) {
      this.typesJustificatif.set({ statut: 'erreur', items: [], erreur: this.messageErreur(e) });
    }
  }

  // ── Changements de cascade ────────────────────────────────────────────────
  protected async choisirUniversite(): Promise<void> {
    const items = this.universites().items;
    const choisi = await this.feuilles.ouvrir<string>({
      title: tr('communEcole', 'École'),
      currentValue: this.universiteId(),
      choices: items.map((u) => ({ value: u.id, label: u.nom })),
      searchHint: tr('actionRechercher', 'Rechercher'),
    });
    if (choisi === undefined) return;
    this.universiteId.set(choisi);
    this.universiteNom.set(items.find((u) => u.id === choisi)?.nom);
    this.cycle.set(undefined);
    this.cycleId.set(undefined);
    this.cycleLabel.set(undefined);
    this.niveau.set(undefined);
    this.niveauLabel.set(undefined);
    this.levelId.set(undefined);
    this.filiereId.set(undefined);
    this.filiereNom.set(undefined);
    this.niveaux.set(VERROUILLE);
    this.filieres.set(VERROUILLE);
    void this.chargerCycles(choisi);
  }

  protected async choisirCycle(): Promise<void> {
    const items = this.cycles().items;
    const choisi = await this.feuilles.ouvrir<string>({
      title: tr('communCycle', 'Cycle'),
      currentValue: this.cycle() ? cycleVersApi(this.cycle()!) : undefined,
      choices: items.map((c) => ({ value: c.value, label: c.label })),
    });
    if (choisi === undefined) return;
    const option = items.find((c) => c.value === choisi);
    this.cycle.set(cycleDepuisApi(choisi));
    this.cycleId.set(option?.id);
    this.cycleLabel.set(option?.label);
    this.niveau.set(undefined);
    this.niveauLabel.set(undefined);
    this.levelId.set(undefined);
    this.filiereId.set(undefined);
    this.filiereNom.set(undefined);

    if (option?.id) {
      // École à ossature enregistrée : le niveau suit directement le cycle.
      this.filieres.set(VERROUILLE);
      void this.chargerNiveaux({ cycleId: option.id });
    } else {
      // Catalogue de secours : la filière ne dépend que de l'école et du
      // cycle, et c'est elle, une fois choisie, qui débloquera le niveau.
      this.niveaux.set(VERROUILLE);
      const universiteId = this.universiteId();
      if (universiteId) void this.chargerFilieresCascade(universiteId, choisi);
    }
  }

  protected async choisirNiveau(): Promise<void> {
    const items = this.niveaux().items;
    const choisi = await this.feuilles.ouvrir<string>({
      title: tr('docNiveau', 'Niveau'),
      currentValue: this.levelId(),
      choices: items.map((n) => ({ value: n.id ?? n.value, label: n.label })),
    });
    if (choisi === undefined) return;
    const option = items.find((n) => (n.id ?? n.value) === choisi);
    if (!option) return;
    this.niveau.set(niveauDepuisTexte(option.value));
    this.niveauLabel.set(option.label);
    this.levelId.set(option.id);

    if (this.cycleId()) {
      // Ossature : la filière est l'étage terminal, propre à ce niveau - on
      // la redemande, l'ancienne n'est plus forcément proposée.
      this.filiereId.set(undefined);
      this.filiereNom.set(undefined);
      if (option.id) void this.chargerFilieresDuNiveau(option.id);
    }
    // Catalogue de secours : la filière a été choisie avant le niveau, et c'est
    // elle qui l'a fourni. L'effacer ici renvoyait l'étudiant sur « Choisir… »
    // pour une filière qu'il venait de sélectionner.
  }

  protected async choisirFiliere(): Promise<void> {
    const items = this.filieres().items;
    const choisi = await this.feuilles.ouvrir<string>({
      title: tr('communFiliere', 'Filière'),
      currentValue: this.filiereId(),
      choices: items.map((f) => ({ value: f.id, label: f.nom })),
      searchHint: tr('actionRechercher', 'Rechercher'),
    });
    if (choisi === undefined) return;
    this.filiereId.set(choisi);
    this.filiereNom.set(items.find((f) => f.id === choisi)?.nom);

    if (!this.cycleId()) {
      // Catalogue de secours : le niveau, jusqu'ici verrouillé, se déduit
      // enfin de la filière qui vient d'être choisie.
      void this.chargerNiveaux({ filiereId: choisi });
    }
  }

  // ── Domaine e-mail ─────────────────────────────────────────────────────────
  protected surSaisieEmail(valeur: string): void {
    this.email.set(valeur);
    this.planifierVerificationDomaine();
  }

  private planifierVerificationDomaine(): void {
    clearTimeout(this.rebondDomaine);
    const saisie = this.email().trim();

    if (saisie === '') {
      if (this.domaine().etat !== EtatDomaine.vide) this.domaine.set(DOMAINE_VIDE);
      return;
    }
    if (!saisie.includes('@') || saisie.endsWith('@')) {
      this.domaine.set({ etat: EtatDomaine.formatInvalide });
      return;
    }
    this.domaine.set({ etat: EtatDomaine.verification });
    this.rebondDomaine = setTimeout(() => void this.verifierDomaine(saisie), 400);
  }

  private async verifierDomaine(saisie: string): Promise<void> {
    const reponse = await this.authRepo.verifierDomaine(saisie);
    // La réponse peut arriver après coup : ne l'appliquer que si l'adresse
    // affichée est toujours celle qui l'a demandée.
    if (this.email().trim() !== saisie) return;
    this.domaine.set(reponse);
  }

  private async verdictDomaine(saisie: string): Promise<ReponseDomaine> {
    const actuel = this.domaine();
    if (actuel.etat === EtatDomaine.reconnu || actuel.etat === EtatDomaine.refuse) return actuel;
    clearTimeout(this.rebondDomaine);
    const reponse = await this.authRepo.verifierDomaine(saisie);
    if (this.email().trim() === saisie) this.domaine.set(reponse);
    return reponse;
  }

  // ── Fichier justificatif ──────────────────────────────────────────────────
  protected surFichierChoisi(e: Event): void {
    const fichier = (e.target as HTMLInputElement).files?.[0];
    if (fichier) this.justificatifFichier.set(fichier);
  }

  // ── Navigation entre étapes ────────────────────────────────────────────────
  protected async suivant(): Promise<void> {
    const e = this.etape();
    if (e === 0) {
      await this.validerEtape1();
    } else if (e === 1) {
      await this.validerEtape2();
    } else {
      await this.validerEtape3();
    }
  }

  private async validerEtape1(): Promise<void> {
    if (this.prenom().trim() === '' || this.nom().trim() === '') {
      this.toast.info(tr('pwaPrenomNomRequis', 'Prénom et nom sont requis.'));
      return;
    }
    const email = this.email().trim();
    if (email === '' || !email.includes('@')) {
      this.toast.info(tr('pwaEmailInvalide', 'Adresse e-mail invalide.'));
      return;
    }

    // Le verdict fixe la procédure (voir `sansEmailInstitutionnel`) ; il ne refuse
    // plus personne. Seule une adresse gérée par Google, qui doit passer par le
    // bouton Google, est arrêtée plus bas, à l'envoi.
    await this.verdictDomaine(email);

    this.auth.savePersonalInfo(email, this.nom().trim(), this.prenom().trim());
    this.etape.set(1);
  }

  private async validerEtape2(): Promise<void> {
    if (!this.universiteId() || !this.filiereId() || !this.niveau()) {
      this.toast.info(tr('pwaCompleteParcours', 'Complète ton parcours avant de continuer.'));
      return;
    }
    if (this.modeGoogle()) {
      await this.terminerInscriptionGoogle();
      return;
    }
    this.auth.saveAcademicInfo(this.universiteNom()!, this.filiereNom()!, this.niveau()!, this.cycle());

    if (this.sansEmailInstitutionnel()) {
      this.etape.set(2);
      return;
    }
    await this.soumettreInscription();
  }

  private async terminerInscriptionGoogle(): Promise<void> {
    this.chargement.set(true);
    try {
      const erreur = await this.auth.inscriptionGoogle({
        universite: this.universiteNom()!,
        filiere: this.filiereNom()!,
        niveau: niveauCourt(this.niveau()!),
        ...(this.cycle() ? { cycle: cycleVersApi(this.cycle()!) } : {}),
      });
      // Compte créé : `AuthService` a déjà aiguillé vers le choix du PIN.
      if (erreur) this.toast.erreur(erreur);
    } finally {
      this.chargement.set(false);
    }
  }

  private async validerEtape3(): Promise<void> {
    if (!this.justificatifType()) {
      this.toast.info(tr('pwaChoisisTypeDocument', 'Choisis un type de document.'));
      return;
    }
    const fichier = this.justificatifFichier();
    if (!fichier) {
      this.toast.info(tr('registerJoinsJustificatif', 'Joins ton justificatif.'));
      return;
    }
    const bytes = new Uint8Array(await fichier.arrayBuffer());
    this.auth.saveJustificatif({
      type: this.justificatifType()!,
      bytes,
      fileName: fichier.name,
      matricule: this.matricule().trim() === '' ? undefined : this.matricule().trim(),
    });
    await this.soumettreInscription();
  }

  private async soumettreInscription(): Promise<void> {
    this.chargement.set(true);
    try {
      const ok = await this.auth.register(this.sansEmailInstitutionnel());
      if (ok) {
        void this.router.navigateByUrl('/app/' + AppRoutes.otp);
      } else if (this.auth.codeErreurInscription() === 'use_google_auth') {
        // Le serveur tient la règle : cette adresse passe par Google. L'écran
        // bascule dans l'état « adresse Google » (code masqué, bouton mis en
        // avant) au lieu de laisser l'étudiant devant une erreur.
        this.domaine.set({ etat: EtatDomaine.reconnu, google: true });
        this.etape.set(0);
        this.toast.erreur(this.auth.state().error ?? 'Cette adresse est gérée par Google.');
      } else {
        this.toast.erreur(this.auth.state().error ?? "Erreur lors de l'inscription");
      }
    } finally {
      this.chargement.set(false);
    }
  }

  protected precedent(): void {
    if (this.modeGoogle()) {
      // On renonce : l'identité Google en attente est oubliée, rien n'a été créé.
      this.auth.abandonnerInscriptionGoogle();
      void this.router.navigate(['/app', AppRoutes.login]);
      return;
    }
    if (this.etape() > 0) {
      this.etape.set(this.etape() - 1);
    } else {
      void this.router.navigate(['/app', AppRoutes.onboarding]);
    }
  }

  protected allerConnexion(): void {
    void this.router.navigate(['/app', AppRoutes.login]);
  }

  private messageErreur(e: unknown): string {
    return e instanceof Failure ? e.message : 'Chargement impossible.';
  }
}
