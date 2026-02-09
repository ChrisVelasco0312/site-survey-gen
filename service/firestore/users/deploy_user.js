import admin from 'firebase-admin';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for service account key
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nError: Service account key not found at: ${serviceAccountPath}`);
  console.error('To fix this:');
  console.error('1. Download your service account key from Firebase Console -> Project Settings -> Service accounts.');
  console.error('2. Save it as "serviceAccountKey.json" in the "service" directory.');
  console.error('3. Or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.\n');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();

async function deployUser() {
  console.log('Deploying User to Firestore...');
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'uid',
      message: 'Enter Firebase Auth UID (required):',
      validate: input => input.trim() !== '' ? true : 'UID cannot be empty'
    },
    {
      type: 'input',
      name: 'email',
      message: 'Enter Email:',
      validate: input => input.trim() !== '' ? true : 'Email cannot be empty'
    },
    {
      type: 'input',
      name: 'full_name',
      message: 'Enter Full Name:',
      validate: input => input.trim() !== '' ? true : 'Full Name cannot be empty'
    },
    {
      type: 'list',
      name: 'role',
      message: 'Select Role:',
      choices: ['admin', 'field_worker'],
      default: 'admin'
    },
    {
      type: 'list',
      name: 'group_assignment',
      message: 'Select Group Assignment:',
      choices: ['grupo_a', 'grupo_b'],
      default: 'grupo_a',
      when: (answers) => answers.role !== 'admin'
    }
  ]);

  const userData = {
    uid: answers.uid.trim(),
    email: answers.email.trim(),
    full_name: answers.full_name.trim(),
    role: answers.role,
    group_assignment: answers.role === 'admin' ? 'all' : answers.group_assignment,
    is_active: true,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_login: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('users').doc(userData.uid).set(userData);
    console.log(`\n✅ Successfully deployed user:`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   UID: ${userData.uid}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   Collection: 'users'`);
  } catch (error) {
    console.error('\n❌ Error deploying user:', error);
  }
}

deployUser();
