import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/improve-bullets", async (req, res) => {
  try {
    const { resumeId } = req.body as { resumeId?: number };
    if (!resumeId) {
      res.status(400).json({ error: "bad_request", message: "resumeId is required" });
      return;
    }

    const [resume] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
    if (!resume) {
      res.status(404).json({ error: "not_found", message: "Resume not found" });
      return;
    }

    const parsed = await parseResume(resume.fileContent ? Buffer.from(resume.fileContent, "base64") : resume.filePath, resume.mimeType ?? "application/pdf");

    // Extract all bullet points
    const allBullets = parsed.rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => (l.startsWith("•") || l.startsWith("-") || l.startsWith("*") || /^[–—]\s/.test(l)) && l.length > 15)
      .map((l) => l.replace(/^[•\-*–—]\s*/, "").trim())
      .filter((l) => l.length > 10)
      .slice(0, 10);

    // If no bullets detected, use sentences from experience section
    const experienceSentences = allBullets.length < 3
      ? parsed.experience.filter((l) => l.length > 20).slice(0, 8)
      : [];

    const bullets = allBullets.length > 0 ? allBullets : experienceSentences;

    if (bullets.length === 0) {
      res.json({ improvements: [], summary: "No bullet points detected in this resume." });
      return;
    }

    const prompt = `You are a world-class resume writer. Your job is to transform weak resume bullets into powerful achievement statements.

Formula to use: [Strong Action Verb] + [Technology/Skill/Context] + [Result/Impact] + [Metrics]

Examples of transformations:
- WEAK: "Worked on React components"
  STRONG: "Engineered 20+ reusable React component library used across 4 product teams, cutting UI development time by 35%"

- WEAK: "Helped with database optimization"
  STRONG: "Optimized 12 slow PostgreSQL queries using indexing and query restructuring, reducing average API response time from 800ms to 95ms"

- WEAK: "Was responsible for customer support"
  STRONG: "Resolved 150+ customer escalations monthly with 96% satisfaction rate, reducing average resolution time from 48h to 6h"

Bullets to improve:
${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Resume context (for industry/role inference):
${parsed.rawText.substring(0, 500)}

Return ONLY a valid JSON object:
{
  "improvements": [
    {
      "original": "exact original bullet text",
      "improved": "powerful rewritten version",
      "explanation": "What was changed and why it's stronger",
      "formulaBreakdown": {
        "action": "the strong verb used",
        "context": "technology or skill or context",
        "impact": "the result or outcome",
        "metrics": "the quantified measurement (or 'estimated — add real numbers')"
      },
      "weaknessIdentified": "What was wrong with the original",
      "improvementScore": 85
    }
  ],
  "overallAdvice": "2-3 sentences of overall advice for improving bullet points in this resume"
}

Rules:
- Keep improved bullets under 25 words
- Use present tense for current roles, past tense for previous
- If metrics aren't available, use realistic estimates with a note like "(add real numbers)"
- improvementScore: 0-100, how much better the new version is
- Return ONLY valid JSON, no markdown fences`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 6144 },
    });

    const text = response.text ?? "{}";
    let result: {
      improvements?: Array<{
        original: string;
        improved: string;
        explanation: string;
        formulaBreakdown: { action: string; context: string; impact: string; metrics: string };
        weaknessIdentified: string;
        improvementScore: number;
      }>;
      overallAdvice?: string;
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { improvements: [], overallAdvice: "Unable to process bullets." };
    }

    res.json({
      improvements: result.improvements ?? [],
      overallAdvice: result.overallAdvice ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bullet improvement failed";
    res.status(500).json({ error: "improve_bullets_failed", message: msg });
  }
});

export default router;
