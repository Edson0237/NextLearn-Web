import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ProfilRepository } from '../../../core/profil/profil-repository';
import { ProfilStats } from '../../../core/profil/profil.model';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { AnimatedNumber } from '../../../shared/ui/animated-number/animated-number';
import { Icon } from '../../../shared/ui/icon/icon';
import { SettingsList } from '../settings-list/settings-list';
import { Failure } from '../../../core/models/failure.model';
import { nomComplet, initiales, libelleNiveau } from '../../../core/models/user.model';
import { FeuilleActionService, ActionOption } from '../../../shared/ui/bottom-sheet/feuille-action';

/**
 * Onglet Profil — traduction de `ProfilHomePage`
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
  imports: [Avatar, AnimatedNumber, Icon, SettingsList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profil-home.html',
  styleUrl: './profil-home.scss',
})
export class ProfilHome {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ProfilRepository);
  private readonly actions = inject(FeuilleActionService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('avatarInput');

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

  constructor() {
    void this.chargerStats();
  }

  private async chargerStats(): Promise<void> {
    this.statutStats.set('chargement');
    try {
      const stats = await this.repo.getStats();
      this.stats.set(stats);
      this.statutStats.set('pret');
    } catch (e) {
      this.erreurStats.set(e instanceof Failure ? e.message : 'Chargement impossible.');
      this.statutStats.set('erreur');
    }
  }

  protected async ouvrirChoixPhoto(): Promise<void> {
    const aPhoto = !!this.user()?.avatarUrl;
    const options: ActionOption<string>[] = [
      { value: 'pick', label: aPhoto ? 'Modifier la photo' : 'Ajouter une photo', icon: 'photo_library' },
      ...(aPhoto ? [{ value: 'remove', label: 'Supprimer la photo', icon: 'delete', destructive: true } as ActionOption<string>] : []),
    ];
    const choix = await this.actions.choisir<string>({
      title: 'Photo de profil',
      options,
    });
    if (choix === 'pick') {
      this.fileInput().nativeElement.click();
    } else if (choix === 'remove') {
      await this.auth.supprimerAvatar();
    }
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) {
      // La limite de 5 Mo reproduit la validation « confort » du mobile.
      return;
    }
    await this.auth.changerAvatar(fichier);
  }
}
