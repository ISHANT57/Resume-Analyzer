import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/recruiter-sim", async (req, res) => {
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

    const prompt = `You are simulating an experienced recruiter doing a rapid 6-second resume scan.

Research shows recruiters follow this eye-tracking pattern:
1. Name + current title (0-1s)
2. Most recent company + dates (1-2s)  
3. Summary/objective if present (2-3s)
4. Skills section scan (3-4s)
5. Education briefly (4-5s)
6. Any standout achievements/metrics (5-6s)

Resume to evaluate:
${parsed.rawText.substring(0, 2500)}

Simulate a real recruiter reviewing this. Be honest and critical.

Return ONLY a valid JSON object:
{
  "verdict": "shortlisted",
  "verdictLabel": "Shortlisted for Interview" OR "Rejected in 6 Seconds" OR "Maybe — Needs Follow-up",
  "confidenceScore": 78,
  "firstImpression": "What the recruiter thinks in the first 2 seconds (1-2 sentences)",
  "sixSecondSummary": "What the recruiter concludes after 6 seconds (2-3 sentences)",
  "attentionMap": [
    {
      "section": "Header & Contact Info",
      "attentionLevel": "high",
      "timeSpent": "1.2s",
      "recruiterThought": "What they actually think when seeing this section",
      "score": 80,
      "issues": ["issue if any"],
      "positives": ["what looks good"]
    },
    {
      "section": "Professional Summary",
      "attentionLevel": "medium",
      "timeSpent": "0.8s",
      "recruiterThought": "...",
      "score": 50,
      "issues": [],
      "positives": []
    },
    {
      "section": "Work Experience",
      "attentionLevel": "high",
      "timeSpent": "2.0s",
      "recruiterThought": "...",
      "score": 65,
      "issues": [],
      "positives": []
    },
    {
      "section": "Skills",
      "attentionLevel": "medium",
      "timeSpent": "0.8s",
      "recruiterThought": "...",
      "score": 70,
      "issues": [],
      "positives": []
    },
    {
      "section": "Education",
      "attentionLevel": "low",
      "timeSpent": "0.4s",
      "recruiterThought": "...",
      "score": 75,
      "issues": [],
      "positives": []
    },
    {
      "section": "Projects",
      "attentionLevel": "low",
      "timeSpent": "0.3s",
      "recruiterThought": "...",
      "score": 60,
      "issues": [],
      "positives": []
    }
  ],
  "criticalStrengths": ["Strength 1", "Strength 2"],
  "criticalWeaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "whatWouldGetThemShortlisted": ["Concrete action 1", "Concrete action 2", "Concrete action 3"],
  "redFlags": ["Any immediate red flags a recruiter would notice"]
}

attentionLevel must be one of: "high", "medium", "low", "ignored"
verdict must be one of: "shortlisted", "rejected", "maybe"
Be honest — most resumes get rejected in 6 seconds.
Return ONLY valid JSON, no markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    });

    const text = response.text ?? "{}";
    let result: {
      verdict?: string;
      verdictLabel?: string;
      confidenceScore?: number;
      firstImpression?: string;
      sixSecondSummary?: string;
      attentionMap?: Array<{
        section: string; attentionLevel: string; timeSpent: string;
        recruiterThought: string; score: number; issues: string[]; positives: string[];
      }>;
      criticalStrengths?: string[];
      criticalWeaknesses?: string[];
      whatWouldGetThemShortlisted?: string[];
      redFlags?: string[];
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { verdict: "maybe", verdictLabel: "Simulation unavailable", attentionMap: [] };
    }

    res.json({
      verdict: result.verdict ?? "maybe",
      verdictLabel: result.verdictLabel ?? "Could not simulate",
      confidenceScore: result.confidenceScore ?? 50,
      firstImpression: result.firstImpression ?? "",
      sixSecondSummary: result.sixSecondSummary ?? "",
      attentionMap: result.attentionMap ?? [],
      criticalStrengths: result.criticalStrengths ?? [],
      criticalWeaknesses: result.criticalWeaknesses ?? [],
      whatWouldGetThemShortlisted: result.whatWouldGetThemShortlisted ?? [],
      redFlags: result.redFlags ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Recruiter simulation failed";
    res.status(500).json({ error: "recruiter_sim_failed", message: msg });
  }
});

export default router;
