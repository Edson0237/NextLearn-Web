import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { Button } from '../../../shared/ui/button/button';
import { QuizRepository } from '../../../core/quiz/quiz-repository';
import { QuizModel, QuizQuestion, QuizSubmitResult } from '../../../core/quiz/quiz.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-quiz-session',
  standalone: true,
  imports: [CommonModule, Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-session.html',
  styleUrl: './quiz-session.scss',
})
export class QuizSession implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly quizRepo = inject(QuizRepository);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly quiz = signal<QuizModel | null>(null);
  protected readonly currentIndex = signal(0);
  protected readonly answers = signal<Record<string, number>>({});
  protected readonly submitting = signal(false);
  protected readonly result = signal<QuizSubmitResult | null>(null);
  protected readonly submitError = signal<string | null>(null);

  private startedAt = Date.now();

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.startedAt = Date.now();
    this.loading.set(true);
    try {
      const q = await this.quizRepo.getQuizById(id);
      this.quiz.set(q);
      if (!q) this.error.set('Quiz introuvable.');
    } catch (e) {
      this.error.set('Impossible de charger le quiz.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectAnswer(questionId: string, index: number): void {
    this.answers.update((map) => ({ ...map, [questionId]: index }));
  }

  protected next(): void {
    this.currentIndex.update((i) => Math.min(i + 1, (this.quiz()?.questions.length ?? 1) - 1));
  }

  protected previous(): void {
    this.currentIndex.update((i) => Math.max(0, i - 1));
  }

  protected async submit(): Promise<void> {
    const q = this.quiz();
    if (!q) return;
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const dureeSecondes = Math.round((Date.now() - this.startedAt) / 1000);
      const res = await this.quizRepo.submitQuiz(q.id, this.answers(), dureeSecondes);
      this.result.set(res);
    } catch (e) {
      this.submitError.set('L\'envoi du quiz a échoué.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected restart(): void {
    this.currentIndex.set(0);
    this.answers.set({});
    this.result.set(null);
    this.submitError.set(null);
    this.startedAt = Date.now();
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.home]);
  }
}
