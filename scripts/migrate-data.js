import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read service account keys
const devServiceAccountPath = path.resolve(__dirname, '../service/serviceAccountKey.json');
const prodServiceAccountPath = path.resolve(__dirname, '../service/prodServiceAccountKey.json');

let devServiceAccount, prodServiceAccount;

try {
  devServiceAccount = JSON.parse(readFileSync(devServiceAccountPath, 'utf-8'));
} catch (error) {
  console.error(`Error reading dev service account key at ${devServiceAccountPath}. Please ensure the file exists.`);
  process.exit(1);
}

try {
  prodServiceAccount = JSON.parse(readFileSync(prodServiceAccountPath, 'utf-8'));
} catch (error) {
  console.error(`Error reading prod service account key at ${prodServiceAccountPath}. Please ensure you have placed the production service account key there.`);
  process.exit(1);
}

// Initialize apps
const devApp = initializeApp({
  credential: cert(devServiceAccount)
}, 'devApp');

const prodApp = initializeApp({
  credential: cert(prodServiceAccount)
}, 'prodApp');

const devDb = getFirestore(devApp);
const prodDb = getFirestore(prodApp);

async function migrateCollection(collectionName) {
  console.log(`Starting migration for collection: ${collectionName}`);
  const devSnapshot = await devDb.collection(collectionName).get();
  
  if (devSnapshot.empty) {
    console.log(`No documents found in ${collectionName}. Skipping.`);
    return;
  }

  const batch = prodDb.batch();
  let count = 0;
  let batchCount = 0;

  for (const doc of devSnapshot.docs) {
    const prodDocRef = prodDb.collection(collectionName).doc(doc.id);
    batch.set(prodDocRef, doc.data());
    count++;
    
    // Firestore batches have a limit of 500 operations
    if (count % 400 === 0) {
      await batch.commit();
      batchCount++;
      console.log(`Committed batch ${batchCount} for ${collectionName} (${count} documents total)`);
    }
  }

  // Commit remaining documents in the batch
  if (count % 400 !== 0) {
    await batch.commit();
    batchCount++;
    console.log(`Committed final batch ${batchCount} for ${collectionName} (${count} documents total)`);
  }

  console.log(`Finished migrating ${count} documents for collection: ${collectionName}`);
}

async function runMigration() {
  try {
    await migrateCollection('sites');
    await migrateCollection('distrito_municipio');
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

runMigration();
