import { Router } from "express";
import { db } from "@workspace/db";
import { analysisResultsTable, resumesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/history", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) ?? "10") || 10;

    const results = await db
      .select({
        id: analysisResultsTable.id,
        resumeId: analysisResultsTable.resumeId,
        filename: resumesTable.originalName,
        overallScore: analysisResultsTable.overallScore,
        contentScore: analysisResultsTable.contentScore,
        atsScore: analysisResultsTable.atsScore,
        sectionScore: analysisResultsTable.sectionScore,
        tailoringScore: analysisResultsTable.tailoringScore,
        createdAt: analysisResultsTable.createdAt,
      })
      .from(analysisResultsTable)
      .leftJoin(resumesTable, eq(analysisResultsTable.resumeId, resumesTable.id))
      .orderBy(desc(analysisResultsTable.createdAt))
      .limit(limit);

    res.json(
      results.map((r) => ({
        ...r,
        filename: r.filename ?? "Unknown",
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get history";
    res.status(500).json({ error: "server_error", message: msg });
  }
});

router.get("/history/stats", async (req, res) => {
  try {
    const results = await db
      .select({
        overallScore: analysisResultsTable.overallScore,
        createdAt: analysisResultsTable.createdAt,
      })
      .from(analysisResultsTable)
      .orderBy(desc(analysisResultsTable.createdAt))
      .limit(50);

    const scores = results.map((r) => r.overallScore);
    const totalAnalyses = scores.length;
    const averageScore = totalAnalyses > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / totalAnalyses) : 0;
    const bestScore = totalAnalyses > 0 ? Math.max(...scores) : 0;

    const trend = results
      .slice(0, 10)
      .reverse()
      .map((r) => ({
        date: r.createdAt.toISOString().split("T")[0],
        score: r.overallScore,
      }));

    res.json({ totalAnalyses, averageScore, bestScore, trend });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get stats";
    res.status(500).json({ error: "server_error", message: msg });
  }
});

export default router;
