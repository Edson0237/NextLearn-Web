/* Service worker dédié aux messages Firebase.
 *
 * Pourquoi un second service worker alors que l'application en a déjà un :
 * celui d'Angular (`ngsw-worker.js`) gère le cache et les mises à jour, et ne
 * sait rien des messages Firebase. Le SDK en réclame un à lui, enregistré sur
 * une portée distincte pour que les deux ne se marchent pas dessus.
 *
 * Il lit la même configuration que l'application (`/firebase-config.json`) :
 * une seule source, et rien à recompiler pour changer de projet Firebase.
 * Sans `appId` ni `vapidKey` - l'état tant qu'aucune application web n'est
 * déclarée dans la console - ce fichier ne fait rien, et c'est voulu.
 */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

(async () => {
  try {
    const reponse = await fetch('/firebase-config.json');
    const config = await reponse.json();
    // La clé VAPID sert à la page (obtention du jeton), pas à ce service worker.
    if (!config.appId || !config.apiKey) return;

    firebase.initializeApp(config);
    const messagerie = firebase.messaging();

    messagerie.onBackgroundMessage((charge) => {
      const titre = charge.notification?.title;
      if (!titre) return;
      self.registration.showNotification(titre, {
        body: charge.notification?.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        // La destination voyage dans `data`, comme sur mobile : c'est elle que
        // le clic ci-dessous ouvre.
        data: charge.data ?? {},
      });
    });
  } catch {
    // Configuration absente ou illisible : pas de push, pas d'erreur.
  }
})();

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const donnees = evenement.notification.data ?? {};
  const cible = donnees.route
    ? `/app/${String(donnees.route).replace(/^\/+/, '')}`
    : donnees.documentId
      ? `/app/bibliotheque/doc/${donnees.documentId}`
      : /^https?:\/\//.test(String(donnees.url ?? ''))
        ? String(donnees.url)
        : '/app/notifications';

  evenement.waitUntil(
    (async () => {
      const onglets = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Un onglet déjà ouvert est réutilisé : ouvrir une seconde fenêtre de la
      // même application laisserait deux sessions côte à côte.
      for (const onglet of onglets) {
        if ('focus' in onglet) {
          await onglet.focus();
          if ('navigate' in onglet) await onglet.navigate(cible);
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});
