import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, ElementRef } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { ProfilRepository } from '../../../core/profil';
import { StockageHorsLigne } from '../../../core/bibliotheque';
import { Fraicheur } from '../../../shared/services/fraicheur';
import { ProfilStats } from '../../../core/profil';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { AnimatedNumber } from '../../../shared/ui/animated-number/animated-number';
import { Icon } from '../../../shared/ui/icon/icon';
import { Badge } from '../../../shared/ui/badge/badge';
import { AppHeader } from '../../../shared/ui/app-header/app-header';
import { SettingsList } from '../settings-list/settings-list';
import { Failure } from '../../../core/models';
import { nomComplet, initiales, libelleNiveau, NiveauEtude } from '../../../core/models';
import { FeuilleActionService, ActionOption } from '../../../shared/ui/bottom-sheet/feuille-action';
import { AppRoutes } from '../../../core/router';
import { optimiserAvatar } from '../../../shared/services/image-optimiseur';
import { ToastService } from '../../../shared/ui/toast/toast';
import { ImageCropper } from '../../../shared/ui/image-cropper/image-cropper';

/**
 * Onglet Profil - traduction de `ProfilHomePage`
 * (`lib/domains/profil/presentation/pages/profil_home/profil_home_page.dart`).
 *
 * Comme dans la source récente, la liste des réglages est affichée
 * directement sous l'en-tête : le bouton « Paramètres » qui menait à une
 * page quasi identique a été retiré. La page dédiée (`ParametresPage`)
 * reste accessible pour les liens profonds et la navigation explicite.
 */
@Component({
  selector: 'app-profil-home',
  standalone: true,
  imports: [TraductionPipe, Avatar, AnimatedNumber, Icon, Badge, AppHeader, SettingsList, ImageCropper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profil-home.html',
  styleUrl: './profil-home.scss',
})
export class ProfilHome {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ProfilRepository);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly fraicheur = inject(Fraicheur);
  private readonly actions = inject(FeuilleActionService);
  private readonly toast = inject(ToastService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('avatarInput');

  protected readonly fichierACadrer = signal<File | null>(null);

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly nomComplet = computed(() => {
    const u = this.user();
    return u ? nomComplet(u) : '';
  });
  protected readonly initiales = computed(() => {
    const u = this.user();
    return u ? initiales(u) : '';
  });
  protected readonly libelleNiveau = computed(() => {
    const u = this.user();
    return u ? libelleNiveau(u.niveau, u.cycle) : '';
  });
  /** L'école et le niveau, pour la puce de contexte de l'en-tête. */
  protected readonly cursus = computed(() => {
    const u = this.user();
    if (!u) return undefined;
    return [u.universite, libelleNiveau(u.niveau)].filter(Boolean).join(' • ');
  });

  protected openNotifications(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.notifications);
  }

  protected openFavoris(): void {
    void this.router.navigate(['/app', AppRoutes.favoris]);
  }

  protected readonly libelleCycle = computed(() => {
    const u = this.user();
    if (!u || !u.cycle) return '';
    switch (u.cycle) {
      case 'prepa': return 'Prépa';
      case 'ingenieur': return 'Ingénieur';
      case 'licence': return 'Licence';
      case 'licencePro': return 'Licence Pro';
      case 'master': return 'Master';
      default: return '';
    }
  });

  protected readonly stats = signal<ProfilStats>({
    docsTelecharges: 0, docsLus: 0, heuresEtude: 0, streak: 0,
  });
  protected readonly statutStats = signal<'chargement' | 'pret' | 'erreur'>('chargement');
  protected readonly erreurStats = signal('');

  /**
   * Les documents hors ligne : ceux qui sont **réellement sur cet appareil**.
   *
   * Le chiffre venait du serveur (les documents marqués hors ligne, tous appareils
   * confondus), lu une fois à la création de l'écran - or le profil est un onglet
   * que le routeur garde monté : retirer un document de la section hors ligne ne
   * changeait rien ici. L'inventaire local est un signal, il suit sur-le-champ ;
   * le chiffre du serveur ne sert que quand le navigateur n'a pas de stockage local.
   */
  protected readonly horsLigne = computed(() =>
    this.stockage.disponible ? this.stockage.ids().size : this.stats().docsTelecharges,
  );

  constructor() {
    void this.stockage.rafraichir();
    void this.chargerStats();
    // Les autres chiffres (jours de suite, documents lus, heures) se relisent en silence
    // au retour dans l'application et quand l'inventaire change.
    let premier = true;
    effect(() => {
      this.fraicheur.tick();
      this.stockage.ids();
      untracked(() => {
        if (premier) { premier = false; return; }
        void this.chargerStats(true);
      });
    });
  }

  private async chargerStats(silencieux = false): Promise<void> {
    if (!silencieux) this.statutStats.set('chargement');
    try {
      const stats = await this.repo.getStats();
      this.stats.set(stats);
      this.statutStats.set('pret');
    } catch (e) {
      if (silencieux) return; // une relecture passagère ne remplace pas ce qui est affiché
      this.erreurStats.set(e instanceof Failure ? e.message : 'Chargement impossible.');
      this.statutStats.set('erreur');
    }
  }

  protected async ouvrirChoixPhoto(): Promise<void> {
    const aPhoto = !!this.user()?.avatarUrl;
    const options: ActionOption<string>[] = [
      { value: 'pick', label: aPhoto ? 'Modifier la photo' : 'Ajouter une photo', icon: 'photo_library' },
      ...(aPhoto ? [{ value: 'remove', label: tr('pwaSupprimerPhoto', 'Supprimer la photo'), icon: 'delete', destructive: true } as ActionOption<string>] : []),
    ];
    const choix = await this.actions.choisir<string>({
      title: tr('pwaPhotoProfil', 'Photo de profil'),
      options,
    });
    if (choix === 'pick') {
      this.fileInput().nativeElement.click();
    } else if (choix === 'remove') {
      const err = await this.auth.supprimerAvatar();
      if (err) {
        this.toast.erreur(err);
      } else {
        this.toast.info(tr('pwaSupprimerPhoto', 'Supprimer la photo') + ' : effectuée.');
      }
    }
  }

  protected async ouvrirChoixNiveau(): Promise<void> {
    const u = this.user();
    if (!u) return;
    try {
      const res = await this.auth.niveauxDuCycle();
      const niveaux = res.niveaux.length > 0
        ? res.niveaux
        : [
            { code: 'N1', label: libelleNiveau(NiveauEtude.n1, u.cycle) },
            { code: 'N2', label: libelleNiveau(NiveauEtude.n2, u.cycle) },
            { code: 'N3', label: libelleNiveau(NiveauEtude.n3, u.cycle) },
            { code: 'N4', label: libelleNiveau(NiveauEtude.n4, u.cycle) },
            { code: 'N5', label: libelleNiveau(NiveauEtude.n5, u.cycle) },
          ];

      const options: ActionOption<string>[] = niveaux.map((n) => ({
        value: n.code,
        label: n.label + (n.code === u.niveau ? ' (Actuel)' : ''),
        icon: n.code === u.niveau ? 'check' : 'school',
      }));

      const choix = await this.actions.choisir<string>({
        title: tr('pwaChangerNiveau', 'Changer de niveau'),
        options,
      });

      if (!choix || choix === u.niveau) return;

      const err = await this.auth.changerNiveau(choix);
      if (err) {
        this.toast.erreur(err);
      } else {
        const nomNiveau = niveaux.find((n) => n.code === choix)?.label ?? choix;
        this.toast.succes(`Niveau mis à jour : ${nomNiveau}. Les cours sont adaptés.`);
        this.fraicheur.tick();
      }
    } catch (e: any) {
      this.toast.erreur(e?.message || 'Impossible de changer le niveau.');
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    this.fichierACadrer.set(fichier);
  }

  protected async onCropped(fichierRecadre: File): Promise<void> {
    this.fichierACadrer.set(null);
    try {
      const err = await this.auth.changerAvatar(fichierRecadre);
      if (err) {
        this.toast.erreur(err);
      } else {
        this.toast.succes(tr('pwaPhotoProfil', 'Photo de profil') + ' mise à jour.');
      }
    } catch (e: any) {
      this.toast.erreur(e?.message || 'Impossible d’enregistrer la photo.');
    }
  }

  protected onCropCancelled(): void {
    this.fichierACadrer.set(null);
  }
}
