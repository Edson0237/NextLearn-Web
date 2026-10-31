// Remet à zéro ce que les sondes de bout en bout écrivent, pour pouvoir les rejouer.
const { MongoClient } = require('../../../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');
(async () => {
  const c = await MongoClient.connect('mongodb://127.0.0.1:27555'); const db = c.db('nltest');
  for (const col of ['reports', 'documentratings', 'epreuveratings', 'favorites', 'offlinedownloads', 'recours', 'documentsubmissions', 'quizresults', 'notifications'])
    await db.collection(col).deleteMany({});
  await db.collection('documents').updateMany({}, { $set: { actif: true } });
  await db.collection('epreuves').updateMany({}, { $set: { actif: true } });
  // Les comptes créés par les sondes d'inscription.
  const crees = await db.collection('users').find({ email: { $nin: ['etudiant@test.local', 'admin@nextlearn.local'] }, role: { $ne: 'admin' } }).toArray();
  const ids = crees.map((u) => u._id);
  if (ids.length) {
    await db.collection('users').deleteMany({ _id: { $in: ids } });
    await db.collection('trusteddevices').deleteMany({ userId: { $in: ids } });
    await db.collection('verificationrequests').deleteMany({});
  }
  await db.collection('otpcodes').deleteMany({});
  // Les appareils appris par les sondes : seul l'appareil de base de l'étudiant reste connu.
  await db.collection('trusteddevices').deleteMany({ label: { $nin: ['Test', 'Admin'] } });
  // Le PIN de l'étudiant et ses sessions : certaines sondes les changent.
  const bcrypt = require('../../../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/bcryptjs');
  const crypto = require('crypto');
  const pinHash = await bcrypt.hash('1234', 10);
  await db.collection('users').updateMany({ email: { $in: ['etudiant@test.local', 'admin@nextlearn.local'] } }, { $set: { pinHash, status: 'active', niveau: 'N3' } });
  await db.collection('refreshtokens').deleteMany({});
  const admin = await db.collection('users').findOne({ email: 'admin@nextlearn.local' });
  const hash = crypto.createHash('sha256').update('appareil-admin-0123456789abcdef').digest('hex');
  await db.collection('trusteddevices').updateOne({ userId: admin._id, deviceIdHash: hash }, { $set: { userId: admin._id, deviceIdHash: hash, label: 'Admin' } }, { upsert: true });
  // Les filières de l'école de test portent leur cycle : c'est de là que la
  // cascade d'inscription tire les cycles proposés.
  const sji = await db.collection('universites').findOne({ nom: /SJI/ });
  if (sji) await db.collection('filieres').updateMany({ universiteId: String(sji._id) }, { $set: { cycle: 'INGENIEUR' } });
  await c.close();
})();
