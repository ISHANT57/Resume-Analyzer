import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/benchmark", async (req, res) => {
  try {
    const { resumeId, jobTitle } = req.body as { resumeId?: number; jobTitle?: string };
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
    const roleContext = jobTitle?.trim() ? `for a "${jobTitle}" role` : "for a software/tech professional role";

    const prompt = `You are a career intelligence system that benchmarks resumes against top industry candidates.

You have access to data from thousands of resumes ${roleContext}. Compare this resume against:
- Top 10% candidates (elite tier)
- Top 25% candidates (strong tier)
- Median candidates (average tier)

Resume to benchmark:
${parsed.rawText.substring(0, 2500)}

Be honest and data-driven. Use realistic percentile estimates.

Return ONLY a valid JSON object:
{
  "percentileRank": 42,
  "tier": "average",
  "tierLabel": "Average Candidate",
  "overallGapSummary": "2-3 sentences summarizing where this candidate stands vs top performers",
  "categories": [
    {
      "name": "Technical Skills Depth",
      "yourScore": 55,
      "topCandidateScore": 92,
      "industryMedian": 60,
      "gapDescription": "Missing cloud/DevOps skills that 78% of top candidates have",
      "impact": "high"
    },
    {
      "name": "Quantified Impact & Metrics",
      "yourScore": 30,
      "topCandidateScore": 90,
      "industryMedian": 45,
      "gapDescription": "Only 12% of top candidates have zero metrics — this resume has none",
      "impact": "high"
    },
    {
      "name": "Project Complexity & Scale",
      "yourScore": 60,
      "topCandidateScore": 85,
      "industryMedian": 55,
      "gapDescription": "Projects lack scale indicators (users, revenue, team size)",
      "impact": "medium"
    },
    {
      "name": "Summary & Personal Brand",
      "yourScore": 40,
      "topCandidateScore": 82,
      "industryMedian": 50,
      "gapDescription": "Top candidates have targeted 3-4 sentence summaries with specific value props",
      "impact": "medium"
    },
    {
      "name": "Communication & Clarity",
      "yourScore": 50,
      "topCandidateScore": 80,
      "industryMedian": 58,
      "gapDescription": "Bullets are vague — top candidates use Action + Impact + Metrics formula",
      "impact": "high"
    }
  ],
  "topCandidateProfile": "What a top 10% candidate looks like in this space (3-4 sentences describing their resume)",
  "gapsToTop10Percent": [
    "Add quantified metrics to every experience bullet (top candidates average 4+ metrics per role)",
    "Include cloud certifications or notable open source contributions"
  ],
  "quickWins": [
    {"action": "Add 3-5 metrics to existing bullets", "effort": "low", "impact": "high", "estimatedPercentileGain": "+12 percentile points"},
    {"action": "Write a targeted 4-sentence summary", "effort": "low", "impact": "high", "estimatedPercentileGain": "+8 percentile points"}
  ],
  "topSkillsMissing": ["Kubernetes", "Terraform", "System Design"],
  "whatTop10PercentHaveThatYouDont": ["Portfolio/GitHub with 500+ stars", "Open source contributions", "Measurable business impact in every role"]
}

tier must be one of: "elite", "strong", "average", "below_average"
impact must be one of: "high", "medium", "low"
percentileRank: 0-100, be realistic and honest
Return ONLY valid JSON, no markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    });

    const text = response.text ?? "{}";
    let result: {
      percentileRank?: number;
      tier?: string;
      tierLabel?: string;
      overallGapSummary?: string;
      categories?: Array<{
        name: string; yourScore: number; topCandidateScore: number;
        industryMedian: number; gapDescription: string; impact: string;
      }>;
      topCandidateProfile?: string;
      gapsToTop10Percent?: string[];
      quickWins?: Array<{ action: string; effort: string; impact: string; estimatedPercentileGain: string }>;
      topSkillsMissing?: string[];
      whatTop10PercentHaveThatYouDont?: string[];
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { percentileRank: 50, tier: "average", categories: [], quickWins: [] };
    }

    res.json({
      percentileRank: result.percentileRank ?? 50,
      tier: result.tier ?? "average",
      tierLabel: result.tierLabel ?? "Average Candidate",
      overallGapSummary: result.overallGapSummary ?? "",
      categories: result.categories ?? [],
      topCandidateProfile: result.topCandidateProfile ?? "",
      gapsToTop10Percent: result.gapsToTop10Percent ?? [],
      quickWins: result.quickWins ?? [],
      topSkillsMissing: result.topSkillsMissing ?? [],
      whatTop10PercentHaveThatYouDont: result.whatTop10PercentHaveThatYouDont ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Benchmark failed";
    res.status(500).json({ error: "benchmark_failed", message: msg });
  }
});

export default router;
