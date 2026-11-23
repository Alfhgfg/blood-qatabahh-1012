import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  let credential = undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(sa);
    } catch (e: any) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:', e?.message || e);
    }
  }

  initializeApp({
    projectId: firebaseConfig.projectId,
    ...(credential ? { credential } : {})
  });
}

export const adminAuth = getAuth();

let messagingInstance: any = null;
try {
  messagingInstance = getMessaging();
} catch (e: any) {
  console.warn('Firebase Admin getMessaging init notice:', e?.message || e);
}
export const adminMessaging = messagingInstance;

let firestoreInstance: any = null;
try {
  firestoreInstance = getFirestore();
} catch (e: any) {
  console.warn('Firebase Admin getFirestore init notice:', e?.message || e);
}
export const adminDb = firestoreInstance;

