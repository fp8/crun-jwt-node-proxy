import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp();

async function main(): Promise<void> {
    const uid = process.argv[2];
    if (!uid) {
        console.error('Please provide a user ID as the first argument.');
        process.exit(1);
    }
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, { roles: ['user', 'admin'] });
}

main().catch((error) => {
    console.error('Error setting custom user claims:', error);
    process.exit(1);
});
