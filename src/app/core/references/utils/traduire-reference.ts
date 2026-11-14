import { langueCourante } from '../../i18n';

const CYCLES_EN: Readonly<Record<string, string>> = {
  INGENIEUR: 'Engineering Cycle',
  LICENCE_PRO: 'Vocational Bachelor',
  LICENCE: 'Bachelor',
  MASTER: 'Master',
  PREPA: 'Preparatory Cycle',
  'Cycle Ingénieur': 'Engineering Cycle',
  'Licence Professionnelle': 'Vocational Bachelor',
  'Licence Pro': 'Vocational Bachelor',
  Licence: 'Bachelor',
  Master: 'Master',
  'Cycle préparatoire': 'Preparatory Cycle',
  'Classes Préparatoires': 'Preparatory Classes',
  Prépa: 'Prep',
};

const FILIERES_EN: Readonly<Record<string, string>> = {
  'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)':
    'Engineering Cycle — Systems, Networks & Telecoms (SRT)',
  'Cycle Ingénieur — Ingénierie des Systèmes d’Information (ISI)':
    'Engineering Cycle — Information Systems Engineering (ISI)',
  'Cycle Ingénieur — Génie Civil (GC)':
    'Engineering Cycle — Civil Engineering (GC)',
  'Licence Professionnelle — Conception et Développement d’Applications pour l’Économie Numérique':
    'Vocational Bachelor — Application Design & Development for the Digital Economy',
  'Master — Sécurité des Systèmes d’Information (SSI)':
    'Master — Information Systems Security (SSI)',
  'Master — Data Science': 'Master — Data Science',
  'Licence — Gestion': 'Bachelor — Management',
  'Licence — Finance': 'Bachelor — Finance',
  'Licence — Marketing': 'Bachelor — Marketing',
  'Master — Gestion': 'Master — Management',
  'Master — Finance': 'Master — Finance',
  'Master — Marketing': 'Master — Marketing',
  'Ingénieur Généraliste (InGé)': 'General Engineering (InGé)',
  'Ingénieur Généraliste (orientation internationale)':
    'General Engineering (International Track)',
  'Ingénieur Généraliste (orientation nationale)':
    'General Engineering (National Track)',
  'Ingénieur en Géosciences, Environnement et Agro-Industrie (IGEA)':
    'Engineering in Geosciences, Environment & Agro-Industry (IGEA)',
  'Ingénieur en Génie Civil (IGC)': 'Civil Engineering (IGC)',
  'Ingénieur Génie Civil': 'Civil Engineering',
  'Management et Finance (M&F)': 'Management & Finance (M&F)',
  'Management et Finance': 'Management & Finance',
  'Sciences Politiques et Humanités (SPH)': 'Political Science & Humanities (SPH)',
  'Scientifique intensive': 'Intensive Science',
  'Tronc Commun': 'Common Core',
  'Génie Logiciel': 'Software Engineering',
  'Réseaux et Télécommunications': 'Networks & Telecommunications',
  'Intelligence Artificielle': 'Artificial Intelligence',
  'Cybersécurité': 'Cybersecurity',
};

const OPTIONS_EN: Readonly<Record<string, string>> = {
  ...CYCLES_EN,
  SN: 'Regular session',
  'Session normale': 'Regular session',
  CC: 'Continuous assessment',
  'Contrôle continu': 'Continuous assessment',
  RATTRAPAGE: 'Resit exam',
  Rattrapage: 'Resit exam',
  COURS: 'Lectures',
  Cours: 'Lectures',
  TD: 'Tutorials (TD)',
  TP: 'Lab (TP)',
  SYNTHESE: 'Summary',
  Synthèse: 'Summary',
  EPREUVE: 'Exam',
  Épreuve: 'Exam',
  ANNALES: 'Past papers',
  Annales: 'Past papers',
  CORRIGE: 'Answer key',
  Corrigé: 'Answer key',
  RAPPORT: 'Report',
  Rapport: 'Report',
  EXPOSE: 'Presentation',
  Exposé: 'Presentation',
  AUTRE: 'Document',
};

const JUSTIFICATIFS_EN: Readonly<Record<string, { label: string; description?: string }>> = {
  CARTE_ETUDIANT: {
    label: 'Student ID card',
    description: 'Photo or scan of your valid student card',
  },
  CERTIFICAT_SCOLARITE: {
    label: 'Enrollment certificate',
    description: 'Official school enrollment certificate for the current year',
  },
  RECU_PAIEMENT: {
    label: 'Tuition receipt',
    description: 'Official tuition payment receipt from your institution',
  },
  ATTESTATION_INSCRIPTION: {
    label: 'Registration attestation',
    description: 'Document confirming your registration for the academic year',
  },
};

export function traduireFiliere(nom: string): string {
  if (!nom || langueCourante() !== 'en') return nom;
  const exact = FILIERES_EN[nom.trim()];
  if (exact) return exact;
  return nom
    .replace(/^Cycle Ingénieur\b/i, 'Engineering Cycle')
    .replace(/^Licence Professionnelle\b/i, 'Vocational Bachelor')
    .replace(/^Licence Pro\b/i, 'Vocational Bachelor')
    .replace(/^Licence\b/i, 'Bachelor')
    .replace(/^Cycle préparatoire\b/i, 'Preparatory Cycle')
    .replace(/^Ingénieur\b/i, 'Engineering')
    .replace(/\bGénie Civil\b/gi, 'Civil Engineering')
    .replace(/\bGestion\b/gi, 'Management');
}

export function traduireOptionReference(value: string, label: string): string {
  if (langueCourante() !== 'en') return label;
  const exact = OPTIONS_EN[label.trim()] ?? OPTIONS_EN[value.trim().toUpperCase()];
  if (exact) return exact;

  // Niveaux & semestres dynamiques (« Niveau 2 », « Ingénieur 3 », « Semestre 1 », « 1ère année »…)
  return label
    .replace(/^Niveau\s+(\d+)/i, 'Level $1')
    .replace(/^Ingénieur\s+(\d+)/i, 'Engineering $1')
    .replace(/^Licence Pro\s+(\d+)/i, 'Vocational Bachelor $1')
    .replace(/^Licence\s+(\d+)/i, 'Bachelor $1')
    .replace(/^Prépa\s+(\d+)/i, 'Prep $1')
    .replace(/^Semestre\s+(\d+)/i, 'Semester $1');
}

export function traduireJustificatif(
  value: string,
  label: string,
  description: string,
): { label: string; description: string } {
  if (langueCourante() !== 'en') return { label, description };
  const mapped = JUSTIFICATIFS_EN[value.trim().toUpperCase()];
  if (mapped) {
    return {
      label: mapped.label,
      description: mapped.description ?? description,
    };
  }
  return {
    label: label
      .replace(/Carte étudiante/i, 'Student ID card')
      .replace(/Certificat de scolarité/i, 'Enrollment certificate')
      .replace(/Reçu de paiement/i, 'Tuition receipt')
      .replace(/Attestation d['’]inscription/i, 'Registration attestation'),
    description,
  };
}
