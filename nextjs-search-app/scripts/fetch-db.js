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

  console.log('[fetch-db] Checking environment:');
  console.log(`[fetch-db] - GCP_PROJECT_ID: ${projectId ? 'Set' : 'Missing'}`);
  console.log(`[fetch-db] - GCP_CLIENT_EMAIL: ${clientEmail ? 'Set' : 'Missing'}`);
  console.log(`[fetch-db] - GCP_PRIVATE_KEY: ${privateKey ? 'Set (' + privateKey.length + ' chars)' : 'Missing'}`);

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
    const bucketName = process.env.GCS_BUCKET_NAME || process.env.ARCHIVE_BUCKET_NAME || 'ocr-voter-lists-archive';
    const datasetName = process.env.DATASET_NAME || 'nagar_parishad';
    console.log(`[fetch-db] Using bucket: ${bucketName} (dataset: ${datasetName})`);
    const bucket = storage.bucket(bucketName);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Download voters.db from GCS
    const votersDbRemote = `${datasetName}/Database/voters.db`;
    console.log(`[fetch-db] Downloading ${votersDbRemote} ...`);
    await bucket.file(votersDbRemote).download({ destination: votersDbPath });
    console.log('[fetch-db] Successfully downloaded voters.db');

    // Download auth.db from GCS
    try {
      const authDbRemote = `${datasetName}/Database/auth.db`;
      console.log(`[fetch-db] Downloading ${authDbRemote} ...`);
      await bucket.file(authDbRemote).download({ destination: authDbPath });
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
