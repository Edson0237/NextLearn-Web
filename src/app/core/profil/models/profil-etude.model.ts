export type ObjectifEtude = 'reussir' | 'mention' | 'rattrapage' | 'perfectionnement';
export type LangueDocumentEtude = 'fr' | 'en';
export type FormatPrefereEtude = 'pdf' | 'docx';

export interface ManquantProfilEtude {
  readonly cle: string;
  readonly fr: string;
  readonly en: string;
}

export interface CompletudeProfilEtude {
  readonly pourcentage: number;
  readonly manquants: readonly ManquantProfilEtude[];
}

export interface CompteProfilEtude {
  readonly id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly universite: { readonly id: string | null; readonly nom: string };
  readonly filiere: { readonly id: string | null; readonly nom: string };
  readonly cycle: string | null;
  readonly niveau: string;
  readonly section: string | null;
  readonly langue: string;
  readonly verifie: boolean;
  readonly premium: boolean;
  readonly membreDepuis: string | null;
}

export interface EtudeProfilData {
  readonly matieresDifficiles: readonly { readonly id: string; readonly nom: string }[];
  readonly objectif: ObjectifEtude | null;
  readonly dateProchainExamen: string | null;
  readonly joursAvantExamen: number | null;
  readonly languesDocuments: readonly LangueDocumentEtude[];
  readonly formatsPreferes: readonly FormatPrefereEtude[];
  readonly economieDonnees: boolean;
  readonly rappels: { readonly actifs: boolean; readonly heure: string | null };
  readonly consentementSuivi: boolean | null;
}

export interface ProfilEtude {
  readonly compte: CompteProfilEtude;
  readonly etude: EtudeProfilData;
  readonly completude: CompletudeProfilEtude;
}

export interface ModificationProfilEtude {
  readonly matieresDifficiles?: readonly string[];
  readonly objectif?: ObjectifEtude | null;
  readonly dateProchainExamen?: string | null;
  readonly languesDocuments?: readonly LangueDocumentEtude[];
  readonly formatsPreferes?: readonly FormatPrefereEtude[];
  readonly economieDonnees?: boolean;
  readonly rappels?: { readonly actifs: boolean; readonly heure: string | null };
  readonly consentementSuivi?: boolean | null;
}

const CLES_MODIFICATION_AUTORISEES: ReadonlySet<string> = new Set([
  'matieresDifficiles',
  'objectif',
  'dateProchainExamen',
  'languesDocuments',
  'formatsPreferes',
  'economieDonnees',
  'rappels',
  'consentementSuivi',
]);

/** Filtre strictement le corps envoyé à `PUT /api/v2/me/profil-etude` (aucune clé inconnue). */
export function nettoyerModificationProfilEtude(
  modif: ModificationProfilEtude,
): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(modif)) {
    if (!CLES_MODIFICATION_AUTORISEES.has(cle) || valeur === undefined) continue;
    if (cle === 'rappels' && valeur && typeof valeur === 'object') {
      const r = valeur as { actifs?: unknown; heure?: unknown };
      sortie['rappels'] = {
        actifs: r.actifs === true,
        heure: typeof r.heure === 'string' && r.heure.trim() ? r.heure.trim() : null,
      };
      continue;
    }
    if (cle === 'matieresDifficiles' && Array.isArray(valeur)) {
      sortie['matieresDifficiles'] = valeur.map(String).filter(Boolean).slice(0, 15);
      continue;
    }
    sortie[cle] = valeur;
  }
  return sortie;
}

function texteOuNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function refNommee(v: unknown): { readonly id: string | null; readonly nom: string } {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return {
      id: texteOuNull(o['id'] ?? o['_id']),
      nom: String(o['nom'] ?? ''),
    };
  }
  return { id: null, nom: typeof v === 'string' ? v : '' };
}

export function profilEtudeDepuisApi(enveloppe: Record<string, unknown>): ProfilEtude {
  const data =
    enveloppe['data'] && typeof enveloppe['data'] === 'object' && !Array.isArray(enveloppe['data'])
      ? (enveloppe['data'] as Record<string, unknown>)
      : enveloppe;

  const cRaw =
    data['compte'] && typeof data['compte'] === 'object'
      ? (data['compte'] as Record<string, unknown>)
      : {};
  const eRaw =
    data['etude'] && typeof data['etude'] === 'object'
      ? (data['etude'] as Record<string, unknown>)
      : {};
  const compRaw =
    data['completude'] && typeof data['completude'] === 'object'
      ? (data['completude'] as Record<string, unknown>)
      : {};

  const matDiffRaw = Array.isArray(eRaw['matieresDifficiles'])
    ? (eRaw['matieresDifficiles'] as Record<string, unknown>[])
    : [];
  const matieresDifficiles = matDiffRaw
    .map((m) => ({
      id: String(m['id'] ?? m['_id'] ?? ''),
      nom: String(m['nom'] ?? ''),
    }))
    .filter((m) => m.id.length > 0 && m.nom.length > 0);

  const objBrut = eRaw['objectif'];
  const objectif: ObjectifEtude | null =
    objBrut === 'reussir' ||
    objBrut === 'mention' ||
    objBrut === 'rattrapage' ||
    objBrut === 'perfectionnement'
      ? objBrut
      : null;

  const languesRaw = Array.isArray(eRaw['languesDocuments']) ? eRaw['languesDocuments'] : [];
  const languesDocuments = languesRaw.filter(
    (l): l is LangueDocumentEtude => l === 'fr' || l === 'en',
  );

  const formatsRaw = Array.isArray(eRaw['formatsPreferes']) ? eRaw['formatsPreferes'] : [];
  const formatsPreferes = formatsRaw.filter(
    (f): f is FormatPrefereEtude => f === 'pdf' || f === 'docx',
  );

  const rappelsRaw =
    eRaw['rappels'] && typeof eRaw['rappels'] === 'object'
      ? (eRaw['rappels'] as Record<string, unknown>)
      : {};

  const manquantsRaw = Array.isArray(compRaw['manquants'])
    ? (compRaw['manquants'] as Record<string, unknown>[])
    : [];
  const manquants: ManquantProfilEtude[] = manquantsRaw
    .map((m) => ({
      cle: String(m['cle'] ?? ''),
      fr: String(m['fr'] ?? ''),
      en: String(m['en'] ?? m['fr'] ?? ''),
    }))
    .filter((m) => m.cle.length > 0);

  const pourcentage =
    typeof compRaw['pourcentage'] === 'number' && Number.isFinite(compRaw['pourcentage'])
      ? Math.max(0, Math.min(100, Math.round(compRaw['pourcentage'])))
      : 0;

  return {
    compte: {
      id: String(cRaw['id'] ?? ''),
      prenom: String(cRaw['prenom'] ?? ''),
      nom: String(cRaw['nom'] ?? ''),
      email: String(cRaw['email'] ?? ''),
      avatarUrl: texteOuNull(cRaw['avatarUrl']),
      universite: refNommee(cRaw['universite']),
      filiere: refNommee(cRaw['filiere']),
      cycle: texteOuNull(cRaw['cycle']),
      niveau: String(cRaw['niveau'] ?? ''),
      section: texteOuNull(cRaw['section']),
      langue: String(cRaw['langue'] ?? 'fr'),
      verifie: cRaw['verifie'] !== false,
      premium: cRaw['premium'] === true,
      membreDepuis: texteOuNull(cRaw['membreDepuis']),
    },
    etude: {
      matieresDifficiles,
      objectif,
      dateProchainExamen: texteOuNull(eRaw['dateProchainExamen']),
      joursAvantExamen:
        typeof eRaw['joursAvantExamen'] === 'number' && Number.isFinite(eRaw['joursAvantExamen'])
          ? Math.max(0, Math.round(eRaw['joursAvantExamen']))
          : null,
      languesDocuments,
      formatsPreferes,
      economieDonnees: eRaw['economieDonnees'] === true,
      rappels: {
        actifs: rappelsRaw['actifs'] === true,
        heure: texteOuNull(rappelsRaw['heure']),
      },
      consentementSuivi:
        typeof eRaw['consentementSuivi'] === 'boolean' ? eRaw['consentementSuivi'] : null,
    },
    completude: {
      pourcentage,
      manquants,
    },
  };
}
