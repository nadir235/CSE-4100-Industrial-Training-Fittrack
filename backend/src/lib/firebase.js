'use strict';
const fs = require('node:fs');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file on ONE line.');
    }
  }
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!file) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set. Make sure backend/.env exists and is not empty (see backend/.env.example), then put your service-account key at backend/serviceAccount.json.',
    );
  }
  if (!fs.existsSync(file)) {
    throw new Error(
      `Service-account file not found at "${file}" (relative to the folder you ran the command in - run it from the backend folder). Download it from Firebase console > Project settings > Service accounts > Generate new private key and save it as backend/serviceAccount.json.`,
    );
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`"${file}" is not a valid service-account JSON file. Re-download the key from the Firebase console.`);
  }
}

/** Returns { auth, db } backed by the real Firebase Admin SDK. */
function realDeps() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(loadServiceAccount()) });
  return { auth: getAuth(app), db: getFirestore(app) };
}

module.exports = { realDeps };
