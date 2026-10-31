// Retrouve le dernier code à 6 chiffres envoyé à une adresse : il n'est stocké que haché,
// et l'envoi d'e-mail est coupé en test. 10^6 hachages se calculent en une seconde.
const { MongoClient } = require('../../../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');
const crypto = require('crypto');
(async () => {
  const email = process.argv[2];
  const c = await MongoClient.connect('mongodb://127.0.0.1:27555'); const db = c.db('nltest');
  const u = await db.collection('users').findOne({ email });
  const rec = u && await db.collection('otpcodes').find({ userId: u._id }).sort({ createdAt: -1 }).limit(1).next()
    || await db.collection('otpcodes').find({}).sort({ createdAt: -1 }).limit(1).next();
  for (let i = 0; i < 1000000; i++) {
    const code = String(i).padStart(6, '0');
    if (crypto.createHash('sha256').update(code).digest('hex') === rec.code) { console.log(code); break; }
  }
  await c.close();
})();
