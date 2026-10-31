import { Injectable } from '@angular/core';

/** La clé sous laquelle l'identifiant de cet appareil est conservé. */
const CLE_ID = 'nl_device_id';

/**
 * L'identité de cet appareil, telle que le serveur la reconnaît.
 *
 * ## Pourquoi
 *
 * Le code à usage unique était réclamé à **chaque** connexion. Il n'atteste
 * pourtant que d'une chose : que la personne tient l'adresse e-mail
 * déclarée. Une fois cette preuve faite sur un navigateur donné, la refaire
 * chaque jour n'y ajoute rien, et suppose un réseau au moment précis où l'on
 * vient chercher un document souvent hors ligne.
 *
 * Le serveur mémorise donc l'appareil après un premier code validé
 * (`TrustedDevice` côté API). Cet identifiant est ce qui le lui désigne.
 *
 * ## Ce qu'il vaut
 *
 * Il vaut preuve de possession de cet appareil : qui le connaîtrait **et**
 * connaîtrait le PIN sauterait l'étape du code. Il est donc tiré au sort par
 * `crypto.getRandomValues`, jamais dérivé d'une empreinte de navigateur - une
 * empreinte se recalcule depuis l'extérieur, un tirage non. Le serveur ne le
 * range que haché.
 *
 * ## Sa durée de vie
 *
 * Il survit à la déconnexion, et c'est voulu : se déconnecter puis se
 * reconnecter sur son propre téléphone ne devrait pas redemander un code.
 * Vider les données du site le perd, et l'appareil redevient inconnu - le
 * repli sûr.
 */
@Injectable({ providedIn: 'root' })
export class Appareil {
  /**
   * L'identifiant de cet appareil, créé au premier appel.
   *
   * Rend `undefined` si le stockage local est inaccessible - navigation
   * privée, cookies bloqués. L'appel d'authentification part alors sans
   * identifiant, et le serveur retombe sur le parcours avec code : moins
   * confortable, mais jamais bloquant.
   */
  identifiant(): string | undefined {
    try {
      const connu = localStorage.getItem(CLE_ID);
      if (connu && connu.length >= 16) return connu;

      const octets = new Uint8Array(24);
      crypto.getRandomValues(octets);
      const neuf = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(CLE_ID, neuf);
      return neuf;
    } catch {
      return undefined;
    }
  }

  /**
   * Ce que l'étudiant lira dans « Appareils connectés ».
   *
   * Volontairement grossier : le but est de reconnaître son propre téléphone
   * dans une liste de trois, pas d'identifier une version de navigateur.
   */
  libelle(): string {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const navigateur =
      /Edg\//.test(ua) ? 'Edge'
      : /OPR\//.test(ua) ? 'Opera'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari'
      : 'Navigateur';
    const systeme =
      /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
      : /Windows/.test(ua) ? 'Windows'
      : /Mac OS X/.test(ua) ? 'macOS'
      : /Linux/.test(ua) ? 'Linux'
      : 'Web';
    return `${navigateur} · ${systeme}`;
  }

  /** Les deux champs attendus par les appels d'authentification. */
  pourLAPI(): { deviceId?: string; label?: string } {
    const deviceId = this.identifiant();
    return deviceId ? { deviceId, label: this.libelle() } : {};
  }

  /** Oublie cet appareil - utilisé par la suppression de compte. */
  oublier(): void {
    try {
      localStorage.removeItem(CLE_ID);
    } catch {
      // Stockage indisponible : rien à oublier.
    }
  }
}
