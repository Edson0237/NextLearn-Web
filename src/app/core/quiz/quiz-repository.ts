import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import { QuizModel, QuizSubmitResult, quizDepuisApi, resultatQuizDepuisApi } from './quiz.model';

@Injectable({ providedIn: 'root' })
export class QuizRepository {
  private readonly http = inject(HttpClient);

  async getQuizzesForDocument(documentId: string): Promise<QuizModel[]> {
    const reponse = await firstValueFrom(this.http.get('/api/quiz', { params: { documentId } }));
    const data = (reponse as Record<string, unknown>)?.['data'];
    const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    return raw.map(quizDepuisApi);
  }

  async getQuizById(id: string): Promise<QuizModel | null> {
    const reponse = await firstValueFrom(this.http.get(`/api/quiz/${id}`));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    if (!data) return null;
    return quizDepuisApi(data);
  }

  async submitQuiz(quizId: string, answers: Record<string, number>, dureeSecondes: number): Promise<QuizSubmitResult> {
    const payload = {
      answers: Object.entries(answers).map(([questionId, reponseIndex]) => ({ questionId, reponseIndex })),
      dureeSecondes,
    };
    const reponse = await firstValueFrom(this.http.post(`/api/quiz/${quizId}/submit`, payload));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    return resultatQuizDepuisApi(data ?? (reponse as Record<string, unknown>));
  }

  private echec(e: unknown): Failure {
    if (e instanceof Response) return new Failure('Erreur réseau.');
    return new Failure('Une erreur est survenue.');
  }
}
