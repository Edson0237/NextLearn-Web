# Réorganisation de `src/app/core/` par rôle technique

Pur déplacement de fichiers (`git mv`) et mise à jour des imports ; aucune logique modifiée. Un commit par feature.

## auth  (commit e99037f)

- `auth/appareil.ts` → `auth/services/appareil.ts`
- `auth/auth-repository.google.spec.ts` → `auth/__tests__/auth-repository.google.spec.ts`
- `auth/auth-repository.spec.ts` → `auth/__tests__/auth-repository.spec.ts`
- `auth/auth-repository.ts` → `auth/repositories/auth-repository.ts`
- `auth/auth.model.ts` → `auth/models/auth.model.ts`
- `auth/auth.service.google.spec.ts` → `auth/__tests__/auth.service.google.spec.ts`
- `auth/auth.service.spec.ts` → `auth/__tests__/auth.service.spec.ts`
- `auth/auth.service.ts` → `auth/services/auth.service.ts`
- `auth/biometric.service.ts` → `auth/services/biometric.service.ts`
- `auth/google-identite.ts` → `auth/services/google-identite.ts`
- `auth/pin-policy.spec.ts` → `auth/__tests__/pin-policy.spec.ts`
- `auth/pin-policy.ts` → `auth/services/pin-policy.ts`
- `auth/verrou-pin.spec.ts` → `auth/__tests__/verrou-pin.spec.ts`
- `auth/verrou-pin.ts` → `auth/services/verrou-pin.ts`

Imports mis à jour hors de la feature : 27 fichier(s).
  - `core/profil/session-repository.ts`
  - `core/router/auth.guard.spec.ts`
  - `core/router/auth.guard.ts`
  - `features/auth/login-pin/login-pin.ts`
  - `features/auth/otp/otp.spec.ts`
  - `features/auth/otp/otp.ts`
  - `features/auth/pin-setup/pin-setup.ts`
  - `features/auth/register/register.spec.ts`
  - `features/auth/register/register.ts`
  - `features/auth/reset-pin/reset-pin.ts`
  - `features/auth/unlock/unlock.ts`
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/mes-depots/mes-depots.ts`
  - `features/home/home.spec.ts`
  - `features/home/home.ts`
  - `features/profil/delete-account/delete-account.ts`
  - `features/profil/dialogues/pin-dialog/pin-dialog.spec.ts`
  - `features/profil/dialogues/pin-dialog/pin-dialog.ts`
  - `features/profil/profil-home/profil-home.spec.ts`
  - `features/profil/profil-home/profil-home.ts`
  - `features/profil/settings-list/settings-list.ts`
  - `features/progression/progression-dashboard/progression-dashboard.ts`
  - `features/verification/verification-form/verification-form.ts`
  - `features/verification/verification-pending/verification-pending.ts`
  - `layout/app-shell/app-shell-root.ts`
  - `shared/ui/google-bouton/google-bouton.ts`

## bibliotheque  (commit b7d989e)

- `bibliotheque/document.model.spec.ts` → `bibliotheque/__tests__/document.model.spec.ts`
- `bibliotheque/document.model.ts` → `bibliotheque/models/document.model.ts`
- `bibliotheque/documents-repository.spec.ts` → `bibliotheque/__tests__/documents-repository.spec.ts`
- `bibliotheque/documents-repository.ts` → `bibliotheque/repositories/documents-repository.ts`
- `bibliotheque/favoris-repository.ts` → `bibliotheque/repositories/favoris-repository.ts`
- `bibliotheque/lecture-progress-repository.ts` → `bibliotheque/repositories/lecture-progress-repository.ts`
- `bibliotheque/offline-repository.ts` → `bibliotheque/repositories/offline-repository.ts`
- `bibliotheque/stockage-hors-ligne.ts` → `bibliotheque/services/stockage-hors-ligne.ts`

Imports mis à jour hors de la feature : 19 fichier(s).
  - `core/contexte/contexte.model.ts`
  - `core/contexte/contexte.service.ts`
  - `core/contrats-api.spec.ts`
  - `core/references/formats.service.ts`
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/bibliotheque/catalogue/catalogue.ts`
  - `features/bibliotheque/document-detail/document-detail.ts`
  - `features/bibliotheque/favoris/favoris.ts`
  - `features/bibliotheque/filtres-sheet/filtres-sheet.ts`
  - `features/bibliotheque/matiere/matiere.ts`
  - `features/bibliotheque/offline-library/offline-library.ts`
  - `features/bibliotheque/pdf-reader/pdf-reader.ts`
  - `features/home/home.ts`
  - `features/profil/settings-list/settings-list.ts`
  - `features/recherche/recherche.ts`
  - `layout/main-shell/main-shell.ts`
  - `shared/services/favoris-etat.ts`
  - `shared/ui/type-document/presentation-type-document.spec.ts`
  - `shared/ui/type-document/presentation-type-document.ts`

## contexte  (commit 45ab5da)

- `contexte/contexte-repository.ts` → `contexte/repositories/contexte-repository.ts`
- `contexte/contexte.model.ts` → `contexte/models/contexte.model.ts`
- `contexte/contexte.service.ts` → `contexte/services/contexte.service.ts`

Imports mis à jour hors de la feature : 6 fichier(s).
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/bibliotheque/catalogue/catalogue.ts`
  - `features/bibliotheque/document-detail/document-detail.ts`
  - `features/bibliotheque/matiere/matiere.ts`
  - `features/home/home.ts`
  - `layout/main-shell/main-shell.ts`

## contributions  (commit f10803b)

- `contributions/depot-repository.ts` → `contributions/repositories/depot-repository.ts`
- `contributions/depot.model.ts` → `contributions/models/depot.model.ts`

Imports mis à jour hors de la feature : 3 fichier(s).
  - `features/contributions/depot-form/depot-form.spec.ts`
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/mes-depots/mes-depots.ts`

## epreuves  (commit 366100d)

- `epreuves/epreuve.model.ts` → `epreuves/models/epreuve.model.ts`
- `epreuves/epreuves-repository.ts` → `epreuves/repositories/epreuves-repository.ts`

Imports mis à jour hors de la feature : 3 fichier(s).
  - `features/epreuves/epreuve-detail/epreuve-detail.ts`
  - `features/epreuves/epreuves-list/epreuves-list.spec.ts`
  - `features/epreuves/epreuves-list/epreuves-list.ts`

## error-handling  (commit 2e1c8ef)

- `error-handling/app-error-handler.ts` → `error-handling/handlers/app-error-handler.ts`
- `error-handling/erreur-benigne.spec.ts` → `error-handling/__tests__/erreur-benigne.spec.ts`
- `error-handling/erreur-benigne.ts` → `error-handling/utils/erreur-benigne.ts`
- `error-handling/global-error.service.ts` → `error-handling/services/global-error.service.ts`

Imports mis à jour hors de la feature : 2 fichier(s).
  - `app.config.ts`
  - `app.ts`

## i18n  (commit 9a31c02)

- `i18n/t.pipe.ts` → `i18n/pipes/t.pipe.ts`
- `i18n/traduction.service.spec.ts` → `i18n/__tests__/traduction.service.spec.ts`
- `i18n/traduction.service.ts` → `i18n/services/traduction.service.ts`

Imports mis à jour hors de la feature : 60 fichier(s).
  - `app.config.ts`
  - `core/bibliotheque/models/document.model.ts`
  - `core/contributions/models/depot.model.ts`
  - `core/preferences-locales.spec.ts`
  - `core/profil/support-repository.ts`
  - `features/auth/login-pin/login-pin.ts`
  - `features/auth/onboarding/onboarding.ts`
  - `features/auth/otp/otp.ts`
  - `features/auth/pin-setup/pin-setup.ts`
  - `features/auth/register/register.ts`
  - `features/auth/reset-pin/reset-pin.ts`
  - `features/auth/splash/splash.ts`
  - `features/auth/unlock/unlock.ts`
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/bibliotheque/catalogue/catalogue.ts`
  - `features/bibliotheque/document-detail/document-detail.ts`
  - `features/bibliotheque/favoris/favoris.ts`
  - `features/bibliotheque/filtres-sheet/filtres-sheet.ts`
  - `features/bibliotheque/matiere/matiere.ts`
  - `features/bibliotheque/offline-library/offline-library.ts`
  - `features/bibliotheque/pdf-reader/pdf-reader.ts`
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/mes-depots/mes-depots.ts`
  - `features/contributions/scanner/scanner.ts`
  - `features/design-system/design-catalog/design-catalog.ts`
  - `features/epreuves/epreuve-detail/epreuve-detail.ts`
  - `features/epreuves/epreuves-list/epreuves-list.ts`
  - `features/home/home.ts`
  - `features/installation/installation-page/installation-page.ts`
  - `features/legal/a-propos/a-propos.ts`
  - `features/legal/legal-document/legal-document.ts`
  - `features/notifications/notifications-page/notifications-page.ts`
  - `features/profil/delete-account/delete-account.ts`
  - `features/profil/dialogues/pin-dialog/pin-dialog.ts`
  - `features/profil/dialogues/support-dialog/support-dialog.ts`
  - `features/profil/parametres/parametres.ts`
  - `features/profil/profil-home/profil-home.ts`
  - `features/profil/sessions/sessions.ts`
  - `features/profil/settings-list/settings-list.ts`
  - `features/profil/support-tickets/support-tickets.ts`
  - `features/progression/progression-dashboard/progression-dashboard.ts`
  - `features/quiz/quiz-session/quiz-session.ts`
  - `features/recherche/recherche.ts`
  - `features/recours/recours-page/recours-page.ts`
  - `features/verification/verification-form/verification-form.ts`
  - `features/verification/verification-pending/verification-pending.ts`
  - `features/vitrine/vitrine.ts`
  - `layout/app-shell/app-shell-root.ts`
  - `layout/main-shell/main-shell.ts`
  - `shared/services/favoris-etat.ts`
  - `shared/ui/app-header/app-header.ts`
  - `shared/ui/document-card/document-card.ts`
  - `shared/ui/google-bouton/google-bouton.ts`
  - `shared/ui/guide-installation/guide-installation.spec.ts`
  - `shared/ui/guide-installation/guide-installation.ts`
  - `shared/ui/page-bar/page-bar.ts`
  - `shared/ui/progress-bar/progress-bar.ts`
  - `shared/ui/search-bar/search-bar.ts`
  - `shared/ui/signalement/signalement-flux.ts`
  - `shared/ui/streak-badge/streak-badge.ts`

## models  (commit 0eff9d2)

- `models/user.model.spec.ts` → `models/__tests__/user.model.spec.ts`

Imports mis à jour hors de la feature : 44 fichier(s).
  - `core/auth/__tests__/auth-repository.google.spec.ts`
  - `core/auth/__tests__/auth-repository.spec.ts`
  - `core/auth/__tests__/auth.service.spec.ts`
  - `core/auth/models/auth.model.ts`
  - `core/auth/repositories/auth-repository.ts`
  - `core/auth/services/auth.service.ts`
  - `core/bibliotheque/repositories/documents-repository.ts`
  - `core/contrats-api.spec.ts`
  - `core/epreuves/repositories/epreuves-repository.ts`
  - `core/network/erreur-api.spec.ts`
  - `core/network/erreur-api.ts`
  - `core/profil/profil-repository.ts`
  - `core/quiz/quiz-repository.ts`
  - `core/recours/recours-repository.ts`
  - `core/references/references-repository.ts`
  - `core/router/auth.guard.ts`
  - `core/storage/secure-storage.service.spec.ts`
  - `core/storage/secure-storage.service.ts`
  - `core/verification/verification-repository.ts`
  - `core/verification/verification.service.ts`
  - `features/auth/login-pin/login-pin.ts`
  - `features/auth/otp/otp.spec.ts`
  - `features/auth/otp/otp.ts`
  - `features/auth/register/register.ts`
  - `features/auth/reset-pin/reset-pin.ts`
  - `features/auth/unlock/unlock.ts`
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/mes-depots/mes-depots.ts`
  - `features/epreuves/epreuve-detail/epreuve-detail.ts`
  - `features/epreuves/epreuves-list/epreuves-list.ts`
  - `features/home/home.spec.ts`
  - `features/home/home.ts`
  - `features/profil/delete-account/delete-account.ts`
  - `features/profil/dialogues/support-dialog/support-dialog.spec.ts`
  - `features/profil/dialogues/support-dialog/support-dialog.ts`
  - `features/profil/profil-home/profil-home.spec.ts`
  - `features/profil/profil-home/profil-home.ts`
  - `features/profil/sessions/sessions.ts`
  - `features/profil/support-tickets/support-tickets.ts`
  - `features/progression/progression-dashboard/progression-dashboard.ts`
  - `features/verification/verification-form/verification-form.ts`
  - `features/verification/verification-pending/verification-pending.ts`
  - `shared/ui/signalement/signalement-flux.ts`

## moderation  (commit bdb1288)

- `moderation/report-repository.ts` → `moderation/repositories/report-repository.ts`
- `moderation/report.model.ts` → `moderation/models/report.model.ts`

Imports mis à jour hors de la feature : 4 fichier(s).
  - `features/bibliotheque/document-detail/document-detail.ts`
  - `features/epreuves/epreuve-detail/epreuve-detail.ts`
  - `features/profil/support-tickets/support-tickets.ts`
  - `shared/ui/signalement/signalement-flux.ts`

## network  (commit 05b2711)

- `network/api-config.ts` → `network/config/api-config.ts`
- `network/auth.interceptor.spec.ts` → `network/__tests__/auth.interceptor.spec.ts`
- `network/auth.interceptor.ts` → `network/interceptors/auth.interceptor.ts`
- `network/enveloppe-api.spec.ts` → `network/__tests__/enveloppe-api.spec.ts`
- `network/enveloppe-api.ts` → `network/utils/enveloppe-api.ts`
- `network/erreur-api.spec.ts` → `network/__tests__/erreur-api.spec.ts`
- `network/erreur-api.ts` → `network/utils/erreur-api.ts`
- `network/reseau.service.ts` → `network/services/reseau.service.ts`
- `network/session-expired.service.ts` → `network/services/session-expired.service.ts`

Imports mis à jour hors de la feature : 17 fichier(s).
  - `app.config.ts`
  - `core/auth/repositories/auth-repository.ts`
  - `core/auth/services/auth.service.ts`
  - `core/bibliotheque/repositories/documents-repository.ts`
  - `core/bibliotheque/repositories/favoris-repository.ts`
  - `core/bibliotheque/repositories/lecture-progress-repository.ts`
  - `core/bibliotheque/repositories/offline-repository.ts`
  - `core/contributions/repositories/depot-repository.ts`
  - `core/epreuves/repositories/epreuves-repository.ts`
  - `core/models/failure.model.ts`
  - `core/moderation/repositories/report-repository.ts`
  - `core/partage/lien-profond.ts`
  - `core/profil/profil-repository.ts`
  - `core/profil/session-repository.ts`
  - `core/profil/support-repository.ts`
  - `core/progression/progression-repository.ts`
  - `layout/app-shell/app-shell-root.ts`

## notifications  (commit 3d82a73)

- `notifications/notification.model.ts` → `notifications/models/notification.model.ts`
- `notifications/notifications-etat.ts` → `notifications/services/notifications-etat.ts`
- `notifications/notifications-repository.ts` → `notifications/repositories/notifications-repository.ts`
- `notifications/preference-notifications.ts` → `notifications/services/preference-notifications.ts`
- `notifications/push.service.ts` → `notifications/services/push.service.ts`

Imports mis à jour hors de la feature : 5 fichier(s).
  - `core/contrats-api.spec.ts`
  - `features/notifications/notifications-page/notifications-page.ts`
  - `features/profil/settings-list/settings-list.ts`
  - `layout/app-shell/app-shell-root.ts`
  - `shared/ui/app-header/app-header.ts`

## partage  (commit 14b9f39)

- `partage/lien-profond.ts` → `partage/utils/lien-profond.ts`

Imports mis à jour hors de la feature : 3 fichier(s).
  - `app.routes.ts`
  - `core/contrats-api.spec.ts`
  - `features/bibliotheque/document-detail/document-detail.ts`

## preferences  (commit da478b3)

- `preferences/preferences-accessibilite.ts` → `preferences/services/preferences-accessibilite.ts`
- `preferences/verrouillage-app.ts` → `preferences/services/verrouillage-app.ts`

Imports mis à jour hors de la feature : 3 fichier(s).
  - `core/auth/services/auth.service.ts`
  - `core/preferences-locales.spec.ts`
  - `features/profil/settings-list/settings-list.ts`

## profil  (commit d53cdcb)

- `profil/profil-repository.spec.ts` → `profil/__tests__/profil-repository.spec.ts`
- `profil/profil-repository.ts` → `profil/repositories/profil-repository.ts`
- `profil/profil.model.ts` → `profil/models/profil.model.ts`
- `profil/session-repository.spec.ts` → `profil/__tests__/session-repository.spec.ts`
- `profil/session-repository.ts` → `profil/repositories/session-repository.ts`
- `profil/support-repository.spec.ts` → `profil/__tests__/support-repository.spec.ts`
- `profil/support-repository.ts` → `profil/repositories/support-repository.ts`

Imports mis à jour hors de la feature : 8 fichier(s).
  - `core/auth/services/auth.service.ts`
  - `features/home/home.ts`
  - `features/profil/delete-account/delete-account.ts`
  - `features/profil/dialogues/support-dialog/support-dialog.spec.ts`
  - `features/profil/dialogues/support-dialog/support-dialog.ts`
  - `features/profil/profil-home/profil-home.ts`
  - `features/profil/sessions/sessions.ts`
  - `features/profil/support-tickets/support-tickets.ts`

## progression  (commit ab2f65b)

- `progression/progression-repository.ts` → `progression/repositories/progression-repository.ts`
- `progression/progression.model.ts` → `progression/models/progression.model.ts`

Imports mis à jour hors de la feature : 3 fichier(s).
  - `core/contrats-api.spec.ts`
  - `features/bibliotheque/pdf-reader/pdf-reader.ts`
  - `features/progression/progression-dashboard/progression-dashboard.ts`

## pwa  (commit 4878894)

- `pwa/cas-installation.ts` → `pwa/utils/cas-installation.ts`
- `pwa/environnement.spec.ts` → `pwa/__tests__/environnement.spec.ts`
- `pwa/environnement.ts` → `pwa/utils/environnement.ts`
- `pwa/installation.service.spec.ts` → `pwa/__tests__/installation.service.spec.ts`
- `pwa/installation.service.ts` → `pwa/services/installation.service.ts`
- `pwa/mise-a-jour.service.spec.ts` → `pwa/__tests__/mise-a-jour.service.spec.ts`
- `pwa/mise-a-jour.service.ts` → `pwa/services/mise-a-jour.service.ts`

Imports mis à jour hors de la feature : 8 fichier(s).
  - `app.ts`
  - `features/profil/settings-list/settings-list.ts`
  - `features/vitrine/vitrine.spec.ts`
  - `features/vitrine/vitrine.ts`
  - `layout/app-shell/app-shell-root.ts`
  - `shared/ui/guide-installation/etapes.ts`
  - `shared/ui/guide-installation/guide-installation.spec.ts`
  - `shared/ui/guide-installation/guide-installation.ts`

## quiz  (commit ee28ae4)

- `quiz/quiz-repository.ts` → `quiz/repositories/quiz-repository.ts`
- `quiz/quiz.model.ts` → `quiz/models/quiz.model.ts`

Imports mis à jour hors de la feature : 2 fichier(s).
  - `core/contrats-api.spec.ts`
  - `features/quiz/quiz-session/quiz-session.ts`

## recherche  (commit 30cf403)

- `recherche/historique-recherches.ts` → `recherche/services/historique-recherches.ts`

Imports mis à jour hors de la feature : 2 fichier(s).
  - `core/preferences-locales.spec.ts`
  - `features/recherche/recherche.ts`

## recours  (commit 7570058)

- `recours/recours-repository.ts` → `recours/repositories/recours-repository.ts`
- `recours/recours.model.ts` → `recours/models/recours.model.ts`

Imports mis à jour hors de la feature : 1 fichier(s).
  - `features/recours/recours-page/recours-page.ts`

## references  (commit c0643ff)

- `references/formats.service.ts` → `references/services/formats.service.ts`
- `references/references-repository.ts` → `references/repositories/references-repository.ts`
- `references/references.model.ts` → `references/models/references.model.ts`

Imports mis à jour hors de la feature : 7 fichier(s).
  - `core/contributions/repositories/depot-repository.ts`
  - `features/auth/register/register.ts`
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/scanner/scanner.ts`
  - `features/home/home.ts`
  - `features/verification/verification-form/verification-form.ts`

## router  (commit 4e9426e)

- `router/app-routes.ts` → `router/routes/app-routes.ts`
- `router/auth.guard.spec.ts` → `router/__tests__/auth.guard.spec.ts`
- `router/auth.guard.ts` → `router/guards/auth.guard.ts`
- `router/historique-navigation.ts` → `router/services/historique-navigation.ts`
- `router/pending-destination.service.ts` → `router/services/pending-destination.service.ts`
- `router/tab-reuse-strategy.ts` → `router/strategies/tab-reuse-strategy.ts`

Imports mis à jour hors de la feature : 38 fichier(s).
  - `app.config.ts`
  - `app.ts`
  - `core/auth/services/auth.service.ts`
  - `features/auth/login-pin/login-pin.ts`
  - `features/auth/onboarding/onboarding.ts`
  - `features/auth/otp/otp.ts`
  - `features/auth/pin-setup/pin-setup.ts`
  - `features/auth/register/register.ts`
  - `features/auth/reset-pin/reset-pin.ts`
  - `features/auth/unlock/unlock.ts`
  - `features/bibliotheque/bibliotheque-home/bibliotheque-home.ts`
  - `features/bibliotheque/catalogue/catalogue.ts`
  - `features/bibliotheque/document-detail/document-detail.ts`
  - `features/bibliotheque/favoris/favoris.ts`
  - `features/bibliotheque/matiere/matiere.ts`
  - `features/bibliotheque/offline-library/offline-library.ts`
  - `features/bibliotheque/pdf-reader/pdf-reader.ts`
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/mes-depots/mes-depots.ts`
  - `features/contributions/scanner/scanner.ts`
  - `features/epreuves/epreuve-detail/epreuve-detail.ts`
  - `features/epreuves/epreuves-list/epreuves-list.ts`
  - `features/home/home.ts`
  - `features/installation/installation-page/installation-page.ts`
  - `features/legal/a-propos/a-propos.ts`
  - `features/legal/legal-document/legal-document.ts`
  - `features/notifications/notifications-page/notifications-page.ts`
  - `features/partage/redirection-document.ts`
  - `features/profil/delete-account/delete-account.ts`
  - `features/profil/profil-home/profil-home.ts`
  - `features/profil/settings-list/settings-list.ts`
  - `features/progression/progression-dashboard/progression-dashboard.ts`
  - `features/quiz/quiz-session/quiz-session.ts`
  - `features/recherche/recherche.ts`
  - `features/recours/recours-page/recours-page.ts`
  - `features/verification/verification-form/verification-form.ts`
  - `features/verification/verification-pending/verification-pending.ts`
  - `layout/app-shell/app-shell.routes.ts`

## scan  (commit 562340e)

- `scan/numerisation.ts` → `scan/services/numerisation.ts`
- `scan/pdf-assembleur.spec.ts` → `scan/__tests__/pdf-assembleur.spec.ts`
- `scan/pdf-assembleur.ts` → `scan/utils/pdf-assembleur.ts`

Imports mis à jour hors de la feature : 2 fichier(s).
  - `features/contributions/depot-form/depot-form.ts`
  - `features/contributions/scanner/scanner.ts`

## storage  (commit 5926cd3)

- `storage/secure-storage.service.spec.ts` → `storage/__tests__/secure-storage.service.spec.ts`
- `storage/secure-storage.service.ts` → `storage/services/secure-storage.service.ts`

Imports mis à jour hors de la feature : 9 fichier(s).
  - `core/auth/__tests__/auth-repository.google.spec.ts`
  - `core/auth/__tests__/auth-repository.spec.ts`
  - `core/auth/repositories/auth-repository.ts`
  - `core/auth/services/verrou-pin.ts`
  - `core/network/__tests__/auth.interceptor.spec.ts`
  - `core/network/interceptors/auth.interceptor.ts`
  - `core/profil/repositories/profil-repository.ts`
  - `features/auth/login-pin/login-pin.ts`
  - `features/auth/reset-pin/reset-pin.ts`

## verification  (commit 71c6eea)

- `verification/verification-repository.ts` → `verification/repositories/verification-repository.ts`
- `verification/verification.service.ts` → `verification/services/verification.service.ts`

Imports mis à jour hors de la feature : 4 fichier(s).
  - `core/auth/services/auth.service.ts`
  - `core/router/guards/auth.guard.ts`
  - `features/verification/verification-form/verification-form.ts`
  - `features/verification/verification-pending/verification-pending.ts`

