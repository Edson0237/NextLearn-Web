import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_PATH } from '../../network/config/api-config';
import { SecureStorageService } from '../../storage/services/secure-storage.service';
import { StockageHorsLigne } from '../../bibliotheque/services/stockage-hors-ligne';
import { Failure } from '../../models/failure.model';
import { Appareil } from '../services/appareil';
import { Consentements } from '../services/consentements';
import { UserModel, Cycle, NiveauEtude, cycleVersApi, niveauCourt, utilisateurDepuisApi } from '../../models/user.model';
import { DemandeOtp, demandeOtpDepuisJson, CycleVerification, cycleVerificationDepuisJson, EtatVerification } from '../../models/demande-otp.model';
import { ParcoursOtp, parcoursOtpDepuisCode, DUREE_REPRISABLE_OTP_MS } from '../../models/parcours-otp.model';
import { EtatDomaine, ReponseDomaine, reponseDomaineDepuisJson } from '../../models/domaine.model';
import { enFailure } from '../../network/utils/erreur-api';
import { donnees } from '../../network/utils/enveloppe-api';

/** Les routes d'authentification qui peuvent créer une session. */
const OUVRENT_UNE_SESSION: ReadonlySet<string> = new Set(['/setup-pin', '/login', '/google', '/google/inscription', '/verify-2fa']);

/** Durée de repli hors ligne quand aucune échéance n'a encore été mise en cache. */
const OTP_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

/** `sha256(pin + '_nextlearn_salt')`, en hexadécimal - même sel que côté backend. */
async function hashPin(pin: string): Promise<string> {
  const octets = new TextEncoder().encode(`${pin}_nextlearn_salt`);
  const empreinte = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(empreinte))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

/** Dépouille l'enveloppe `{ data: ... }` que rend systématiquement l'API. */
/**
 * L'utilisateur d'une réponse de profil.
 *
 * `PUT /api/profile` et les routes d'avatar enveloppent le compte dans
 * `{ user }`, alors que la connexion le rend à plat. Lire l'enveloppe comme un
 * compte donnait un profil vide - identifiant et nom compris - qui était
 * ensuite enregistré en local : changer de niveau effaçait le compte affiché.
 */
/**
 * Ce que le serveur répond à `POST /auth/google` : un statut, rien d'autre à
 * deviner. Voir `GoogleAuthResponse` côté API.
 */
export type ReponseGoogle =
  | { readonly status: 'new_profile_incomplete'; readonly profil: ProfilGoogle }
  | { readonly status: 'pin_required' }
  | { readonly status: 'authenticated'; readonly verificationStatus?: 'pending' };

/** L'identité certifiée par Google, avant que le compte NextLearn n'existe. */
export interface ProfilGoogle {
  readonly email: string;
  /** L'identifiant Google, gardé en mémoire pour l'affichage ; le serveur ne s'y fie pas (il lit son propre jeton). */
  readonly googleSub: string;
  readonly prenom: string;
  readonly nom: string;
  readonly picture?: string;
  /** Faux pour une adresse personnelle (gmail…) : Google prouve la boîte mail, pas l'appartenance à l'école. */
  readonly institutionnel: boolean;
}

/**
 * Accès réseau + orchestration du stockage pour l'authentification -
 * traduction d'`AuthRemoteRepository`
 * (`lib/domains/auth/infrastructure/repositories/auth_remote_repository.dart`).
 *
 * Chaque méthode HTTP convertit ses erreurs en `Failure` via
 * `Failure.depuisErreurHttp`, jamais en laissant fuiter une
 * `HttpErrorResponse` brute jusqu'à `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(SecureStorageService);
  private readonly stockageHorsLigne = inject(StockageHorsLigne);
  private readonly appareil = inject(Appareil);
  private readonly consentements = inject(Consentements);

  /** L'état de la dernière demande de code, tel que le serveur l'a rendu. */
  derniereDemandeOtp: DemandeOtp | null = null;

  private echeanceParcours(): Date {
    return new Date(Date.now() + DUREE_REPRISABLE_OTP_MS);
  }

  private retenirDemande(data: Record<string, unknown>): DemandeOtp | null {
    this.derniereDemandeOtp = demandeOtpDepuisJson(data['otp']);
    return this.derniereDemandeOtp;
  }

  private async poster(chemin: string, corps: unknown, reessayer = true): Promise<Record<string, unknown>> {
    const ouvreUneSession = OUVRENT_UNE_SESSION.has(chemin);
    // Un compte qui a déjà tout accepté n'a rien à déclarer : la demande part sans
    // détour. Sinon le serveur refuse, et la demande repart avec les versions.
    const consentements = ouvreUneSession ? this.consentements.versionsConnues() : undefined;
    try {
      const envoye = consentements ? { ...(corps as object), consentements } : corps;
      const reponse = await firstValueFrom(this.http.post(`${AUTH_PATH}${chemin}`, envoye));
      return donnees(reponse);
    } catch (e) {
      const echec = enFailure(e);
      // Parti avant que les versions n'arrivent : une fois chargées, on retente une fois.
      if (ouvreUneSession && reessayer && echec.code === 'consent_required' && (await this.consentements.charger())) {
        return this.poster(chemin, corps, false);
      }
      throw echec;
    }
  }


  // ── Étape en cours ───────────────────────────────────────────────────────
  /**
   * L'étape d'authentification laissée en plan, s'il y en a une.
   * L'échéance décide, pas la seule présence du jeton temporaire - sans
   * elle, l'écran de saisie serait repris indéfiniment pour un code mort.
   */
  parcoursOtpEnCours(): ParcoursOtp | null {
    const jeton = this.storage.getTempToken();
    if (!jeton) return null;

    const echeance = this.storage.getEcheanceParcoursOtp();
    if (!echeance || Date.now() > echeance.getTime()) {
      this.storage.clearTempToken();
      return null;
    }
    return parcoursOtpDepuisCode(this.storage.getParcoursOtp());
  }

  abandonnerParcoursOtp(): void {
    this.derniereDemandeOtp = null;
    this.storage.clearTempToken();
  }

  async rafraichirDemandeOtp(): Promise<DemandeOtp | null> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) return null;
    try {
      const reponse = await firstValueFrom(
        this.http.get(`${AUTH_PATH}/otp/status`, { params: { tempToken } }),
      );
      this.derniereDemandeOtp = demandeOtpDepuisJson(donnees(reponse));
      return this.derniereDemandeOtp;
    } catch {
      // Une consultation d'état qui échoue ne doit rien casser : l'écran
      // garde ce qu'il affichait plutôt que de basculer sur une erreur.
      return this.derniereDemandeOtp;
    }
  }

  async etatVerification(): Promise<CycleVerification | null> {
    const issue = await this.demanderEtatVerification();
    return issue === 'injoignable' ? null : issue;
  }

  /**
   * L'état de vérification, en distinguant « absent » de « pas pu demander ».
   *
   * `etatVerification` confondait les deux : une coupure réseau rendait
   * `null`, exactement comme un compte sans dossier de vérification. En aval,
   * `isOtpStillFresh` retombait alors sur l'échéance mise en cache, et si
   * celle-ci était dépassée, l'application **déconnectait** - au moment
   * précis où la personne ne peut pas se reconnecter, puisqu'elle est hors
   * ligne. Les documents téléchargés devenaient inatteignables pour cette
   * raison.
   *
   * Ne pas pouvoir poser la question n'est pas une réponse.
   */
  private async demanderEtatVerification(): Promise<CycleVerification | null | 'injoignable'> {
    try {
      const reponse = await firstValueFrom(this.http.get(`${AUTH_PATH}/verification-status`));
      return cycleVerificationDepuisJson(donnees(reponse));
    } catch (e) {
      // 4xx : le serveur a répondu, et sa réponse fait foi - pas de dossier.
      // Tout le reste (0 : hors ligne, 5xx : serveur en panne, délai
      // dépassé) signifie qu'on n'a pas pu demander.
      const statut = e instanceof HttpErrorResponse ? e.status : 0;
      const aRepondu = statut >= 400 && statut < 500;
      return aRepondu ? null : 'injoignable';
    }
  }

  /**
   * Le serveur reconnaît-il ce domaine e-mail comme institutionnel ? Ne
   * lève jamais - une coupure réseau rend `indisponible`, pas une erreur à
   * afficher : le formulaire d'inscription ne doit pas bloquer pour un
   * contrôle qui n'est qu'indicatif (`register()` retranche de toute façon).
   */
  async verifierDomaine(email: string): Promise<ReponseDomaine> {
    try {
      const reponse = await firstValueFrom(
        this.http.get(`${AUTH_PATH}/institution-domain/check`, { params: { email } }),
      );
      return reponseDomaineDepuisJson(donnees(reponse));
    } catch {
      return { etat: EtatDomaine.indisponible };
    }
  }

  // ── Inscription ──────────────────────────────────────────────────────────
  async register(infos: {
    email: string; nom: string; prenom: string; universite: string; filiere: string;
    niveau: NiveauEtude; cycle?: Cycle; sansEmailInstitutionnel?: boolean;
  }): Promise<void> {
    const data = await this.poster('/register', {
      email: infos.email, nom: infos.nom, prenom: infos.prenom,
      universite: infos.universite, filiere: infos.filiere,
      niveau: niveauCourt(infos.niveau),
      ...(infos.cycle ? { cycle: cycleVersApi(infos.cycle) } : {}),
      ...(infos.sansEmailInstitutionnel ? { sansEmailInstitutionnel: true } : {}),
    });

    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure("Impossible d'obtenir le jeton temporaire du serveur.");
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.inscription, this.echeanceParcours());
    this.storage.markLaunched();
    this.retenirDemande(data);
  }

  async verifyOtp(code: string): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/verify-otp', { tempToken, code });
    const suivant = data['tempToken'];
    if (typeof suivant !== 'string' || suivant.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton de validation.');
    }
    this.storage.saveTempToken(suivant);
    // L'adresse est vérifiée, le PIN reste à choisir.
    this.storage.saveParcoursOtp(ParcoursOtp.definitionPin, this.echeanceParcours());
  }

  /** Termine l'inscription et ouvre la session. Sans `pin`, le compte est créé sans PIN (il est facultatif). */
  async setupPin(pin?: string): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/setup-pin', { tempToken, ...(pin ? { pin } : {}), ...this.appareil.pourLAPI() });
    await this.ouvrirSession(data, pin);
    this.storage.clearTempToken();
  }

  /**
   * Première étape de la connexion : on donne son e-mail, le serveur dit
   * comment ce compte se connecte.
   *
   *  - `'pin'`    - le compte a un PIN (ou l'adresse est inconnue : le serveur ne
   *                 distingue pas, pour ne pas révéler quelles adresses existent) ;
   *  - `'otp'`    - pas de PIN : un code vient de partir par e-mail ;
   *  - `'google'` - pas de PIN, adresse gérée par Google : la preuve se fait là-bas.
   */
  async identifierConnexion(email: string): Promise<'pin' | 'otp' | 'google'> {
    const data = await this.poster('/login', { email, ...this.appareil.pourLAPI() });
    if (data['pinRequis'] === true) return 'pin';
    if (data['methode'] === 'google') return 'google';

    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton temporaire.');
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.connexion, this.echeanceParcours());
    this.retenirDemande(data);
    return 'otp';
  }

  /**
   * Connexion par e-mail et PIN.
   *
   * Deux issues désormais, selon que le serveur connaît déjà cet appareil :
   *
   * - **appareil connu** - la session est ouverte sur-le-champ, sans code. Le
   *   serveur le signale par `otpRequis: false` ;
   * - **appareil inconnu** - un code part par e-mail, et l'écran suivant
   *   l'attend, comme avant.
   *
   * L'aiguillage se fait sur `otpRequis` et non sur la présence d'un champ :
   * si une étape intermédiaire s'ajoute un jour, le client n'aura pas à
   * deviner laquelle en inspectant la forme de la réponse.
   *
   * Rend `true` quand un code est attendu, pour que l'écran sache s'il doit
   * naviguer vers la saisie du code ou directement vers l'accueil.
   */
  async loginWithPin(email: string, pin: string): Promise<boolean | 'google'> {
    const data = await this.poster('/login', { email, pin, ...this.appareil.pourLAPI() });

    // Le backend n'ouvre cette porte qu'après avoir validé le PIN : son
    // empreinte peut donc être mémorisée pour le verrou local, dans les deux
    // cas de figure.
    this.storage.savePinHash(await hashPin(pin));

    if (data['otpRequis'] === false) {
      await this.ouvrirSession(data, pin);
      // `clearTempToken` efface aussi l'étape de parcours en cours.
      this.storage.clearTempToken();
      return false;
    }

    // Adresse gérée par Google : aucun code n'est parti, la preuve se fait par
    // le bouton Google. Rien à mémoriser - le jeton d'identité fait foi.
    if (data['methode'] === 'google') return 'google';

    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton temporaire.');
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.connexion, this.echeanceParcours());
    this.retenirDemande(data);
    return true;
  }

  // ── Connexion Google ─────────────────────────────────────────────────────

  /** Faut-il proposer « Se connecter avec Google », et avec quel client ? Ne lève jamais. */
  async configGoogle(): Promise<{ enabled: boolean; clientId?: string; injoignable?: boolean }> {
    try {
      const data = donnees(await firstValueFrom(this.http.get(`${AUTH_PATH}/google/config`)));
      const clientId = typeof data['clientId'] === 'string' ? data['clientId'] : undefined;
      return { enabled: data['enabled'] === true && !!clientId, clientId };
    } catch {
      // Serveur injoignable ou en cours de redémarrage : ce n'est pas « Google
      // désactivé », et l'appelant doit pouvoir réessayer.
      return { enabled: false, injoignable: true };
    }
  }

  /**
   * Envoie le jeton d'identité Google au serveur et rend **son statut**, sans
   * rien en décider : `new_profile_incomplete`, `pin_required` ou
   * `authenticated`. Les effets de stockage (session, jeton du choix du PIN,
   * identité en attente) se font ici ; la navigation, elle, est à
   * `AuthService.handleGoogleAuthResponse`, seul aiguilleur.
   */
  async connexionGoogle(idToken: string): Promise<ReponseGoogle> {
    const data = await this.poster('/google', { idToken, ...this.appareil.pourLAPI() });
    return this.statutGoogle(data);
  }

  /** Termine l'inscription d'une première visite Google : crée le compte et ouvre la session (pas de PIN à choisir). */
  async inscriptionGoogle(infos: {
    universite: string; filiere: string; niveau: string; cycle?: string;
  }): Promise<ReponseGoogle> {
    const tempToken = this.profilGoogleEnAttente?.tempToken;
    if (!tempToken) throw new Failure('Cette démarche a expiré. Reconnecte-toi avec Google.');
    // Seul le parcours scolaire part avec le jeton signé : l'identité n'est
    // jamais renvoyée par le client, c'est le serveur qui la connaît.
    const data = await this.poster('/google/inscription', { tempToken, ...infos, ...this.appareil.pourLAPI() });
    this.profilGoogleEnAttente = null;
    return this.statutGoogle(data);
  }

  /** La première visite Google en cours : l'identité vérifiée, en attendant le parcours académique. */
  profilGoogleEnAttente: { tempToken: string; profil: ProfilGoogle } | null = null;

  private async statutGoogle(data: Record<string, unknown>): Promise<ReponseGoogle> {
    const status = data['status'];
    if (status === 'authenticated') {
      await this.ouvrirSession(data);
      this.storage.clearTempToken();
      return { status, ...(data['verificationStatus'] === 'pending' ? { verificationStatus: 'pending' as const } : {}) };
    }
    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton temporaire.');
    }
    if (status === 'pin_required') {
      // Même suite que l'inscription par code : le PIN, puis la session.
      this.storage.saveTempToken(tempToken);
      this.storage.saveParcoursOtp(ParcoursOtp.definitionPin, this.echeanceParcours());
      return { status };
    }
    if (status === 'new_profile_incomplete') {
      const p = (data['profil'] ?? {}) as Record<string, unknown>;
      const profil: ProfilGoogle = {
        email: String(data['email'] ?? ''),
        googleSub: String(data['googleSub'] ?? ''),
        prenom: String(p['prenom'] ?? ''),
        nom: String(p['nom'] ?? ''),
        picture: p['picture'] == null ? undefined : String(p['picture']),
        institutionnel: p['institutionnel'] !== false,
      };
      this.profilGoogleEnAttente = { tempToken, profil };
      return { status, profil };
    }
    throw new Failure('Réponse inattendue du serveur.');
  }

  async verifyLoginOtp(code: string): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/verify-2fa', { tempToken, code, ...this.appareil.pourLAPI() });
    await this.ouvrirSession(data);
    this.storage.clearTempToken();
  }

  async resendOtp(): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/resend-otp', { tempToken });
    const nouveau = data['tempToken'];
    if (typeof nouveau !== 'string' || nouveau.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de nouveau jeton.');
    }
    this.storage.saveTempToken(nouveau);
    this.retenirDemande(data);
  }

  /** Écrit la session (jetons + utilisateur) rendue par une réponse d'auth,
   * et l'empreinte du PIN si on le connaît (setupPin le possède, pas verify-2fa). */
  private async ouvrirSession(data: Record<string, unknown>, pin?: string): Promise<void> {
    const accessToken = data['accessToken'];
    const refreshToken = data['refreshToken'];
    const userData = data['user'];
    if (
      typeof accessToken !== 'string' || typeof refreshToken !== 'string' ||
      !userData || typeof userData !== 'object'
    ) {
      throw new Failure('La réponse du serveur ne contient pas les informations de session.');
    }
    this.storage.saveToken(accessToken, new Date(Date.now() + 15 * 60 * 1000));
    this.storage.saveRefreshToken(refreshToken);
    const utilisateur = utilisateurDepuisApi(userData as Record<string, unknown>);
    this.storage.saveUser(utilisateur);
    await this.stockageHorsLigne.definirUtilisateur(utilisateur.id);
    if (pin) this.storage.savePinHash(await hashPin(pin));
    // Point de départ des 30 jours pendant lesquels le PIN seul rouvre la session.
    this.storage.saveLastOtpVerifiedAt(new Date());
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${AUTH_PATH}/logout`, {}));
    } catch {
      // Réseau absent, jeton déjà expiré, serveur indisponible : la session
      // locale doit tomber malgré tout.
    }
    this.storage.clearToken();
    this.storage.clearRefreshToken();
    this.storage.clearTempToken();
    await this.stockageHorsLigne.definirUtilisateur(null);
  }

  async forgetDevice(): Promise<void> {
    this.storage.clearAll();
    await this.stockageHorsLigne.definirUtilisateur(null);
  }

  /** L'adresse du compte vient de changer côté serveur : la copie locale la suit. */
  majEmailLocal(email: string): UserModel | null {
    const u = this.storage.getUser();
    if (!u) return null;
    const maj = { ...u, email };
    this.storage.saveUser(maj);
    return maj;
  }

  // ── Session restaurée au démarrage ──────────────────────────────────────
  getCurrentUser(): UserModel | null {
    return this.storage.getUser();
  }

  isFirstLaunch(): boolean {
    return this.storage.isFirstLaunch();
  }

  hasLocalPin(): boolean {
    const hash = this.storage.getPinHash();
    return !!hash && hash.length > 0;
  }

  async verifyLocalPin(pin: string): Promise<boolean> {
    const stored = this.storage.getPinHash();
    if (!stored) return false;
    return stored === (await hashPin(pin));
  }

  /**
   * La vérification du compte tient-elle encore ? Le serveur est la
   * source de vérité ; hors ligne, on retombe sur l'échéance mise en
   * cache, et à défaut sur la durée de repli.
   */
  async isOtpStillFresh(): Promise<boolean> {
    const issue = await this.demanderEtatVerification();

    // Serveur injoignable : on garde la session. Conclure à l'expiration
    // faute d'avoir pu demander reviendrait à déconnecter quiconque ouvre
    // l'application dans le train - et à lui fermer la bibliothèque qu'il a
    // précisément téléchargée pour ce trajet. La session tombera d'elle-même
    // au premier échange avec un serveur qui la refuse.
    if (issue === 'injoignable') return true;

    const etat = issue;
    if (etat) {
      const echeance =
        etat.graceJusquau && etat.graceJusquau.getTime() > etat.echeanceLe.getTime()
          ? etat.graceJusquau
          : etat.echeanceLe;
      this.storage.saveEcheanceVerification(echeance);
      return etat.etat !== EtatVerification.expire;
    }

    const echeance = this.storage.getEcheanceVerification();
    if (echeance) return Date.now() < echeance.getTime();

    const dernier = this.storage.getLastOtpVerifiedAt();
    if (!dernier) return false;
    return Date.now() - dernier.getTime() < OTP_VALIDITY_MS;
  }

  async restoreSession(): Promise<{ userId: string } | null> {
    if (!this.storage.isTokenValid()) {
      // L'access token a expiré depuis la dernière ouverture : on tente un
      // rafraîchissement silencieux avant de forcer une reconnexion. Ce
      // rafraîchissement passe par l'intercepteur HTTP lui-même (toute
      // requête authentifiée le déclenche) - ici, on se contente de vérifier
      // qu'un refresh token existe encore, et on laisse la requête suivante
      // (vérification de l'OTP ci-après) le déclencher au besoin.
      if (!this.storage.getRefreshToken()) return null;
    }
    const token = this.storage.getToken();
    const user = this.storage.getUser();
    if (!token && !this.storage.getRefreshToken()) return null;
    if (!user) return null;
    await this.stockageHorsLigne.definirUtilisateur(user.id);
    return { userId: user.id };
  }

  // ── Réinitialisation du PIN ──────────────────────────────────────────────
  async requestPinReset(email: string): Promise<void> {
    const data = await this.poster('/reset-pin', { email });
    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton de réinitialisation.');
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.reinitialisation, this.echeanceParcours());
    this.retenirDemande(data);
  }

  /** Rend l'utilisateur si le serveur ouvre la session dans la foulée, sinon `null`. */
  async confirmPinReset(code: string, newPin: string): Promise<UserModel | null> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/confirm-reset-pin', { tempToken, code, newPin });

    this.storage.clearTempToken();
    this.storage.clearPinAttempts();

    const accessToken = data['accessToken'];
    const refreshToken = data['refreshToken'];
    const userData = data['user'];
    if (
      typeof accessToken !== 'string' || typeof refreshToken !== 'string' ||
      !userData || typeof userData !== 'object'
    ) {
      // Repli pour un serveur antérieur à ce changement : on repart d'un
      // appareil propre, l'écran renvoie vers la connexion.
      this.storage.clearToken();
      this.storage.clearRefreshToken();
      this.storage.clearPin();
      return null;
    }

    this.storage.saveToken(accessToken, new Date(Date.now() + 15 * 60 * 1000));
    this.storage.saveRefreshToken(refreshToken);
    const utilisateur = utilisateurDepuisApi(userData as Record<string, unknown>);
    this.storage.saveUser(utilisateur);
    await this.stockageHorsLigne.definirUtilisateur(utilisateur.id);
    this.storage.savePinHash(await hashPin(newPin));
    this.storage.saveLastOtpVerifiedAt(new Date());
    return utilisateur;
  }

  /** Rend le nombre d'autres appareils déconnectés au passage. */
  async changerPin(ancienPin: string | undefined, nouveauPin: string): Promise<number> {
    const data = await this.poster('/change-pin', {
      ...(ancienPin ? { ancienPin } : {}),
      nouveauPin,
      deviceId: this.appareil.identifiant(),
    });
    // Le compte a désormais un PIN, qu'il l'ait créé ou changé.
    const actuel = this.storage.getUser();
    if (actuel && actuel.hasPin !== true) this.storage.saveUser({ ...actuel, hasPin: true });
    // L'empreinte locale sert au déverrouillage hors ligne : la laisser sur
    // l'ancien code rendrait le nouveau PIN refusé à la prochaine ouverture.
    this.storage.savePinHash(await hashPin(nouveauPin));
    this.storage.clearPinAttempts();
    const fermees = data['sessionsFermees'];
    return typeof fermees === 'number' ? fermees : 0;
  }
}
