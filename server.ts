import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim().length > 10
    );
    res.json({
      status: 'ok',
      aiConfigured: hasGeminiKey,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/ai/case-brief', async (req, res) => {
    const { caseRecord, institution, actions, relatedCases, overlapAlerts } = req.body || {};
    if (!caseRecord) {
      return res.status(400).json({ error: 'Missing caseRecord payload' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isConfigured = Boolean(
      apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10
    );

    if (!isConfigured) {
      return res.status(200).json({
        mode: 'deterministic_fallback',
        reason: 'GEMINI_API_KEY not configured on server; generated via deterministic template engine.',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are an administrative case-briefing assistant for AICTE officials.
Generate a structured, objective, non-punitive draft case brief based strictly on the provided records.
Never make final legal determinations or automatically close complaints. Cite Case IDs and Action IDs where relevant.

Case Record: ${JSON.stringify(caseRecord)}
Institution: ${JSON.stringify(institution)}
Actions History: ${JSON.stringify(actions || [])}
Related Cases: ${JSON.stringify(relatedCases || [])}
Overlap Alerts: ${JSON.stringify(overlapAlerts || [])}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyDatesAndActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              overlapEvidence: { type: Type.STRING },
              missingInformation: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              suggestedNextAction: { type: Type.STRING },
              draftCoordinationNote: { type: Type.STRING },
            },
            required: [
              'summary',
              'keyDatesAndActions',
              'overlapEvidence',
              'missingInformation',
              'suggestedNextAction',
              'draftCoordinationNote',
            ],
          },
        },
      });

      const text = response.text;
      if (!text) {
        return res.status(200).json({
          mode: 'deterministic_fallback',
          reason: 'Empty response from AI model; using deterministic fallback.',
        });
      }

      const parsed = JSON.parse(text.trim());
      return res.json({
        mode: 'gemini_live',
        brief: parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(200).json({
        mode: 'deterministic_fallback',
        reason: err?.message || 'AI call failed; using deterministic template engine.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AICTE Dashboard server listening on http://localhost:${PORT}`);
  });
}

startServer();
