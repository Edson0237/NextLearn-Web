import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { Button } from '../../../shared/ui/button/button';
import { RecoursRepository } from '../../../core/recours/recours-repository';
import { EtatRecours, Recours, RecoursType } from '../../../core/recours/recours.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-recours-page',
  standalone: true,
  imports: [TraductionPipe, CommonModule, FormsModule, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recours-page.html',
  styleUrl: './recours-page.scss',
})
export class RecoursPage implements OnInit {
  private readonly router = inject(Router);
  private readonly recoursRepo = inject(RecoursRepository);

  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly etat = signal<EtatRecours | null>(null);
  protected readonly mesRecours = signal<Recours[]>([]);

  protected readonly selectedType = signal<RecoursType | ''>('');
  protected readonly selectedCibleId = signal<string | undefined>(undefined);
  protected readonly motif = signal('');

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [etat, liste] = await Promise.all([
        this.recoursRepo.possibilites().catch(() => ({ delaiJours: 60, longueurMotifMinimale: 30, possibles: [] }) as EtatRecours),
        this.recoursRepo.mesRecours().catch(() => []),
      ]);
      this.etat.set(etat);
      this.mesRecours.set(liste);
    } catch (e) {
      this.error.set('Impossible de charger les recours.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectPossibilite(type: RecoursType, cibleId?: string): void {
    this.selectedType.set(type);
    this.selectedCibleId.set(cibleId);
  }

  protected async submit(): Promise<void> {
    const type = this.selectedType();
    const motif = this.motif().trim();
    const minimum = this.etat()?.longueurMotifMinimale ?? 30;
    if (!type) {
      this.error.set('Choisis la décision que tu contestes.');
      return;
    }
    if (motif.length < minimum) {
      this.error.set(`Explique ta contestation en au moins ${minimum} caractères (${motif.length} saisis).`);
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.recoursRepo.deposer(type, motif, this.selectedCibleId());
      this.selectedType.set('');
      this.motif.set('');
      await this.load();
    } catch (e) {
      // Le serveur sait pourquoi il refuse (recours déjà ouvert, délai dépassé…) :
      // son message vaut mieux qu'un « échec » générique.
      this.error.set((e as { message?: string })?.message || 'Le dépôt du recours a échoué.');
    } finally {
      this.sending.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  protected labelType(type: RecoursType): string {
    const labels: Record<RecoursType, string> = {
      verification: 'Rejet de dossier',
      suspension: 'Suspension de compte',
      depot: 'Refus de document',
    };
    return labels[type] ?? type;
  }

  protected labelStatut(statut: Recours['statut']): string {
    return { en_attente: 'En attente d’examen', en_revue: 'En cours d’examen', accepte: 'Accepté', rejete: 'Décision maintenue' }[statut] ?? statut;
  }
}
