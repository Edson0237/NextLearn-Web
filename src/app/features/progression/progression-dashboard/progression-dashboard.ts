import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { AnimatedNumber } from '../../../shared/ui/animated-number/animated-number';
import { AppHeader } from '../../../shared/ui/app-header/app-header';
import { AuthService } from '../../../core/auth';
import { libelleNiveau } from '../../../core/models/user.model';
import { ProgressionRepository } from '../../../core/progression/progression-repository';
import { ProgressionStats, DayActivity, MatiereActivity, BadgeModel, StudySession } from '../../../core/progression/progression.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-progression-dashboard',
  standalone: true,
  imports: [TraductionPipe, CommonModule, Icon, AnimatedNumber, AppHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progression-dashboard.html',
  styleUrl: './progression-dashboard.scss',
})
export class ProgressionDashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly progressionRepo = inject(ProgressionRepository);
  private readonly auth = inject(AuthService);

  protected readonly user = computed(() => this.auth.state().user);

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

  protected openProfil(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly stats = signal<ProgressionStats | null>(null);
  protected readonly week = signal<DayActivity[]>([]);
  protected readonly matieres = signal<MatiereActivity[]>([]);
  protected readonly badges = signal<BadgeModel[]>([]);
  protected readonly sessions = signal<StudySession[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [s, w, m, b, ses] = await Promise.all([
        this.progressionRepo.getStats(),
        this.progressionRepo.getWeekActivity().catch(() => []),
        this.progressionRepo.getMatiereActivity().catch(() => []),
        this.progressionRepo.getBadges().catch(() => []),
        this.progressionRepo.getRecentSessions().catch(() => []),
      ]);
      this.stats.set(s);
      this.week.set(w);
      this.matieres.set(m);
      this.badges.set(b);
      this.sessions.set(ses);
    } catch (e) {
      this.error.set('Impossible de charger la progression.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Les heures d'étude, arrondies au dixième - l'API compte en minutes. */
  protected heures(totalMinutes: number): number {
    return Math.round((totalMinutes / 60) * 10) / 10;
  }

  protected formatMinutes(m: number): string {
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }

  protected formatDuration(secondes: number): string {
    return this.formatMinutes(Math.round(secondes / 60));
  }

  /**
   * La journée la plus chargée de la semaine, en minutes.
   *
   * Les barres se mesuraient à un plafond fixe de 120 minutes : une semaine
   * à vingt minutes par jour donnait six traits écrasés en bas du cadre, et
   * une journée à trois heures était coupée au même ras que le plafond.
   */
  protected readonly picSemaine = computed(() =>
    Math.max(0, ...this.week().map((d) => d.minutes)),
  );

  /** La hauteur d'une barre, relative à la journée la plus chargée. */
  protected hauteurJour(minutes: number): string {
    const pic = this.picSemaine();
    if (pic <= 0) return '0%';
    // Un plancher visible : une journée à cinq minutes sur un pic de trois
    // heures ferait sinon une barre d'un pixel, indistincte d'un jour vide.
    return `${Math.max(6, Math.round((minutes / pic) * 100))}%`;
  }

  /** La part d'une matière dans le temps de la matière la plus travaillée. */
  protected partMatiere(minutes: number): string {
    const pic = Math.max(0, ...this.matieres().map((m) => m.minutes));
    if (pic <= 0) return '0%';
    return `${Math.max(4, Math.round((minutes / pic) * 100))}%`;
  }
}
