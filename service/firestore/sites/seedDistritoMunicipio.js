import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSitesForFirestore } from './sitesData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(path.resolve(__dirname, '../..'), 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nError: Service account key not found at: ${serviceAccountPath}`);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in the "service" directory.\n');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();
const COLLECTION = 'distrito_municipio';

async function seedDistritoMunicipio() {
  console.log('Extracting Distrito → Municipio relationships from site data...');
  const sites = buildSitesForFirestore();

  const map = {};
  for (const site of sites) {
    if (!site.distrito || !site.municipio) continue;
    if (!map[site.distrito]) map[site.distrito] = new Set();
    map[site.distrito].add(site.municipio);
  }

  const batch = db.batch();
  const entries = Object.entries(map);

  for (const [distrito, municipiosSet] of entries) {
    const municipios = Array.from(municipiosSet).sort();
    const docId = distrito.toLowerCase().replace(/\s+/g, '_');
    const docRef = db.collection(COLLECTION).doc(docId);
    batch.set(docRef, { distrito, municipios }, { merge: true });
  }

  try {
    await batch.commit();
    console.log(`\n✅ Successfully populated collection "${COLLECTION}":`);
    console.log(`   Total distritos: ${entries.length}\n`);
    for (const [distrito, municipiosSet] of entries) {
      const sorted = Array.from(municipiosSet).sort();
      console.log(`   ${distrito}: ${sorted.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    console.error('\n❌ Error writing to Firestore:', error);
    process.exit(1);
  }
}

seedDistritoMunicipio();
