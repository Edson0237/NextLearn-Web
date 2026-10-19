import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { AnimatedNumber } from '../../../shared/ui/animated-number/animated-number';
import { ProgressionRepository } from '../../../core/progression/progression-repository';
import { ProgressionStats, DayActivity, MatiereActivity, BadgeModel, StudySession } from '../../../core/progression/progression.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-progression-dashboard',
  standalone: true,
  imports: [CommonModule, Icon, AnimatedNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progression-dashboard.html',
  styleUrl: './progression-dashboard.scss',
})
export class ProgressionDashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly progressionRepo = inject(ProgressionRepository);

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

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.home]);
  }

  protected formatMinutes(m: number): string {
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }

  protected formatDuration(secondes: number): string {
    return this.formatMinutes(Math.round(secondes / 60));
  }

  protected barHeight(minutes: number, max: number): string {
    if (max <= 0) return '0%';
    return `${Math.min(100, Math.round((minutes / max) * 100))}%`;
  }
}
