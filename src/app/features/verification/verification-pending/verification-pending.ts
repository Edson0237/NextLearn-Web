import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { Button } from '../../../shared/ui/button/button';
import { VerificationRepository } from '../../../core/verification/verification-repository';
import { VerificationState } from '../../../core/verification/verification.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-verification-pending',
  standalone: true,
  imports: [CommonModule, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verification-pending.html',
  styleUrl: './verification-pending.scss',
})
export class VerificationPending implements OnInit {
  private readonly router = inject(Router);
  private readonly verificationRepo = inject(VerificationRepository);

  protected readonly loading = signal(true);
  protected readonly status = signal<VerificationState>({ statut: 'non_soumis' });

  async ngOnInit(): Promise<void> {
    try {
      const s = await this.verificationRepo.getMyStatus();
      this.status.set(s);
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.profil]);
  }

  protected newRequest(): void {
    void this.router.navigate(['/', AppRoutes.verificationForm]);
  }
}
