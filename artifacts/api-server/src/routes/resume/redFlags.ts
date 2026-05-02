import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/red-flags", async (req, res) => {
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

    const prompt = `You are a ruthlessly honest hiring manager who has reviewed 10,000+ resumes. Your job is to identify every red flag that would cause an immediate disqualification or make a recruiter pause.

Resume Text:
${parsed.rawText.substring(0, 3000)}

Scan for ALL of these red flag categories:
1. DATE GAPS — unexplained employment gaps > 3 months
2. BUZZWORDS — overused, meaningless words ("results-driven", "team player", "passionate", "hardworking", "dynamic", "synergy", "leverage", "proactive", "go-getter", "detail-oriented", "self-starter")
3. VAGUE IMPACT — bullets with no measurable results, no ownership, no specifics (e.g., "helped with", "worked on", "assisted in", "responsible for", "involved in")
4. ATS FORMATTING TRAPS — tables, columns, headers/footers, images, special characters, non-standard fonts, graphics, text boxes, unusual section names
5. CREDIBILITY ISSUES — generic descriptions that could apply to anyone, inflated titles, inconsistent dates, unverifiable claims
6. STRUCTURAL PROBLEMS — missing contact info, no LinkedIn/GitHub, wall of text, too long, inconsistent formatting

Return ONLY a valid JSON object:
{
  "overallRisk": "high|medium|low",
  "riskScore": 72,
  "summary": "2-3 sentence executive summary of the resume's main red flag issues",
  "flags": [
    {
      "category": "date_gap|buzzword|vague_impact|ats_formatting|credibility|structural",
      "severity": "critical|warning|info",
      "title": "Short, punchy flag title",
      "description": "Specific detail about what is wrong and where",
      "location": "Section or quote where found",
      "howToFix": "Concrete 1-2 sentence fix"
    }
  ],
  "buzzwordsFound": ["results-driven", "team player"],
  "atsFormatIssues": ["Issue 1", "Issue 2"],
  "quickFixes": ["Fix 1", "Fix 2", "Fix 3"],
  "disqualificationRisk": "Would this resume survive the first 10-second scan? Answer in 1 sentence."
}

Rules:
- flags: identify ALL issues, no sugar-coating. Be specific, cite actual text from the resume.
- severity critical = likely immediate discard. warning = raises doubts. info = minor polish needed.
- buzzwordsFound: list every overused buzzword found verbatim
- atsFormatIssues: list concrete formatting issues that break ATS parsing
- quickFixes: top 3 most impactful changes the person can make right now
- riskScore: 0=perfect, 100=immediate discard. Be honest.
- Return ONLY valid JSON, no markdown fences`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    });

    const text = response.text ?? "{}";
    let result: {
      overallRisk?: string;
      riskScore?: number;
      summary?: string;
      flags?: Array<{
        category: string;
        severity: string;
        title: string;
        description: string;
        location: string;
        howToFix: string;
      }>;
      buzzwordsFound?: string[];
      atsFormatIssues?: string[];
      quickFixes?: string[];
      disqualificationRisk?: string;
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { overallRisk: "medium", riskScore: 50, flags: [], buzzwordsFound: [], atsFormatIssues: [], quickFixes: [] };
    }

    res.json({
      overallRisk: result.overallRisk ?? "medium",
      riskScore: result.riskScore ?? 50,
      summary: result.summary ?? "",
      flags: result.flags ?? [],
      buzzwordsFound: result.buzzwordsFound ?? [],
      atsFormatIssues: result.atsFormatIssues ?? [],
      quickFixes: result.quickFixes ?? [],
      disqualificationRisk: result.disqualificationRisk ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Red flag scan failed";
    res.status(500).json({ error: "red_flags_failed", message: msg });
  }
});

export default router;
