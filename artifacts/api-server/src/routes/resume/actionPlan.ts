import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable, analysisResultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";
import { scoreResume } from "./scoring";

const router = Router();

router.post("/action-plan", async (req, res) => {
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
    const scoring = scoreResume(parsed, parsed.rawText, (resume.mimeType ?? "application/pdf") === "application/pdf");

    const issuesSummary = scoring.issues
      .sort((a, b) => (a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0))
      .slice(0, 8)
      .map(i => `- [${i.severity.toUpperCase()}] ${i.message}`)
      .join("\n");

    const prompt = `You are a senior career coach and resume strategist. Based on this resume analysis, generate a personalized, prioritized action plan.

RESUME ANALYSIS SUMMARY:
- Overall Score: ${scoring.overallScore}/100
- Impact Score: ${scoring.impactScore}/100
- ATS Score: ${scoring.atsScore}/100
- Content Score: ${scoring.contentScore}/100
- Metrics found: ${scoring.metricsCount}
- Weak bullets: ${scoring.weakBullets.length}
- Strong bullets: ${scoring.strongBullets.length}
- Missing sections: ${scoring.missingSections.join(", ") || "none"}

TOP ISSUES DETECTED:
${issuesSummary || "No critical issues found"}

RESUME SNIPPET:
${parsed.rawText.slice(0, 1200)}

Generate exactly 6 prioritized action steps. Each step must be:
1. Specific and actionable (not generic advice)
2. Tied to real issues detected above
3. Include an estimated score improvement

Return ONLY valid JSON in this exact format:
{
  "steps": [
    {
      "step": 1,
      "priority": "critical",
      "action": "Short imperative action (max 60 chars)",
      "what": "Specific explanation of exactly what to do",
      "why": "Why this matters for ATS and recruiter decisions",
      "expectedScoreGain": 12,
      "effort": "15 mins"
    }
  ]
}

Priority must be one of: "critical", "high", "medium"
expectedScoreGain must be an integer between 2 and 20
effort must be a realistic time estimate like "10 mins", "30 mins", "1 hour"
Order steps from highest impact to lowest.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const raw = response.text ?? "{}";
    const data = JSON.parse(raw);

    res.json({
      steps: data.steps ?? [],
      resumeScore: scoring.overallScore,
      impactScore: scoring.impactScore,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action plan generation failed";
    res.status(500).json({ error: "action_plan_failed", message: msg });
  }
});

export default router;
