import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { Button } from '../../../shared/ui/button/button';
import { VerificationRepository } from '../../../core/verification/verification-repository';
import { AuthService } from '../../../core/auth/auth.service';
import { JustificatifType, VerificationState } from '../../../core/verification/verification.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-verification-form',
  standalone: true,
  imports: [CommonModule, FormsModule, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verification-form.html',
  styleUrl: './verification-form.scss',
})
export class VerificationForm implements OnInit {
  private readonly router = inject(Router);
  private readonly verificationRepo = inject(VerificationRepository);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly types = signal<JustificatifType[]>([]);
  protected readonly status = signal<VerificationState | null>(null);

  protected readonly nom = signal('');
  protected readonly prenom = signal('');
  protected readonly matricule = signal('');
  protected readonly universite = signal('');
  protected readonly filiere = signal('');
  protected readonly niveau = signal('');
  protected readonly justificatifType = signal('');
  protected readonly file = signal<File | null>(null);

  async ngOnInit(): Promise<void> {
    const user = this.auth.state().user;
    if (user) {
      this.nom.set(user.nom);
      this.prenom.set(user.prenom);
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [types, status] = await Promise.all([
        this.verificationRepo.getJustificatifTypes().catch(() => []),
        this.verificationRepo.getMyStatus().catch(() => ({ statut: 'non_soumis' } as VerificationState)),
      ]);
      this.types.set(types);
      this.status.set(status);
    } finally {
      this.loading.set(false);
    }
  }

  protected onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const f = target.files?.[0] ?? null;
    this.file.set(f);
  }

  protected async submit(): Promise<void> {
    if (!this.nom().trim() || !this.prenom().trim() || !this.universite().trim() || !this.filiere().trim() || !this.niveau().trim() || !this.justificatifType() || !this.file()) {
      this.error.set('Veuillez remplir tous les champs et joindre un justificatif.');
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.verificationRepo.submit({
        nom: this.nom().trim(),
        prenom: this.prenom().trim(),
        matricule: this.matricule().trim() || undefined,
        universite: this.universite().trim(),
        filiere: this.filiere().trim(),
        niveau: this.niveau().trim(),
        justificatifType: this.justificatifType(),
        file: this.file()!,
      });
      void this.router.navigate(['/', AppRoutes.verificationPending]);
    } catch (e) {
      this.error.set('L\'envoi a échoué. Vérifiez le fichier et réessayez.');
    } finally {
      this.sending.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.profil]);
  }
}
