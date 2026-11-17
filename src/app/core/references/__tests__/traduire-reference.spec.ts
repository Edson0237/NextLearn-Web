import { describe, expect, it } from 'vitest';
import { estBrancheGenieCivil, estBrancheTroncCommun, traduireFiliere } from '../utils/traduire-reference';

describe('traduire-reference — Tronc commun & branches Ingénieur', () => {
  it('normalise les tirets et détecte TC et GC sans confusion avec Prépa IGC', () => {
    expect(traduireFiliere('Cycle Ingénieur — Tronc commun')).toBe('Cycle Ingénieur - Tronc commun');
    expect(estBrancheTroncCommun('Cycle Ingénieur — Tronc commun')).toBe(true);
    expect(estBrancheTroncCommun('Engineering Cycle - Common Core (TC)')).toBe(true);
    expect(estBrancheTroncCommun('Cycle Ingénieur — Génie Civil (GC)')).toBe(false);

    expect(estBrancheGenieCivil('Cycle Ingénieur — Génie Civil (GC)', 'ingenieur')).toBe(true);
    expect(estBrancheGenieCivil('Ingénieur en Génie Civil (IGC)', 'prepa')).toBe(false);
    expect(estBrancheGenieCivil('Ingénieur en Génie Civil (IGC)')).toBe(false);
  });
});
