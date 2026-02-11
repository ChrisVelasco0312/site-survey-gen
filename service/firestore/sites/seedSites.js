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
const SITES_COLLECTION = 'sites';

async function seedSites() {
  console.log('Building sites from LPR and Cotejo Facial data...');
  const rawSites = buildSitesForFirestore();

  const batch = db.batch();
  let withCoords = 0;
  let withoutCoords = 0;

  for (const site of rawSites) {
    const { id, latitude, longitude, ...rest } = site;
    const location =
      latitude != null && longitude != null
        ? new admin.firestore.GeoPoint(latitude, longitude)
        : null;
    if (location) withCoords++;
    else withoutCoords++;

    const docRef = db.collection(SITES_COLLECTION).doc(id);
    const data = {
      site_code: site.site_code,
      site_type: site.site_type,
      distrito: site.distrito,
      municipio: site.municipio,
      name: site.name,
      address: site.address,
      cameras_count: site.cameras_count ?? 0,
      description: site.description ?? '',
    };
    if (location) data.location = location;
    batch.set(docRef, data);
  }

  try {
    await batch.commit();
    console.log(`\n✅ Successfully populated collection "${SITES_COLLECTION}":`);
    console.log(`   Total documents: ${rawSites.length}`);
    console.log(`   With coordinates: ${withCoords}`);
    if (withoutCoords > 0) console.log(`   Without coordinates: ${withoutCoords}`);
  } catch (error) {
    console.error('\n❌ Error writing to Firestore:', error);
    process.exit(1);
  }
}

seedSites();
