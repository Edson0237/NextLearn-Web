import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { BottomSheetShell } from '../../../shared/ui/bottom-sheet/shell/bottom-sheet-shell';
import { Icon } from '../../../shared/ui/icon/icon';
import { TraductionPipe, TraductionService } from '../../../core/i18n';
import { HapticService } from '../../../shared/services/haptic';
import { DocumentType, Facettes, ValeurFacette, codeFacetteString } from '../../../core/bibliotheque';
import { SectionAcademique } from '../../../core/models';

export interface FiltresSheetSelection {
  readonly type: DocumentType | null;
  readonly typeEpreuve: string | null;
  readonly semestre: string | null;
  readonly matiere: string | null;
  readonly enseignant: string | null;
  readonly annee: string | null;
  readonly section: SectionAcademique | null;
  readonly avecCorrige: boolean | null;
}

export interface FiltresSheetData {
  readonly formats: readonly { type: DocumentType | null; label: string }[];
  readonly matieres: readonly { id: string; nom: string }[];
  readonly facettes?: Facettes | null;
  readonly type: DocumentType | null;
  readonly typeEpreuve?: string | null;
  readonly semestre?: string | null;
  readonly matiere: string | null;
  readonly enseignant?: string | null;
  readonly annee?: string | null;
  readonly section: SectionAcademique | null;
  readonly avecCorrige?: boolean | null;
  /** Combien de documents donnerait cette combinaison - pour le bouton et les puces. */
  readonly compter: (
    type: DocumentType | null,
    matiere: string | null,
    section: SectionAcademique | null,
  ) => number;
}

/** Ce que la feuille rend : une sélection, ou l'envoi vers le catalogue. */
export type FiltresSheetResultat = FiltresSheetSelection | 'catalogue';

/**
 * Le panneau « Filtres » de la bibliothèque (Chantier P5 : Catalogue v2 / Explorer).
 * Inclut Format, Nature d'épreuve (SN/CC/Rattrapage), Semestre, Matière (recherchable),
 * Professeur (recherchable), Année académique, Section et Avec corrigé.
 */
@Component({
  selector: 'nl-filtres-sheet',
  standalone: true,
  imports: [BottomSheetShell, Icon, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filtres-sheet.html',
  styleUrl: './filtres-sheet.scss',
})
export class FiltresSheet {
  private readonly haptic = inject(HapticService);
  protected readonly ref = inject(BottomSheetRef<FiltresSheetResultat>);
  protected readonly data = inject(BOTTOM_SHEET_DATA) as FiltresSheetData;

  protected readonly type = signal<DocumentType | null>(this.data.type);
  protected readonly typeEpreuve = signal<string | null>(this.data.typeEpreuve ?? null);
  protected readonly semestre = signal<string | null>(this.data.semestre ?? null);
  protected readonly matiere = signal<string | null>(this.data.matiere);
  protected readonly enseignant = signal<string | null>(this.data.enseignant ?? null);
  protected readonly annee = signal<string | null>(this.data.annee ?? null);
  protected readonly section = signal<SectionAcademique | null>(this.data.section);
  protected readonly avecCorrige = signal<boolean | null>(this.data.avecCorrige ?? null);

  protected readonly rechercheMatiere = signal('');
  protected readonly rechercheEnseignant = signal('');

  private readonly traductions = inject(TraductionService);

  protected readonly sections = computed<{ value: SectionAcademique | null; label: string }[]>(() => {
    this.traductions.langue();
    return [
      { value: null, label: this.traductions.t('epreuveTypeTous', undefined, 'Tous') },
      { value: 'FRANCOPHONE', label: this.traductions.t('sectionFrancophone', undefined, 'Francophone') },
      { value: 'ANGLOPHONE', label: this.traductions.t('sectionAnglophone', undefined, 'Anglophone') },
    ];
  });

  protected readonly facettesNature = computed<readonly ValeurFacette[]>(() =>
    (this.data.facettes?.typeEpreuve ?? []).filter((f) => codeFacetteString(f) !== null),
  );

  protected readonly facettesSemestre = computed<readonly ValeurFacette[]>(() =>
    (this.data.facettes?.semestre ?? []).filter((f) => codeFacetteString(f) !== null),
  );

  protected readonly facettesAnnee = computed<readonly ValeurFacette[]>(() =>
    (this.data.facettes?.annee ?? []).filter((f) => codeFacetteString(f) !== null),
  );

  protected readonly facettesCorrige = computed<readonly ValeurFacette[]>(() =>
    (this.data.facettes?.avecCorrige ?? []).filter((f) => typeof f.valeur === 'boolean'),
  );

  protected readonly optionsMatieres = computed<{ id: string; nom: string; n?: number }[]>(() => {
    const q = this.rechercheMatiere().trim().toLowerCase();
    const fac = (this.data.facettes?.matiere ?? []).filter((f) => codeFacetteString(f) !== null);
    const liste =
      fac.length > 0
        ? fac.map((f) => ({ id: codeFacetteString(f)!, nom: this.libelleFacette(f), n: f.n }))
        : this.data.matieres.map((m) => ({ id: m.id, nom: m.nom, n: this.compteMatiere(m.id) }));
    if (!q) return liste;
    return liste.filter((m) => m.nom.toLowerCase().includes(q));
  });

  protected readonly optionsEnseignants = computed<{ id: string; nom: string; n: number }[]>(() => {
    const q = this.rechercheEnseignant().trim().toLowerCase();
    const fac = (this.data.facettes?.enseignant ?? []).filter((f) => codeFacetteString(f) !== null);
    const liste = fac.map((f) => ({ id: codeFacetteString(f)!, nom: this.libelleFacette(f), n: f.n }));
    if (!q) return liste;
    return liste.filter((e) => e.nom.toLowerCase().includes(q));
  });

  protected readonly total = computed(() =>
    this.data.compter(this.type(), this.matiere(), this.section()),
  );

  protected readonly modifie = computed(
    () =>
      this.type() !== null ||
      this.typeEpreuve() !== null ||
      this.semestre() !== null ||
      this.matiere() !== null ||
      this.enseignant() !== null ||
      this.annee() !== null ||
      this.section() !== null ||
      this.avecCorrige() !== null,
  );

  protected codeFacette(f: ValeurFacette): string | null {
    return codeFacetteString(f);
  }

  protected libelleFacette(f: ValeurFacette): string {
    return this.traductions.langue() === 'en' ? (f.labelEn || f.label) : f.label;
  }

  /** Le compte d'une puce de format, la matière et la section du brouillon étant appliquées. */
  protected compteFormat(type: DocumentType | null): number {
    if (type !== null && this.data.facettes?.type?.length) {
      const f = this.data.facettes.type.find(
        (x) => (codeFacetteString(x) ?? '').toLowerCase() === String(type).toLowerCase(),
      );
      if (f) return f.n;
    }
    return this.data.compter(type, this.matiere(), this.section());
  }

  protected compteMatiere(id: string | null): number {
    if (id !== null && this.data.facettes?.matiere?.length) {
      const f = this.data.facettes.matiere.find((x) => codeFacetteString(x) === id);
      if (f) return f.n;
    }
    return this.data.compter(this.type(), id, this.section());
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected choisirSection(s: SectionAcademique | null): void {
    this.haptic.selection();
    this.section.set(s);
  }

  protected choisirType(t: DocumentType | null): void {
    this.haptic.selection();
    this.type.set(t);
  }

  protected choisirTypeEpreuve(code: string | null): void {
    this.haptic.selection();
    this.typeEpreuve.set(this.typeEpreuve() === code ? null : code);
  }

  protected choisirSemestre(code: string | null): void {
    this.haptic.selection();
    this.semestre.set(this.semestre() === code ? null : code);
  }

  protected choisirMatiere(id: string | null): void {
    this.haptic.selection();
    this.matiere.set(id);
  }

  protected choisirEnseignant(id: string | null): void {
    this.haptic.selection();
    this.enseignant.set(this.enseignant() === id ? null : id);
  }

  protected choisirAnnee(code: string | null): void {
    this.haptic.selection();
    this.annee.set(this.annee() === code ? null : code);
  }

  protected choisirAvecCorrige(val: boolean | null): void {
    this.haptic.selection();
    this.avecCorrige.set(this.avecCorrige() === val ? null : val);
  }

  protected reinitialiser(): void {
    this.type.set(null);
    this.typeEpreuve.set(null);
    this.semestre.set(null);
    this.matiere.set(null);
    this.enseignant.set(null);
    this.annee.set(null);
    this.section.set(null);
    this.avecCorrige.set(null);
    this.rechercheMatiere.set('');
    this.rechercheEnseignant.set('');
  }

  protected appliquer(): void {
    this.ref.close({
      type: this.type(),
      typeEpreuve: this.typeEpreuve(),
      semestre: this.semestre(),
      matiere: this.matiere(),
      enseignant: this.enseignant(),
      annee: this.annee(),
      section: this.section(),
      avecCorrige: this.avecCorrige(),
    });
  }

  protected versCatalogue(): void {
    this.ref.close('catalogue');
  }
}
