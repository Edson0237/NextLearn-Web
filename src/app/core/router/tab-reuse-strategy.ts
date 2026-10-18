import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, DetachedRouteHandle } from '@angular/router';

/**
 * Garde les cinq onglets montés — traduction de l'intention derrière
 * `StatefulShellRoute.indexedStack` (`app_router.dart`) : revenir sur un
 * onglet après un détour par un autre ne doit pas le ramener en haut ni
 * perdre sa sélection.
 *
 * Angular Router détruit et recrée un composant à chaque navigation par
 * défaut — il n'a pas d'équivalent intégré à l'arbre à onglets
 * `IndexedStack` de Flutter. Cette stratégie dit au routeur de **détacher**
 * la vue d'un onglet plutôt que de la détruire quand on le quitte, et de
 * la **réattacher** telle quelle quand on y revient.
 *
 * Portée aux cinq routes des onglets uniquement (`shouldDetach`) : le
 * reste de l'application (fiche document, lecteur, recherche…) garde le
 * comportement standard — une nouvelle fiche doit se reconstruire, pas
 * réafficher celle d'avant.
 */
const ROUTES_ONGLETS = new Set(['home', 'bibliotheque', 'epreuves', 'progression', 'depots', 'profil']);

function cheminDeBase(route: ActivatedRouteSnapshot): string | undefined {
  let r: ActivatedRouteSnapshot | null = route;
  while (r) {
    const segment = r.routeConfig?.path;
    if (segment && ROUTES_ONGLETS.has(segment)) return segment;
    r = r.parent;
  }
  return undefined;
}

export class TabReuseStrategy extends BaseRouteReuseStrategy {
  private readonly stockees = new Map<string, DetachedRouteHandle>();

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return cheminDeBase(route) !== undefined;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    const cle = cheminDeBase(route);
    if (cle) this.stockees.set(cle, handle);
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const cle = cheminDeBase(route);
    return !!cle && this.stockees.has(cle);
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const cle = cheminDeBase(route);
    return (cle ? this.stockees.get(cle) : undefined) ?? null;
  }

  // Deux routes du même onglet (ex. `bibliotheque` puis `bibliotheque`
  // après un aller-retour) sont la même route réutilisable ; le
  // comportement par défaut suffit pour tout le reste.
  override shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    curr: ActivatedRouteSnapshot,
  ): boolean {
    return super.shouldReuseRoute(future, curr);
  }
}
