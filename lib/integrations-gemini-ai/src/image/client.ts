import { GoogleGenAI, Modality } from "@google/genai";

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

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
