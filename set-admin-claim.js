#!/usr/bin/env node
/**
 * ONE-TIME ADMIN SCRIPT — grants the `admin: true` custom claim.
 *
 * Run this from your own computer (a trusted environment). It is NOT
 * part of the website and must never be uploaded/deployed with it.
 * It works on the free Spark plan (no Cloud Functions needed).
 *
 * Setup (once):
 *   1. Firebase Console → Project settings → Service accounts →
 *      "Generate new private key". Save the JSON OUTSIDE this repo
 *      (e.g. ~/secrets/hbdn-service-account.json). Never commit it.
 *   2. npm install firebase-admin
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/secrets/hbdn-service-account.json"
 *   node scripts/set-admin-claim.js <ADMIN_USER_UID>
 *   node scripts/set-admin-claim.js <ADMIN_USER_UID> --revoke     # removes admin
 *
 * Find the UID in Firebase Console → Authentication → Users → "User UID"
 * for your email/password admin account.
 *
 * After running it, sign out and back in on the dashboard (it also
 * force-refreshes the token, so a fresh sign-in picks the claim up).
 */
// #!/usr/bin/env node

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const uid = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!uid || uid.startsWith('--')) {
  console.error(
    'Usage: node set-admin-claim.js <ADMIN_USER_UID> [--revoke]'
  );
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
    'Point it at your service-account JSON, e.g.\n' +
    '  export GOOGLE_APPLICATION_CREDENTIALS="$HOME/secrets/hbdn-service-account.json"'
  );
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
});

(async () => {
  try {
    const auth = getAuth();

    const user = await auth.getUser(uid);

    const claims = Object.assign({}, user.customClaims || {});

    if (revoke) {
      delete claims.admin;
    } else {
      claims.admin = true;
    }

    await auth.setCustomUserClaims(uid, claims);

    console.log(
      `${revoke ? 'Removed' : 'Granted'} admin claim for ${user.email || uid}.`
    );
    console.log('They must sign out and sign back in for it to take effect.');

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.code || err.message);
    process.exit(1);
  }
})();