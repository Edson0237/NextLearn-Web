import { AuthService } from '../../../core/auth';
import { TraductionService, tr } from '../../../core/i18n';
import { Cycle, libelleNiveau, niveauDepuisTexte, NiveauxDuCycle } from '../../../core/models';
import {
  estBrancheGenieCivil,
  estBrancheTroncCommun,
  traduireOptionReference,
  type FiliereOption,
} from '../../../core/references';
import { Fraicheur } from '../../../shared/services/fraicheur';
import { ActionOption, FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { ToastService } from '../../../shared/ui/toast/toast';

export interface ChangementNiveauDeps {
  readonly auth: AuthService;
  readonly actions: FeuilleActionService;
  readonly toast: ToastService;
  readonly fraicheur: Fraicheur;
  readonly traductions: TraductionService;
}

const CODES_CYCLE_SECOURS: Readonly<Record<Cycle, readonly string[]>> = {
  [Cycle.prepa]: ['N1', 'N2'],
  [Cycle.licence]: ['N1', 'N2', 'N3'],
  [Cycle.licencePro]: ['N1', 'N2', 'N3'],
  [Cycle.ingenieur]: ['N1', 'N2', 'N3', 'N4', 'N5'],
  [Cycle.master]: ['N4', 'N5'],
};

function libelleSecours(code: string, cycle?: Cycle): string {
  return libelleNiveau(niveauDepuisTexte(code), cycle);
}

function niveauxProposes(
  reponse: NiveauxDuCycle,
  cycle: Cycle | undefined,
  estGcDirect: boolean,
): readonly { code: string; label: string }[] {
  const autorise = (code: string) => !estGcDirect || ['N1', 'N2', 'N3'].includes(code.toUpperCase());

  if (reponse.niveaux.length > 0) {
    const filtres = reponse.niveaux.filter((n) => autorise(n.code));
    if (filtres.length > 0) {
      return filtres.map((n) => ({ code: n.code, label: traduireOptionReference(n.code, n.label) }));
    }
  }

  const base = (cycle && CODES_CYCLE_SECOURS[cycle]) ?? ['N1', 'N2', 'N3', 'N4', 'N5'];
  return base.filter(autorise).map((code) => ({ code, label: libelleSecours(code, cycle) }));
}

function doitChoisirSpecialite(
  estTcOrigine: boolean,
  niveauChoisi: string,
  filiereActuelle: string,
): boolean {
  if (!estTcOrigine) return false;
  const niv = niveauChoisi.toUpperCase();
  if (niv === 'N3') return true;
  if (niv === 'N4' || niv === 'N5') {
    return estBrancheTroncCommun(filiereActuelle) || estBrancheGenieCivil(filiereActuelle);
  }
  return false;
}

/**
 * Flux unifié de changement de niveau (partagé entre Profil et Réglages) :
 * - Cas 1/2 (ISI / SRT) : N1..N5 avec conservation de la filière d'origine ;
 * - Cas 3 (GC) : limité à N1..N3 ;
 * - Cas 4 (TC) : propose les spécialités disponibles (ISI, SRT, GC) lors du passage en N3+.
 */
export async function executerChangementNiveau(deps: ChangementNiveauDeps): Promise<void> {
  const u = deps.auth.state().user;
  if (!u) return;

  try {
    const res = await deps.auth.niveauxDuCycle();
    const estTcOrigine =
      estBrancheTroncCommun(u.filiere) || estBrancheTroncCommun(u.filiereOrigine);
    const estGcDirect = !estTcOrigine && estBrancheGenieCivil(u.filiere, u.cycle);

    const niveaux = niveauxProposes(res, u.cycle, estGcDirect);
    const estEn = deps.traductions.langue() === 'en';
    const suffixeActuel = estEn ? ' (Current)' : ' (Actuel)';
    const niveauActuel = (u.niveau ?? '').toUpperCase();

    const options: ActionOption<string>[] = niveaux.map((n) => ({
      value: n.code,
      label: n.label + (n.code.toUpperCase() === niveauActuel ? suffixeActuel : ''),
      icon: n.code.toUpperCase() === niveauActuel ? 'check' : 'school',
    }));

    const choix = await deps.actions.choisir<string>({
      title: tr('pwaChangerNiveau', 'Changer de niveau'),
      options,
    });
    if (!choix) return;

    const choixNorm = choix.toUpperCase();
    const nomNiveau = niveaux.find((n) => n.code.toUpperCase() === choixNorm)?.label ?? choix;

    if (doitChoisirSpecialite(estTcOrigine, choixNorm, u.filiere)) {
      const filieres: readonly FiliereOption[] =
        typeof deps.auth.filieresPourNiveau === 'function'
          ? await deps.auth.filieresPourNiveau(choixNorm)
          : [];

      if (filieres.length > 0) {
        const suffixeFiliere = estEn ? ' (Current)' : ' (Actuelle)';
        const filiereChoisie = await deps.actions.choisir<string>({
          title: tr('pwaChoisirSpecialite', 'Choisir une spécialité'),
          options: filieres.map((f) => {
            const courante = f.nom === u.filiere && choixNorm === niveauActuel;
            return {
              value: f.nom,
              label: f.libelle + (courante ? suffixeFiliere : ''),
              icon: courante ? 'check' : 'school',
            };
          }),
        });
        if (!filiereChoisie) return;
        if (choixNorm === niveauActuel && filiereChoisie === u.filiere) return;

        const err = await deps.auth.changerNiveau(choix, filiereChoisie);
        if (err) {
          deps.toast.erreur(err);
        } else {
          deps.toast.succes(
            tr('niveauMisAJour', `Niveau mis à jour : ${nomNiveau}. Les cours sont adaptés.`, {
              niveau: nomNiveau,
            }),
          );
          deps.fraicheur.tick();
        }
        return;
      }
    }

    if (choixNorm === niveauActuel && (!estTcOrigine || estBrancheTroncCommun(u.filiere))) {
      return;
    }

    const err = await deps.auth.changerNiveau(choix);
    if (err) {
      deps.toast.erreur(err);
    } else {
      deps.toast.succes(
        tr('niveauMisAJour', `Niveau mis à jour : ${nomNiveau}. Les cours sont adaptés.`, {
          niveau: nomNiveau,
        }),
      );
      deps.fraicheur.tick();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '';
    deps.toast.erreur(message || 'Impossible de changer le niveau.');
  }
}
