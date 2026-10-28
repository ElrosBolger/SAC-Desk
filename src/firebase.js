import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  getDocFromServer,
  serverTimestamp
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import firebaseAppletConfig from '../firebase-applet-config.json';

// 1. CONFIGURAZIONE UFFICIALE FIREBASE (PROVISIONED CLOUD FIRESTORE & AUTH)
// Priorità assoluta a firebase-applet-config.json (provisionato ufficialmente)
// per evitare conflitti con eventuali variabili VITE_FIREBASE_* obsolete nell'ambiente
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey || env.VITE_FIREBASE_API_KEY,
  authDomain: firebaseAppletConfig.authDomain || env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseAppletConfig.projectId || env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: firebaseAppletConfig.storageBucket || env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseAppletConfig.messagingSenderId || env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseAppletConfig.appId || env.VITE_FIREBASE_APP_ID,
  ...(firebaseAppletConfig.measurementId
    ? { measurementId: firebaseAppletConfig.measurementId }
    : {})
};

export const firestoreDatabaseId =
  firebaseAppletConfig.firestoreDatabaseId ||
  env.VITE_FIREBASE_DATABASE_ID ||
  '(default)';

// Inizializza l'applicazione Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inizializza Cloud Firestore puntando al database nominato provisionato
// con auto-rilevamento Long Polling per massima compatibilità proxy/iframe/mobile
let db;
try {
  db = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true
    },
    firestoreDatabaseId
  );
} catch (_err) {
  db = getFirestore(app, firestoreDatabaseId);
}

const auth = getAuth(app);

// =============================================================
// GESTIONE STRUTTURATA ERRORI FIRESTORE & SANITIZZAZIONE ID
// =============================================================
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

function sanitizeDocId(rawId, fallbackPrefix = 'DOC') {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

export function handleFirestoreError(error, operationType, path) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  const errInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };

  if (
    code === 'permission-denied' ||
    message.includes('Missing or insufficient permissions')
  ) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  console.warn(`[FIREBASE] Avviso operazione ${operationType} su ${path}:`, message);
  throw error;
}

// Test di connettività obbligatorio per verifica stato backend all'avvio
export async function testConnection() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log(`[FIREBASE] Connessione a Cloud Firestore (${firestoreDatabaseId}) verificata con successo.`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    } else if (
      error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(error, OperationType.GET, 'test/connection');
    } else {
      console.warn('[FIREBASE] Test connettività completato in modalità locale/offline.');
    }
    return false;
  }
}

// =============================================================
// SEEDING AUTOMATICO OPERATORI (SE LA RACCOLTA È VUOTA)
// =============================================================
export const INITIAL_OPERATORS_SEED = [
  {
    matricola: 'TIA-90001',
    matricolaTIA: 'TIA-90001',
    nome: 'Vincenzo',
    cognome: 'Bellini',
    email: 'vincenzo.bellini@sacdesk.aeroporto.it',
    ruolo: 'superadmin',
    mansioni: ['DUTY_MANAGER', 'DUTY_SUPERVISOR', 'DUTY_CONTROL_ROOM', 'DUTY_RX', 'DUTY_CAPOTURNO', 'DUTY_COORDINATORE'],
    certificazioniENAC: {
      A1: { active: true, expiry: '2028-12-31' },
      A2: { active: true, expiry: '2028-12-31' },
      A3: { active: true, expiry: '2028-12-31' },
      A4: { active: true, expiry: '2028-12-31' },
      A5: { active: true, expiry: '2028-12-31' },
      A6: { active: true, expiry: '2028-12-31' },
      A11: { active: true, expiry: '2028-12-31' },
      A12: { active: true, expiry: '2028-12-31' },
      A12bis: { active: true, expiry: '2028-12-31' }
    },
    decretoPrefettura: {
      numero: 'DEC-PREF-CAT-90001/2024',
      rilascio: '2024-01-15',
      scadenza: '2029-01-15'
    },
    stato: 'approvato',
    statoAccount: 'approvato',
    phone: '+39 095 7239100',
    station: 'Direzione Security & CRU Generale'
  },
  {
    matricola: 'TIA-10045',
    matricolaTIA: 'TIA-10045',
    nome: 'Marco',
    cognome: 'Valenti',
    email: 'marco.valenti@sacdesk.aeroporto.it',
    ruolo: 'supervisore',
    mansioni: ['DUTY_SUPERVISOR', 'DUTY_CAPOTURNO'],
    certificazioniENAC: {
      A1: { active: true, expiry: '2028-06-30' },
      A4: { active: true, expiry: '2028-06-30' },
      A11: { active: true, expiry: '2028-06-30' }
    },
    decretoPrefettura: {
      numero: 'DEC-PREF-CAT-10045/2023',
      rilascio: '2023-04-10',
      scadenza: '2028-04-10'
    },
    stato: 'approvato',
    statoAccount: 'approvato',
    phone: '+39 340 1122334',
    station: 'Supervisione Varchi Terminal A'
  },
  {
    matricola: 'TIA-20188',
    matricolaTIA: 'TIA-20188',
    nome: 'Giulia',
    cognome: 'Russo',
    email: 'giulia.russo@sacdesk.aeroporto.it',
    ruolo: 'coordinatore',
    mansioni: ['DUTY_COORDINATORE', 'DUTY_CONTROL_ROOM'],
    certificazioniENAC: {
      A1: { active: true, expiry: '2027-11-15' },
      A5: { active: true, expiry: '2027-11-15' },
      A12bis: { active: true, expiry: '2027-11-15' }
    },
    decretoPrefettura: {
      numero: 'DEC-PREF-CAT-20188/2024',
      rilascio: '2024-02-01',
      scadenza: '2029-02-01'
    },
    stato: 'approvato',
    statoAccount: 'approvato',
    phone: '+39 347 9988776',
    station: 'Coordinamento Qualità & Sala CRU'
  },
  {
    matricola: 'TIA-30412',
    matricolaTIA: 'TIA-30412',
    nome: 'Alessio',
    cognome: 'Conti',
    email: 'alessio.conti@sacdesk.aeroporto.it',
    ruolo: 'operatore',
    mansioni: ['DUTY_RX'],
    certificazioniENAC: {
      A1: { active: true, expiry: '2028-01-20' },
      A2: { active: true, expiry: '2028-01-20' }
    },
    decretoPrefettura: {
      numero: 'DEC-PREF-CAT-30412/2024',
      rilascio: '2024-05-12',
      scadenza: '2029-05-12'
    },
    stato: 'approvato',
    statoAccount: 'approvato',
    phone: '+39 333 4455667',
    station: 'Linea RX Scanner EDS-C3 Varco 4'
  }
];

export async function seedOperatorsIfEmpty() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }
  try {
    const operatorsCol = collection(db, 'operators');
    const snap = await getDocs(operatorsCol);
    if (snap.empty) {
      console.log('[FIREBASE] Collezione operators vuota. Inizializzazione seed operatori di scalo...');
      for (const op of INITIAL_OPERATORS_SEED) {
        const docId = sanitizeDocId(op.matricola, 'TIA');
        await setDoc(doc(db, 'operators', docId), {
          ...op,
          createdAt: new Date().toISOString()
        });
      }
      console.log('[FIREBASE] Seeding completato. SuperAdmin Vincenzo Bellini (TIA-90001) attivo su Cloud Firestore.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'operators');
    }
    console.warn('[FIREBASE] Avviso seeding operators:', err.message || err);
  }
}

// =============================================================
// LISTENER & OPERAZIONI REALTIME FIRESTORE
// =============================================================

// Listener Real-time Raccolta "operators"
export function subscribeToOperators(callback) {
  const q = collection(db, 'operators');
  return onSnapshot(
    q,
    (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(list);
    },
    (error) => {
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'operators');
      }
      console.warn('[FIREBASE] Listener operators avviso:', error?.message || error);
    }
  );
}

// Scrittura/Aggiornamento Operatore su Firestore
export async function saveOperatorToFirestore(operatorData) {
  const rawTia = operatorData.matricola || operatorData.matricolaTIA || operatorData.tia;
  if (!rawTia) throw new Error('Matricola TIA mancante');
  const tia = sanitizeDocId(rawTia, 'TIA');
  const ref = doc(db, 'operators', tia);
  try {
    await setDoc(
      ref,
      {
        ...operatorData,
        matricola: rawTia,
        matricolaTIA: rawTia,
        stato: operatorData.stato || 'approvato',
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `operators/${tia}`);
  }
}

// Eliminazione Operatore da Firestore
export async function deleteOperatorFromFirestore(tia) {
  if (!tia) return;
  const docId = sanitizeDocId(tia, 'TIA');
  const ref = doc(db, 'operators', docId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `operators/${docId}`);
  }
}

// Listener Real-time Raccolta "shifts_punches" (Timbrature Presidio)
export function subscribeToShiftsPunches(callback) {
  const q = collection(db, 'shifts_punches');
  return onSnapshot(
    q,
    (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(list);
    },
    (error) => {
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'shifts_punches');
      }
      console.warn('[FIREBASE] Listener shifts_punches avviso:', error?.message || error);
    }
  );
}

// Scrittura Timbratura Presidio su Firestore
export async function saveShiftPunchToFirestore(punchData) {
  const id = sanitizeDocId(punchData.id || `PUN-${Date.now()}`, 'PUN');
  const ref = doc(db, 'shifts_punches', id);
  const dataToSave = {
    id,
    operatoreMatricola: punchData.operatoreMatricola || punchData.tia || punchData.operatorTia || 'TIA-90001',
    operatoreNome: punchData.operatoreNome || punchData.operatorName || punchData.fullName || 'Vincenzo Bellini',
    tipo: punchData.tipo || (punchData.shiftStart && !punchData.shiftEnd ? 'ENTRATA' : 'USCITA'),
    timestamp: serverTimestamp(),
    timestampIso: new Date().toISOString(),
    postazione: punchData.postazione || punchData.station || 'Control Room Alpha',
    gpsStatus: punchData.gpsStatus || 'PRESIDIO CONFERMATO IN SEDIME (distanza: 0 m)',
    distanzaMetri: punchData.distanzaMetri !== undefined ? punchData.distanzaMetri : null,
    // Campi legacy per retrocompatibilità UI
    ...punchData,
    updatedAt: new Date().toISOString()
  };
  try {
    await setDoc(ref, dataToSave, { merge: true });
    return dataToSave;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shifts_punches/${id}`);
  }
}

// Listener Real-time Raccolta "incident_reports" (Registro Segnalazioni & Verbali)
export function subscribeToIncidentReports(callback) {
  const q = collection(db, 'incident_reports');
  return onSnapshot(
    q,
    (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(list);
    },
    (error) => {
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'incident_reports');
      }
      console.warn('[FIREBASE] Listener incident_reports avviso:', error?.message || error);
    }
  );
}

// Scrittura Segnalazione / Verbale su Firestore
export async function saveIncidentReportToFirestore(reportData) {
  const id = sanitizeDocId(reportData.id || `REP-${Date.now()}`, 'REP');
  const ref = doc(db, 'incident_reports', id);
  const dataToSave = {
    id,
    protocollo: reportData.protocollo || id,
    priorita: reportData.severity || reportData.priorita || 'Ordinaria',
    areaScalo: reportData.area || reportData.location || 'Varco Security Principale',
    descrizione: reportData.description || reportData.title || '',
    redattoreTIA: reportData.authorTia || reportData.tia || 'TIA-90001',
    redattoreNome: reportData.author || reportData.authorName || 'Operatore',
    timestamp: serverTimestamp(),
    timestampIso: new Date().toISOString(),
    stato: (reportData.status || 'Aperta').toLowerCase(),
    // Campi legacy
    ...reportData,
    updatedAt: new Date().toISOString()
  };
  try {
    await setDoc(ref, dataToSave, { merge: true });
    return dataToSave;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `incident_reports/${id}`);
  }
}

// Autenticazione passiva non bloccante con credenziali o Matricola TIA
let emailPasswordProviderAvailable = true;
export async function firebaseLoginWithCredentials(emailOrTia, password) {
  if (!emailPasswordProviderAvailable) {
    return { success: false, code: 'auth/operation-not-allowed', skipped: true };
  }
  let email = emailOrTia.trim();
  if (!email.includes('@')) {
    email = `${email.toLowerCase()}@sacdesk.aeroporto.it`;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (err) {
    if (err?.code === 'auth/operation-not-allowed' || err?.code === 'auth/configuration-not-found') {
      emailPasswordProviderAvailable = false;
      return { success: false, error: err.message, code: err.code };
    }
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: newCred.user, autoCreated: true };
      } catch (signupErr) {
        if (signupErr?.code === 'auth/operation-not-allowed' || signupErr?.code === 'auth/configuration-not-found') {
          emailPasswordProviderAvailable = false;
        }
        return { success: false, error: err.message, code: err.code };
      }
    }
    return { success: false, error: err.message, code: err.code };
  }
}

// Esportazione Global Bridge per interoperabilità con il frontend
if (typeof window !== 'undefined') {
  window.FirebaseBridge = {
    app,
    db,
    auth,
    firestoreDatabaseId,
    testConnection,
    seedOperatorsIfEmpty,
    subscribeToOperators,
    saveOperatorToFirestore,
    deleteOperatorFromFirestore,
    subscribeToShiftsPunches,
    saveShiftPunchToFirestore,
    subscribeToIncidentReports,
    saveIncidentReportToFirestore,
    firebaseLoginWithCredentials,
    handleFirestoreError,
    isInitialized: true
  };

  // Esegui test connettività e seed automatico all'avvio
  testConnection().then((connected) => {
    if (connected) {
      seedOperatorsIfEmpty();
    }
  });
}

export {
  app,
  db,
  auth
};
