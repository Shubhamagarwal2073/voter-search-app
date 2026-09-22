const fs = require('fs');
const path = require('path');

async function fetchDatabases() {
  const dbDir = path.resolve(process.cwd(), 'data');
  const votersDbPath = path.join(dbDir, 'voters.db');
  const authDbPath = path.join(dbDir, 'auth.db');

  // If voters.db already exists locally, skip downloading
  if (fs.existsSync(votersDbPath)) {
    console.log('[fetch-db] data/voters.db already exists. Skipping cloud download.');
    return;
  }

  // Check for GCP credentials in environment
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY;
  const projectId = process.env.GCP_PROJECT_ID;

  if (!clientEmail || !privateKey) {
    console.warn('[fetch-db] No GCP credentials detected.');
    console.warn('[fetch-db] Skipping cloud database download (build will continue).');
    return;
  }

  console.log('[fetch-db] Downloading voters.db from Google Cloud Storage...');

  try {
    const { Storage } = require('@google-cloud/storage');
    const storageOptions = {
      projectId: projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    };

    const storage = new Storage(storageOptions);
    const bucketName = process.env.ARCHIVE_BUCKET_NAME || 'ocr-voter-lists-archive';
    const bucket = storage.bucket(bucketName);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Download voters.db from GCS
    console.log('[fetch-db] Downloading nagar_parishad/Database/voters.db ...');
    await bucket.file('nagar_parishad/Database/voters.db').download({ destination: votersDbPath });
    console.log('[fetch-db] Successfully downloaded voters.db');

    // Download auth.db from GCS
    try {
      console.log('[fetch-db] Downloading nagar_parishad/Database/auth.db ...');
      await bucket.file('nagar_parishad/Database/auth.db').download({ destination: authDbPath });
      console.log('[fetch-db] Successfully downloaded auth.db');
    } catch (authErr) {
      console.warn('[fetch-db] Notice: Could not download auth.db (will be auto-initialized if missing):', authErr.message);
    }

  } catch (err) {
    console.error('[fetch-db] Failed to fetch databases from GCS:', err.message);
    // Allow the build to continue rather than hard crashing
  }
}

fetchDatabases();
