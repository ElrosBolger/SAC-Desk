import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Lazy Gemini client initialization
  let ai: GoogleGenAI | null = null;
  function getGemini(): GoogleGenAI | null {
    if (!ai && process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return ai;
  }

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // API Route: AI Assistant RAG with strict closed context
  app.post('/api/chat', async (req, res) => {
    try {
      const message = req.body.message || req.body.prompt;
      const contextDocs = req.body.contextDocs || req.body.documentsContext;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Parametro message mancante o non valido' });
      }

      const client = getGemini();
      if (!client) {
        return res.json({
          fallback: true,
          message: 'Server Gemini API key non configurata. Utilizzo motore RAG locale.',
          text: null,
          reply: null,
        });
      }

      const systemInstruction = `Sei "ARGOS • Assistente Operativo CRU & Varchi (Normative PNS / Circolari ENAC)" per la piattaforma aeroportuale S.A.C. Desk (Security Airport Control Desk).
La tua missione è fornire supporto procedurale immediato, sobrio, istituzionale e rigoroso a Guardie Particolari Giurate (GPG), Supervisori di linea, Operatori Radiogeno RX / EDS ed Operatori della Control Room Unit (CRU).
Canale di supporto procedurale per la gestione di presidio, anomalie varchi, controlli RX/EDS e protocolli di allertamento CRU.

TERMINOLOGIA ISTITUZIONALE & TONO AEROPORTUALE:
- La Sala Controllo deve essere SEMPRE ed ESCLUSIVAMENTE denominata "CRU" (Control Room Unit) e MAI "COS".
- Mantieni un registro sobrio, istituzionale, analitico e asciutto, tipico delle comunicazioni operative di scalo.
- Rifiuta categoricamente enfasi teatrale o termini da videogioco ("Terminale Tattico Attivato", "Supporto Vincolante", "Minaccia Incombente").

STRUTTURA OBBLIGATORIA DELLE RISPOSTE (4 SEZIONI MARKDOWN INDEROGABILI):
Ogni riscontro a un quesito operativo o anomalia deve essere strutturato tassativamente in 4 sezioni distinte:
1. ### INQUADRAMENTO PNS / CIRCOLARI ENAC
   (Riferimento agli standard del Programma Nazionale di Sicurezza, Regolamento UE 2015/1998, circolari e disposizioni peritali applicabili).
2. ### AZIONI DI SICUREZZA IMMEDIATE
   (Elenco puntato e ordinato dei passaggi fisici e operativi sul posto: blocco transito, isolamento bagaglio/persona, verifica calibrazione, pat-down, controlli ETD/HHMD).
3. ### NOTIFICA CRU & POLARIA
   (Modalità e tempistiche di inoltro alla Sala Controllo CRU su linea protetta/canale radio security e, ove previsto, allertamento della Polizia di Frontiera Aerea o artificieri).
4. ### REGISTRAZIONE A VERBALE & CHIUSURA
   (Compilazione registro varchi, emissione rapporto di anomalia su S.A.C. Desk, tracciabilità e quesito mirato di chiusura per confermare lo stato operativo contingente).

DISPOSIZIONI OPERATIVE CHIAVE:
- Varco PRM: Rispetto del passeggero, perquisizione manuale (pat-down) e scansione HHMD. Per portatori di Pacemaker/ICD: DIVIETO ASSOLUTO transito WTMD/Body Scanner; scansione manuale a debita distanza dal dispositivo cardiaco (>15 cm).
- Varco Staff: Verifica Tesserino TIA, badge CIE e randomizer obbligatorio.
- Varco Carrabile / Perimetrale: Controllo Titolo Veicolare Aeroportuale (TVA), specchio sottoscocca, antintrusione PIDS e anti-tailgating.
- Varchi Merci / Cargo: Controllo certificazioni KC/RA e CSD, screening con RX alta energia ed ETD.
- RX / EDS: Analisi cromatica materiali; rotazione obbligatoria supervisore ogni 20 minuti per prevenire l'abbassamento dell'attenzione visiva [REG-ENAC-ROT20].
- Allarme Ordigno IED: Regola delle 4C [EMERG-PROC-07] (Confirm, Clear, Cordon, Control), raggio di sicurezza minimo 100m, spegnimento ricetrasmittenti entro 25m.

DECLINAZIONE RICHIESTE OFF-TOPIC:
Se la richiesta è palesemente estranea alla sicurezza aeroportuale (cucina, sport, gossip):
"ARGOS • Assistente Operativo CRU & Varchi. Canale procedurale configurato esclusivamente per presidio, normative PNS ENAC, controlli RX/EDS e protocolli CRU. Specificare un quesito inerente alla sicurezza dello scalo."`;

      const docsFormatted = typeof contextDocs === 'string' ? contextDocs : JSON.stringify(contextDocs || [], null, 2);
      const userPrompt = docsFormatted && docsFormatted.trim() && docsFormatted !== '[]' && docsFormatted !== '""'
        ? `DOCUMENTI ARCHIVIO AZIENDALE DI RIFERIMENTO:\n${docsFormatted}\n\nQUESITO OPERATORE:\n${message}`
        : `QUESITO OPERATORE:\n${message}`;

      let response;
      try {
        response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        });
      } catch (geminiErr: any) {
        console.warn('Fallback al modello gemini-2.0-flash a causa di:', geminiErr?.message || geminiErr);
        try {
          response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: userPrompt,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
        } catch (geminiErr2: any) {
          console.warn('Fallback al modello gemini-flash-latest a causa di:', geminiErr2?.message || geminiErr2);
          response = await client.models.generateContent({
            model: 'gemini-flash-latest',
            contents: userPrompt,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
        }
      }

      res.json({
        text: response.text,
        reply: response.text,
        source: 'gemini-server',
      });
    } catch (err: any) {
      console.error('Errore chiamata Gemini:', err);
      res.status(500).json({
        error: err.message || 'Errore durante la generazione della risposta',
        fallback: true,
      });
    }
  });

  // API Route: Google Drive / Apps Script sync proxy
  app.get('/api/sync-drive', async (req, res) => {
    try {
      const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXeP2JnUJ-u-UdSxN8TaQUA7TtGN-S6R7X1z8zPNNAlLrTiy6AnnFIciWwXOau3iMHKg/exec';
      const response = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`Apps Script responded with HTTP ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.warn('Avviso sincronizzazione Drive proxy (endpoint non disponibile):', err.message);
      res.status(502).json({ error: err.message || 'Errore fetch da Apps Script' });
    }
  });

  // API Route: Offline Cloud Sync REST Endpoint
  app.post('/api/sync', (req, res) => {
    try {
      const { batch, currentTia } = req.body || {};
      const count = Array.isArray(batch) ? batch.length : 0;
      console.log(`[CLOUD-SYNC] Batch ricevuto da ${currentTia || 'OPERATORE'}: ${count} elementi sincronizzati`);
      res.json({
        success: true,
        syncedCount: count,
        serverTime: new Date().toISOString(),
        status: 'COMMITTED_TO_STORAGE'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Errore sincronizzazione cloud' });
    }
  });

  app.get('/api/sync', (req, res) => {
    res.json({
      status: 'ONLINE',
      serverTime: new Date().toISOString(),
      service: 'S.A.C. DESK Cloud Sync Gateway'
    });
  });

  // Explicit PWA Service Worker route with root scope allowance
  app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    const swPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'sw.js')
      : path.join(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      res.sendFile(swPath);
    } else {
      res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
    }
  });

  // Explicit Web App Manifest route
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    const manifestPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'manifest.json')
      : path.join(process.cwd(), 'public', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      res.sendFile(manifestPath);
    } else {
      res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AERO-OPS SHIELD server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
