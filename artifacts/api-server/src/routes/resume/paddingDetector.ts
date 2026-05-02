import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/padding-detector", async (req, res) => {
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

    const bullets = [
      ...parsed.rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => (l.startsWith("•") || l.startsWith("-") || l.startsWith("*") || /^[–—]\s/.test(l)) && l.length > 15)
        .map((l) => l.replace(/^[•\-*–—]\s*/, "").trim()),
      ...parsed.experience.filter((l) => l.length > 20),
    ]
      .filter((l) => l.length > 10)
      .slice(0, 18);

    const prompt = `You are a brutal but fair resume coach. Your job is to classify every resume bullet as a genuine achievement or filler padding — then explain WHY with specific signals.

ACHIEVEMENT signals: Strong action verbs, quantified results (%, $, #, time), specific technology/tool named, clear ownership ("I built", "Led", "Designed"), unique accomplishment that not everyone could claim, business impact stated.

PADDING signals: Weak openers ("Helped", "Assisted", "Worked on", "Responsible for", "Involved in"), no numbers, could apply to any person at any company, generic descriptions, buzzwords, obvious duties stated as achievements.

Resume bullets to judge:
${bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Resume context (first 400 chars for role inference):
${parsed.rawText.substring(0, 400)}

Return ONLY a valid JSON object:
{
  "overallPaddingRatio": 60,
  "achievementRatio": 40,
  "verdict": "One punchy sentence verdict on the resume's bullet quality",
  "bullets": [
    {
      "text": "exact bullet text",
      "type": "padding|achievement|mixed",
      "score": 25,
      "reason": "Specific 1-sentence explanation of why it's padding or achievement",
      "signals": ["weak_verb|no_metrics|no_ownership|generic|buzzword|quantified|specific_impact|strong_verb|unique_claim"]
    }
  ],
  "paddingCount": 7,
  "achievementCount": 3,
  "topAchievements": ["up to 3 best bullet texts verbatim"],
  "worstPadding": ["up to 3 worst padding bullet texts verbatim"],
  "overallAdvice": "2-3 sentences of concrete advice to flip padding into achievements"
}

Rules:
- score: 0=pure padding, 100=perfect achievement. Be harsh — most resumes score 15-40.
- type "mixed" = has some good elements but missing key achievement components
- signals: use exact strings from the enum list, multiple allowed
- Return ONLY valid JSON, no markdown fences`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    });

    const text = response.text ?? "{}";
    let result: {
      overallPaddingRatio?: number;
      achievementRatio?: number;
      verdict?: string;
      bullets?: Array<{
        text: string;
        type: string;
        score: number;
        reason: string;
        signals: string[];
      }>;
      paddingCount?: number;
      achievementCount?: number;
      topAchievements?: string[];
      worstPadding?: string[];
      overallAdvice?: string;
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { overallPaddingRatio: 50, achievementRatio: 50, bullets: [], topAchievements: [], worstPadding: [] };
    }

    res.json({
      overallPaddingRatio: result.overallPaddingRatio ?? 50,
      achievementRatio: result.achievementRatio ?? 50,
      verdict: result.verdict ?? "",
      bullets: result.bullets ?? [],
      paddingCount: result.paddingCount ?? 0,
      achievementCount: result.achievementCount ?? 0,
      topAchievements: result.topAchievements ?? [],
      worstPadding: result.worstPadding ?? [],
      overallAdvice: result.overallAdvice ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Padding detection failed";
    res.status(500).json({ error: "padding_detector_failed", message: msg });
  }
});

export default router;
