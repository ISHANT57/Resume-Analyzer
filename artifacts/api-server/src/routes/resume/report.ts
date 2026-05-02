import { Router } from "express";
import { db } from "@workspace/db";
import { analysisResultsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/report/:analysisId", async (req, res) => {
  try {
    const analysisId = parseInt(req.params.analysisId);
    if (isNaN(analysisId)) {
      res.status(400).json({ error: "bad_request", message: "Invalid analysisId" });
      return;
    }

    const [analysis] = await db
      .select()
      .from(analysisResultsTable)
      .where(eq(analysisResultsTable.id, analysisId));

    if (!analysis) {
      res.status(404).json({ error: "not_found", message: "Analysis not found" });
      return;
    }

    res.json({
      id: analysis.id,
      resumeId: analysis.resumeId,
      overallScore: analysis.overallScore,
      contentScore: analysis.contentScore,
      sectionScore: analysis.sectionScore,
      atsScore: analysis.atsScore,
      tailoringScore: analysis.tailoringScore,
      parseRate: analysis.parseRate,
      issues: analysis.issuesJson,
      suggestions: analysis.suggestionsJson,
      missingSections: analysis.missingSectionsJson,
      metricsCount: analysis.metricsCount,
      weakBullets: analysis.weakBulletsJson,
      strongBullets: analysis.strongBulletsJson,
      parsedData: analysis.parsedDataJson,
      createdAt: analysis.createdAt.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get report";
    res.status(500).json({ error: "server_error", message: msg });
  }
});

export default router;
