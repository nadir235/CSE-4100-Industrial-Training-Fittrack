'use strict';
/**
 * Secure admin setup. Admin accounts can NOT be created from the app or any public endpoint.
 * Run this on a trusted machine that holds the Firebase service-account key:
 *
 *   npm run create-admin -- admin@gym.com "Strong#Password1" "Gym Owner"
 *
 * It creates (or promotes) the user and sets the custom claim { admin: true }, which Firestore
 * rules and the API check on every request.
 */
require('dotenv').config();
const { realDeps } = require('../lib/firebase');

(async () => {
  const [email, password, name = 'Administrator'] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npm run create-admin -- <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Use a password of at least 10 characters for admin accounts.');
    process.exit(1);
  }
  const { auth, db } = realDeps();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Existing user found (${user.uid}) — promoting to admin.`);
  } catch {
    user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
    console.log(`Created user ${user.uid}.`);
  }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  await db.collection('admins').doc(user.uid).set({ email, name, createdAt: Date.now() }, { merge: true });
  console.log(`✔ ${email} is now an administrator. They must log out and back in once for the role to apply.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
