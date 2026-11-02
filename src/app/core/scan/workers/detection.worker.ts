/// <reference lib="webworker" />
import { detecterCoins } from '../utils/detection-bords';

/**
 * La détection de la page pour la caméra en direct, hors du fil principal : le
 * flux vidéo et l'interface ne partagent plus leur temps avec le calcul.
 *
 * Un message = une image (RGBA, transférée sans copie) ; la réponse reprend son
 * numéro pour que l'appelant ignore ce qui arriverait en retard.
 */
addEventListener('message', ({ data }: MessageEvent<{ id: number; tampon: ArrayBuffer; largeur: number; hauteur: number }>) => {
  const coins = detecterCoins(
    { data: new Uint8ClampedArray(data.tampon), width: data.largeur, height: data.hauteur },
    { flou: false },
  );
  postMessage({ id: data.id, coins });
});
