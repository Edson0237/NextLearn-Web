// API publique de core/router : seulement ce que le reste de l'application consomme.

export { authGuard } from './guards/auth.guard';
export { AppRoutes } from './routes/app-routes';
export { HistoriqueNavigation } from './services/historique-navigation';
export { TabReuseStrategy } from './strategies/tab-reuse-strategy';
