import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-a-propos',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './a-propos.html',
  styleUrl: './a-propos.scss',
})
export class APropos {
  private readonly router = inject(Router);

  protected readonly equipe = [
    { nom: 'Marvin Tientcheu', role: 'Fondateur', competences: 'Vision produit, stratégie' },
    { nom: 'Giovanni Charles', role: 'Architecture', competences: 'Backend, infrastructure' },
    { nom: 'Mbouh Edson', role: 'Pédagogie', competences: 'Contenus, parcours étudiant' },
  ];

  protected readonly valeurs = [
    { nom: 'Accessibilité', texte: 'Des ressources accessibles au plus grand nombre.' },
    { nom: 'Innovation', texte: 'Des outils pensés pour simplifier l\'apprentissage.' },
    { nom: 'Communauté', texte: 'Une communauté d\'étudiants et d\'enseignants solidaire.' },
    { nom: 'Excellence', texte: 'Un contenu de qualité, relu et validé.' },
  ];

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.profil]);
  }
}
