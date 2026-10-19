export interface QuizQuestion {
  readonly id: string;
  readonly enonce: string;
  readonly options: string[];
}

export interface QuizModel {
  readonly id: string;
  readonly documentId?: string;
  readonly titre: string;
  readonly questions: QuizQuestion[];
}

export interface QuizSubmitResult {
  readonly score: number;
  readonly total: number;
  readonly bonnesReponses: number;
}

export function quizDepuisApi(json: Record<string, unknown>): QuizModel {
  const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));
  const questions = Array.isArray(json['questions'])
    ? (json['questions'] as Record<string, unknown>[]).map((q) => ({
        id: texte(q['id'] ?? q['_id']),
        enonce: texte(q['enonce'] ?? q['question']),
        options: Array.isArray(q['options']) ? (q['options'] as unknown[]).map(String) : [],
      }))
    : [];
  return {
    id: texte(json['id'] ?? json['_id']),
    documentId: json['documentId'] == null ? undefined : String(json['documentId']),
    titre: texte(json['titre']),
    questions,
  };
}

export function resultatQuizDepuisApi(json: Record<string, unknown>): QuizSubmitResult {
  const nombre = (v: unknown): number => (typeof v === 'number' ? v : 0);
  return {
    score: nombre(json['score']),
    total: nombre(json['total']),
    bonnesReponses: nombre(json['bonnesReponses']),
  };
}
