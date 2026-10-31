#!/usr/bin/env bash
# Monte l'environnement de bout en bout : API sur :5001 (base mémoire :27555), PWA sur :4201.
# Prérequis : la base mémoire (mongodb-memory-server) tourne sur 27555 et le serveur PDF sur 4402.
set -e
RACINE="$(cd "$(dirname "$0")/../../.." && pwd)"
API="$RACINE/api_nextlearn_v2_08082026/api_nextlearn_v2"
export SMTP_USER= SMTP_PASS= SENDGRID_API_KEY=
export MONGO_URI=mongodb://127.0.0.1:27555/nltest MONGODB_URI=mongodb://127.0.0.1:27555/nltest
cd "$API"
npx tsx src/seeds/seed-demo.ts > /dev/null 2>&1
timeout 60 npx tsx src/seeds/seed-academic.ts > /dev/null 2>&1 || true
cp "$RACINE/NextLearn-Web/qa/outils/e2e-seed-etudiant.ts" src/seeds/_e2e.ts
timeout 60 npx tsx src/seeds/_e2e.ts 2>&1 | grep ETUDIANT; rm -f src/seeds/_e2e.ts
node -e "
const { MongoClient } = require('mongodb');
(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27555');const db=c.db('nltest');
await db.collection('documents').updateMany({}, {\$set:{urlPdf:'http://127.0.0.1:4402/cours.pdf',niveau:'N3'}});
await db.collection('epreuves').updateMany({}, {\$set:{urlPdf:'http://127.0.0.1:4402/epreuve.pdf',urlCorrigePdf:'http://127.0.0.1:4402/corrige.pdf',niveau:'N3'}});
await c.close();})();"
(PORT=5001 nohup npx tsx src/index.ts > /tmp/api-e2e.log 2>&1 &)
timeout 60 bash -c 'until curl -s localhost:5001/health >/dev/null; do sleep 2; done'
cd "$RACINE/NextLearn-Web"
sed 's#localhost:5000#localhost:5001#' proxy.conf.json > /tmp/proxy-e2e.json
(nohup npx ng serve --host 127.0.0.1 --port 4201 --proxy-config /tmp/proxy-e2e.json > /tmp/pwa-e2e.log 2>&1 &)
timeout 120 bash -c 'until curl -s localhost:4201 >/dev/null; do sleep 2; done'
echo prêt
