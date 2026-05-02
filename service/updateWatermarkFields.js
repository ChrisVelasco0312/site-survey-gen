import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import inquirer from 'inquirer';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENVIRONMENTS = {
  dev: {
    keyPath: join(__dirname, 'serviceAccountKey.json'),
    name: 'gen-site-survey-dev',
  },
  prod: {
    keyPath: join(__dirname, 'prodServiceAccountKey.json'),
    name: 'gen-site-survey-prod',
  },
};

function getEnvironment(env) {
  const config = ENVIRONMENTS[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}. Use: dev, prod`);
  }
  const key = JSON.parse(readFileSync(config.keyPath, 'utf8'));
  return { key, projectId: config.name };
}

async function fetchReportsByDistritos(db, distritos) {
  const reports = [];
  const batchSize = 100;
  let lastDoc = null;

  do {
    let q = db.collection('reports').limit(batchSize);
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snapshot = await q.get();
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const distrito = data.address?.distrito;
      if (distrito && distritos.includes(distrito)) {
        reports.push({ id: doc.id, ...data });
      }
    }
  } while (lastDoc);

  return reports;
}

function _formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('es-CO');
}

function displayReports(reports) {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ID                    | Site Name                   | Distrito              | Status      | Camera Watermark | Entrance Watermark');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  for (const r of reports) {
    const id = `${r.id.slice(0, 8)}...`;
    const siteName = (r.address?.site_name || 'Sin nombre').slice(0, 25).padEnd(25);
    const distrito = (r.address?.distrito || 'N/A').slice(0, 20).padEnd(20);
    const status = (r.status || 'N/A').padEnd(10);
    const camWatermark = (r.camera_view_photo_watermark_enabled === true ? 'true' : r.camera_view_photo_watermark_enabled === false ? 'false' : 'not set').padEnd(14);
    const entWatermark = (r.service_entrance_photo_watermark_enabled === true ? 'true' : r.service_entrance_photo_watermark_enabled === false ? 'false' : 'not set');

    console.log(`  ${id} | ${siteName} | ${distrito} | ${status} | ${camWatermark} | ${entWatermark}`);
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node updateWatermarkFields.js <env> <distrito1> <distrito2> ...');
    console.error('Example: node updateWatermarkFields.js dev "DISTRITO PALMIRA" "DISTRITO MECAL"');
    process.exit(1);
  }

  const env = args[0];
  const distritos = args.slice(1);

  console.log(`\nEnvironment: ${env}`);
  console.log(`Distritos: ${distritos.join(', ')}\n`);

  const { key } = getEnvironment(env);
  initializeApp({ credential: cert(key) });
  const db = getFirestore();

  console.log('Fetching reports...');
  const reports = await fetchReportsByDistritos(db, distritos);
  console.log(`Found ${reports.length} reports\n`);

  if (reports.length === 0) {
    console.log('No reports found for the specified distritos.');
    return;
  }

  displayReports(reports);

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'camera_view_photo_watermark_enabled',
      message: 'Set camera_view_photo_watermark_enabled to:',
      default: false,
    },
    {
      type: 'confirm',
      name: 'service_entrance_photo_watermark_enabled',
      message: 'Set service_entrance_photo_watermark_enabled to:',
      default: false,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply these values to all ${reports.length} reports?`,
      default: false,
    },
  ]);

  if (!answers.confirm) {
    console.log('\nCancelled.');
    return;
  }

  const timestamp = Date.now();
  let updatedCount = 0;

  for (const report of reports) {
    await db.collection('reports').doc(report.id).update({
      camera_view_photo_watermark_enabled: answers.camera_view_photo_watermark_enabled,
      service_entrance_photo_watermark_enabled: answers.service_entrance_photo_watermark_enabled,
      updated_at: timestamp,
    });
    updatedCount++;
  }

  console.log(`\n✓ Done! Updated ${updatedCount} reports.`);
}

main().catch(console.error);