import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable, analysisResultsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseResume } from "./parser";
import { scoreResume } from "./scoring";

const router = Router();

router.post("/analyze", async (req, res) => {
  try {
    const { resumeId } = req.body as { resumeId?: number };

    if (!resumeId) {
      res.status(400).json({ error: "bad_request", message: "resumeId is required" });
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

    const mimeType = resume.mimeType ?? "application/pdf";
    const isPDF = mimeType === "application/pdf";
    const parsed = await parseResume(
      resume.fileContent ? Buffer.from(resume.fileContent, "base64") : resume.filePath,
      mimeType,
    );
    const scoring = scoreResume(parsed, parsed.rawText, isPDF);

    const [analysis] = await db
      .insert(analysisResultsTable)
      .values({
        resumeId: resume.id,
        overallScore: scoring.overallScore,
        contentScore: scoring.contentScore,
        sectionScore: scoring.sectionScore,
        atsScore: scoring.atsScore,
        tailoringScore: scoring.tailoringScore,
        parseRate: scoring.parseRate,
        issuesJson: scoring.issues,
        suggestionsJson: scoring.suggestions,
        missingSectionsJson: scoring.missingSections,
        metricsCount: scoring.metricsCount,
        weakBulletsJson: scoring.weakBullets,
        strongBulletsJson: scoring.strongBullets,
        parsedDataJson: {
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          linkedin: parsed.linkedin,
          github: parsed.github,
          skills: parsed.skills,
          experience: parsed.experience,
          education: parsed.education,
          projects: parsed.projects,
          summary: parsed.summary,
        },
      })
      .returning();

    const ats = scoring.atsDetail;

    res.json({
      id: analysis.id,
      resumeId: analysis.resumeId,
      overallScore: analysis.overallScore,
      contentScore: analysis.contentScore,
      sectionScore: analysis.sectionScore,
      atsScore: analysis.atsScore,
      tailoringScore: analysis.tailoringScore,
      parseRate: analysis.parseRate,
      impactScore: scoring.impactScore,
      confidenceScore: scoring.confidenceScore,
      issues: analysis.issuesJson,
      suggestions: analysis.suggestionsJson,
      missingSections: analysis.missingSectionsJson,
      missingSectionsDetail: scoring.missingSectionsDetail,
      metricsCount: analysis.metricsCount,
      weakBullets: analysis.weakBulletsJson,
      strongBullets: analysis.strongBulletsJson,
      parsedData: analysis.parsedDataJson,
      createdAt: analysis.createdAt.toISOString(),
      atsDetail: {
        parseQualityBreakdown: ats.parseQualityBreakdown,
        formattingProblems: ats.formattingProblems,
        headingAnalysis: ats.headingAnalysis,
        keywordDensity: ats.keywordDensity,
        recruiterFilters: ats.recruiterFilters,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    res.status(500).json({ error: "analysis_failed", message: msg });
  }
});

export default router;
