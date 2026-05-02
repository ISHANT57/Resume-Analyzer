import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable, analysisResultsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/improve", async (req, res) => {
  try {
    const { resumeId, analysisId } = req.body as { resumeId?: number; analysisId?: number };

    if (!resumeId || !analysisId) {
      res.status(400).json({ error: "bad_request", message: "resumeId and analysisId are required" });
      return;
    }

    const [resume] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
    const [analysis] = await db.select().from(analysisResultsTable).where(eq(analysisResultsTable.id, analysisId));

    if (!resume || !analysis) {
      res.status(404).json({ error: "not_found", message: "Resume or analysis not found" });
      return;
    }

    const parsed = await parseResume(resume.fileContent ? Buffer.from(resume.fileContent, "base64") : resume.filePath, resume.mimeType ?? "application/pdf");
    const weakBullets = analysis.weakBulletsJson as string[];
    const issues = analysis.issuesJson as Array<{ type: string; message: string; severity: string }>;

    const prompt = `You are an expert resume coach. Analyze this resume data and provide improvements.

Resume Text (first 2000 chars):
${parsed.rawText.substring(0, 2000)}

Weak bullet points to improve:
${weakBullets.slice(0, 5).map((b, i) => `${i + 1}. ${b}`).join("\n")}

Current issues:
${issues.map((i) => `- ${i.message}`).join("\n")}

Current summary: ${parsed.summary || "None provided"}

Return a JSON object with this exact structure:
{
  "improvedBullets": [
    {"original": "original bullet", "improved": "improved bullet with strong verb and metrics"}
  ],
  "improvedSummary": "A compelling 3-4 sentence professional summary",
  "additionalSuggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
}

Rules:
- Use powerful action verbs (delivered, engineered, led, drove, scaled)
- Add quantified metrics where possible (%, $, time saved)
- Be specific and impactful
- Keep bullets concise (under 20 words each)
- Return ONLY valid JSON, no markdown`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    });

    const text = response.text ?? "{}";
    let result: { improvedBullets?: Array<{original: string; improved: string}>; improvedSummary?: string; additionalSuggestions?: string[] };

    try {
      result = JSON.parse(text);
    } catch {
      result = { improvedBullets: [], additionalSuggestions: ["Add quantified achievements", "Use stronger action verbs", "Include LinkedIn profile"] };
    }

    res.json({
      improvedBullets: result.improvedBullets ?? [],
      improvedSummary: result.improvedSummary ?? "",
      additionalSuggestions: result.additionalSuggestions ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Improvement failed";
    res.status(500).json({ error: "improve_failed", message: msg });
  }
});

export default router;
