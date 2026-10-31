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

/**
 * Le détail d'une réponse, tel que le serveur le renvoie après correction.
 *
 * C'est la seule source de la bonne réponse : elle est retirée des questions
 * envoyées avant la soumission, et ne revient qu'une fois le quiz rendu. Les
 * ignorer, comme le faisait la PWA, revenait à annoncer un score sans jamais
 * dire ce qui était faux - la partie qui fait apprendre.
 */
export interface QuizAnswerDetail {
  readonly questionId: string;
  readonly estCorrect: boolean;
  readonly bonneReponseIndex: number;
  readonly explication: string;
}

export interface QuizSubmitResult {
  readonly score: number;
  readonly totalQuestions: number;
  readonly details: readonly QuizAnswerDetail[];
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
  const brut = Array.isArray(json['details']) ? (json['details'] as Record<string, unknown>[]) : [];
  return {
    score: nombre(json['score']),
    // `totalQuestions`, et non `total` : la clé `total` n'existe pas dans la
    // réponse, le dénominateur affiché valait donc toujours zéro.
    totalQuestions: nombre(json['totalQuestions']),
    details: brut.map((d) => ({
      questionId: String(d['questionId'] ?? ''),
      estCorrect: d['estCorrect'] === true,
      bonneReponseIndex: typeof d['bonneReponseIndex'] === 'number' ? d['bonneReponseIndex'] : -1,
      explication: typeof d['explication'] === 'string' ? d['explication'] : '',
    })),
  };
}
