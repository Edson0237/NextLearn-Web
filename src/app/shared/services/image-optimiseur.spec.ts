import { describe, it, expect } from 'vitest';
import { optimiserJustificatif, optimiserAvatar, compresserImage } from './image-optimiseur';

describe('image-optimiseur', () => {
  it('normalise un fichier PDF avec son type MIME strict application/pdf', async () => {
    // Un PDF provenant d'iOS Safari avec un type vide ou générique et des caractères spéciaux dans le nom
    const brut = new File(['%PDF-1.4 dummy content'], 'pv_L3Fr_sem1&2_2025_2026.pdf', {
      type: 'application/octet-stream',
    });

    const normalise = await optimiserJustificatif(brut);
    expect(normalise.type).toBe('application/pdf');
    expect(normalise.name).toBe('pv_L3Fr_sem1_2_2025_2026.pdf');
  });

  it('rejette un PDF dépassant le plafond Vercel de 4.5 Mo', async () => {
    // Fichier simulé de 5 Mo
    const lourd = new File([''], 'gros_document.pdf', { type: 'application/pdf' });
    Object.defineProperty(lourd, 'size', { value: 5 * 1024 * 1024 });

    await expect(optimiserJustificatif(lourd)).rejects.toThrow('dépasse 4,5 Mo');
  });

  it('gère le repli d’optimisation avatar en environnement jsdom/sans canvas', async () => {
    const photo = new File(['dummy_image'], 'photo_profil.jpg', { type: 'image/jpeg' });
    const resultat = await optimiserAvatar(photo);
    expect(resultat).toBeDefined();
    expect(resultat.name).toBeDefined();
  });
});
