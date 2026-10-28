import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore,
  collection, 
  doc, 
  setDoc, 
  addDoc,
  getDoc, 
  getDocs, 
  onSnapshot, 
  deleteDoc,
  getDocFromServer,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';

// 1. CONFIGURAZIONE UFFICIALE FIREBASE (FIRESTORE & AUTH)
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyCdQcDPpjfo1CCSaJls1cdXC6lMLqEGWJI",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "sac-desk-airport.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "sac-desk-airport",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "sac-desk-airport.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "580144414524",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:580144414524:web:d665838a059acfd5992839",
  measurementId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || "G-CH9BG449Z2"
};

// Inizializza l'applicazione Firebase (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// Test di connettività obbligatorio per verifica stato backend
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[FIREBASE] Connessione a Cloud Firestore verificata con successo.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("[FIREBASE] Client offline o database non raggiungibile:", error.message);
    } else {
      console.log("[FIREBASE] Test connettività completato.");
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
  try {
    const operatorsCol = collection(db, 'operators');
    const snap = await getDocs(operatorsCol);
    if (snap.empty) {
      console.log('[FIREBASE] Collezione operators vuota. Inizializzazione seed operatori di scalo...');
      for (const op of INITIAL_OPERATORS_SEED) {
        await setDoc(doc(db, 'operators', op.matricola), {
          ...op,
          createdAt: new Date().toISOString()
        });
      }
      console.log('[FIREBASE] Seeding completato. SuperAdmin Vincenzo Bellini (TIA-90001) attivo su Cloud Firestore.');
    }
  } catch (err) {
    console.warn('[FIREBASE] Avviso seeding operators:', err.message || err);
  }
}

// =============================================================
// LISTENER & OPERAZIONI REALTIME FIRESTORE
// =============================================================

// Listener Real-time Raccolta "operators"
export function subscribeToOperators(callback) {
  const q = collection(db, 'operators');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(list);
  }, (error) => {
    console.warn('[FIREBASE] Listener operators error:', error);
  });
}

// Scrittura/Aggiornamento Operatore su Firestore
export async function saveOperatorToFirestore(operatorData) {
  const tia = operatorData.matricola || operatorData.matricolaTIA || operatorData.tia;
  if (!tia) throw new Error('Matricola TIA mancante');
  const ref = doc(db, 'operators', tia);
  await setDoc(ref, {
    ...operatorData,
    matricola: tia,
    matricolaTIA: tia,
    stato: operatorData.stato || 'approvato',
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// Eliminazione Operatore da Firestore
export async function deleteOperatorFromFirestore(tia) {
  if (!tia) return;
  const ref = doc(db, 'operators', tia);
  await deleteDoc(ref);
}

// Listener Real-time Raccolta "shifts_punches" (Timbrature Presidio)
export function subscribeToShiftsPunches(callback) {
  const q = collection(db, 'shifts_punches');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(list);
  }, (error) => {
    console.warn('[FIREBASE] Listener shifts_punches error:', error);
  });
}

// Scrittura Timbratura Presidio su Firestore
export async function saveShiftPunchToFirestore(punchData) {
  const id = punchData.id || `PUN-${Date.now()}`;
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
  await setDoc(ref, dataToSave, { merge: true });
  return dataToSave;
}

// Listener Real-time Raccolta "incident_reports" (Registro Segnalazioni & Verbali)
export function subscribeToIncidentReports(callback) {
  const q = collection(db, 'incident_reports');
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(list);
  }, (error) => {
    console.warn('[FIREBASE] Listener incident_reports error:', error);
  });
}

// Scrittura Segnalazione / Verbale su Firestore
export async function saveIncidentReportToFirestore(reportData) {
  const id = reportData.id || `REP-${Date.now()}`;
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
  await setDoc(ref, dataToSave, { merge: true });
  return dataToSave;
}

// Autenticazione con credenziali o Matricola TIA
export async function firebaseLoginWithCredentials(emailOrTia, password) {
  let email = emailOrTia.trim();
  if (!email.includes('@')) {
    email = `${email.toLowerCase()}@sacdesk.aeroporto.it`;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: newCred.user, autoCreated: true };
      } catch (signupErr) {
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
    isInitialized: true
  };

  // Esegui test connettività e seed automatico all'avvio
  seedOperatorsIfEmpty();
  testConnection();
}

export {
  app,
  db,
  auth
};
