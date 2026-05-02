import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseResume } from "./parser";

const router = Router();

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must", "you", "we",
    "our", "your", "their", "this", "that", "these", "those", "it", "its",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .reduce((acc: string[], word) => {
      if (!acc.includes(word)) acc.push(word);
      return acc;
    }, []);
}

router.post("/match-job", async (req, res) => {
  try {
    const { resumeId, jobDescription } = req.body as { resumeId?: number; jobDescription?: string };

    if (!resumeId || !jobDescription) {
      res.status(400).json({ error: "bad_request", message: "resumeId and jobDescription are required" });
      return;
    }

    const [resume] = await db
      .select()
      .from(resumesTable)
      .where(eq(resumesTable.id, resumeId));

    if (!resume) {
      res.status(404).json({ error: "not_found", message: "Resume not found" });
      return;
    }

    const parsed = await parseResume(resume.fileContent ? Buffer.from(resume.fileContent, "base64") : resume.filePath, resume.mimeType ?? "application/pdf");

    const resumeKeywords = extractKeywords(parsed.rawText);
    const jobKeywords = extractKeywords(jobDescription);

    // Filter job keywords that are meaningful (longer words, technical terms)
    const importantJobKeywords = jobKeywords.filter(
      (k) => k.length > 3 || ["sql", "api", "aws", "gcp", "ci", "cd", "ml", "ai"].includes(k)
    );

    const matchedKeywords = importantJobKeywords.filter((k) => resumeKeywords.includes(k));
    const missingKeywords = importantJobKeywords
      .filter((k) => !resumeKeywords.includes(k))
      .slice(0, 15);

    const matchPercentage = importantJobKeywords.length > 0
      ? Math.round((matchedKeywords.length / importantJobKeywords.length) * 100)
      : 0;

    // Suggest skills based on missing keywords
    const techKeywords = missingKeywords.filter((k) =>
      /^(react|vue|angular|node|python|java|sql|docker|kubernetes|aws|gcp|azure|typescript|javascript|graphql|rest|agile|scrum|git|linux|terraform|redis|mongodb|postgresql|mysql|ci|cd|devops|machine|learning|tensorflow|pytorch)$/i.test(k)
    );

    res.json({
      matchPercentage,
      matchedKeywords: matchedKeywords.slice(0, 15),
      missingKeywords,
      suggestedSkills: techKeywords.slice(0, 8),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Matching failed";
    res.status(500).json({ error: "match_failed", message: msg });
  }
});

export default router;
