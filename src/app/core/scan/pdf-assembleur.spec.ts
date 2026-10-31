import { describe, expect, it } from 'vitest';
import { assemblerPdf } from './pdf-assembleur';

const jpeg = (n: number) => new Uint8Array([0xff, 0xd8, ...Array.from({ length: n }, (_, i) => i % 250), 0xff, 0xd9]);
const texte = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

describe('assemblerPdf', () => {
  it('écrit un PDF valide : en-tête, une page par image, fin de fichier', () => {
    const pdf = assemblerPdf([
      { octets: jpeg(50), largeur: 600, hauteur: 800 },
      { octets: jpeg(70), largeur: 800, hauteur: 600 },
    ]);
    const t = texte(pdf);
    expect(t.startsWith('%PDF-1.4')).toBe(true);
    expect(t.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(t).toContain('/Count 2');
    expect(t).toContain('/MediaBox [0 0 600 800]');
    expect(t).toContain('/MediaBox [0 0 800 600]');
    expect((t.match(/\/DCTDecode/g) ?? []).length).toBe(2);
  });

  it('place chaque objet exactement là où la table de références le dit', () => {
    const pdf = assemblerPdf([{ octets: jpeg(123), largeur: 100, hauteur: 200 }]);
    const t = texte(pdf);
    const xref = t.indexOf('xref\n');
    const entrees = [...t.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(entrees.length).toBe(5);
    entrees.forEach((pos, i) => expect(t.slice(pos, pos + 8)).toContain(`${i + 1} 0 obj`));
    expect(Number(/startxref\n(\d+)/.exec(t)![1])).toBe(xref);
  });

  it('refuse un document sans page', () => {
    expect(() => assemblerPdf([])).toThrow();
  });
});
