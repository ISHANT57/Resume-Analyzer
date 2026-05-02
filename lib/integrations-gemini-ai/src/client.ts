import { GoogleGenAI } from "@google/genai";

const replitBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const replitApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const directApiKey = process.env.GEMINI_API_KEY;

if (!replitApiKey && !directApiKey) {
  throw new Error(
    "Gemini API key must be set. Provide AI_INTEGRATIONS_GEMINI_API_KEY (Replit) or GEMINI_API_KEY (direct).",
  );
}

export const ai = replitBaseUrl && replitApiKey
  ? new GoogleGenAI({
      apiKey: replitApiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: replitBaseUrl,
      },
    })
  : new GoogleGenAI({
      apiKey: directApiKey!,
    });
