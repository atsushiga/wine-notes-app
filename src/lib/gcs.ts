import { Storage } from '@google-cloud/storage';

export const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
});

export const BUCKET = process.env.GCS_BUCKET_NAME!;
