const { MongoClient, ObjectId } = require('../../../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');
(async () => {
  const c = await MongoClient.connect('mongodb://127.0.0.1:27555'); const db = c.db('nltest');
  const u = await db.collection('users').findOne({ email: 'etudiant@test.local' });
  const d = await db.collection('documents').findOne({});
  await db.collection('notifications').deleteMany({});
  await db.collection('notifications').insertMany([
    { userId: String(u._id), type: 'NOUVEAU_COURS', titre: 'Nouveau document', corps: 'Un cours vient d’être publié.', lu: false, metadata: { documentId: String(d._id) }, createdAt: new Date() },
    { userId: String(u._id), type: 'INFO', titre: 'Bienvenue', corps: 'Bienvenue sur NextLearn.', lu: false, createdAt: new Date(Date.now() - 1000) },
  ]);
  await c.close();
})();
