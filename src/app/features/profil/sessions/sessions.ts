import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { SessionAppareil, SessionRepository } from '../../../core/profil/session-repository';
import { Failure } from '../../../core/models/failure.model';

/**
 * Sessions / appareils connectés — traduction de `SessionsPage`
 * (`lib/domains/profil/presentation/pages/sessions/sessions_page.dart`).
 */
@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions implements OnInit {
  private readonly location = inject(Location);
  private readonly repo = inject(SessionRepository);
  private readonly toast = inject(ToastService);
  private readonly actions = inject(FeuilleActionService);

  protected readonly sessions = signal<SessionAppareil[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal<string | undefined>(undefined);

  ngOnInit(): void {
    void this.charger();
  }

  protected async charger(): Promise<void> {
    this.chargement.set(true);
    this.erreur.set(undefined);
    try {
      const liste = await this.repo.lister();
      this.sessions.set(liste);
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Chargement impossible.');
    } finally {
      this.chargement.set(false);
    }
  }

  protected async revoquer(session: SessionAppareil): Promise<void> {
    if (session.courante) return;
    const confirme = await this.actions.confirmer({
      title: 'Déconnecter cet appareil ?',
      description: `Tu vas fermer la session « ${session.appareil} ».`,
      confirmLabel: 'Déconnecter',
      destructive: true,
    });
    if (!confirme) return;
    try {
      await this.repo.revoquer(session.sessionId);
      this.toast.succes('Session fermée.');
      await this.charger();
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Action impossible.');
    }
  }

  protected async revoquerLesAutres(): Promise<void> {
    const confirme = await this.actions.confirmer({
      title: 'Déconnecter les autres appareils ?',
      description: 'Toutes les sessions actives, sauf celle-ci, seront fermées.',
      confirmLabel: 'Déconnecter',
      destructive: true,
    });
    if (!confirme) return;
    try {
      const ferme = await this.repo.revoquerLesAutres();
      this.toast.succes(ferme > 0 ? `${ferme} session(s) fermée(s).` : 'Aucune autre session active.');
      await this.charger();
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Action impossible.');
    }
  }

  protected iconePour(session: SessionAppareil): string {
    const app = session.appareil.toLowerCase();
    if (app.includes('iphone') || app.includes('ios')) return 'mobile';
    if (app.includes('android') || app.includes('mobile')) return 'mobile';
    if (app.includes('web') || app.includes('chrome') || app.includes('safari') || app.includes('firefox')) return 'language';
    return 'devices_other';
  }

  protected formatDate(date?: Date): string {
    if (!date) return '';
    try {
      return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
    } catch {
      return date.toLocaleString('fr-FR');
    }
  }

  protected retour(): void {
    this.location.back();
  }
}
