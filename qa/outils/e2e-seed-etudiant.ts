// Crée l'étudiant de test et son appareil de confiance (connexion sans OTP).
// Copié sous `api/src/seeds/` par `e2e-demarrer.sh` le temps de l'exécution.
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDatabase } from '../config/database';
import { User, Universite, TrustedDevice } from '../models/index';
(async () => {
  await connectDatabase();
  const uni: any = await Universite.findOne({ nom: 'Université de Yaoundé I' });
  const pinHash = await bcrypt.hash('1234', 10);
  const hash = crypto.createHash('sha256').update('appareil-de-test-0123456789abcdef').digest('hex');
  const etu: any = await User.findOneAndUpdate({ email: 'etudiant@test.local' }, {
    email: 'etudiant@test.local', nom: 'Djomo', prenom: 'Camille', universite: 'Université de Yaoundé I', universiteId: String(uni._id),
    filiere: 'Informatique', niveau: 'N3', cycle: 'LICENCE', role: 'user', status: 'active', isEmailVerified: true, pinHash,
  }, { upsert: true, new: true });
  await TrustedDevice.findOneAndUpdate({ userId: String(etu._id), deviceIdHash: hash }, { userId: String(etu._id), deviceIdHash: hash, label: 'Test' }, { upsert: true });
  console.log('ETUDIANT', String(etu._id));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
