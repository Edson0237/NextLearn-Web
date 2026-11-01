// API publique de core/quiz : seulement ce que le reste de l'application consomme.

export { resultatQuizDepuisApi } from './models/quiz.model';
export type { QuizAnswerDetail, QuizModel, QuizQuestion, QuizSubmitResult } from './models/quiz.model';
export { QuizRepository } from './repositories/quiz-repository';
