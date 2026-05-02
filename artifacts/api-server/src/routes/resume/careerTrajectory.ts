import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/career-trajectory", async (req, res) => {
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

    const prompt = `You are a senior career coach and talent strategist with 20 years of experience mapping career paths across tech, finance, and creative industries. Based on this resume, predict realistic career trajectories for 1, 3, and 5 years from now.

Resume Text (first 2500 chars):
${parsed.rawText.substring(0, 2500)}

Detected Skills: ${parsed.skills.slice(0, 25).join(", ") || "none detected"}

Your task: Map where this person realistically can go, based on current skills, experience depth, and education. Be specific to their actual background — do NOT give generic advice.

Return ONLY a valid JSON object:
{
  "currentLevel": "e.g. Junior Full Stack Developer",
  "currentStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "trajectories": [
    {
      "year": 1,
      "jobTitles": ["Most likely title 1", "Alternative title 2"],
      "probability": 80,
      "salaryRange": "$70k–$95k USD",
      "keyMilestone": "The one thing they must achieve to hit this",
      "requiredSkills": [
        {
          "skill": "Docker",
          "currentlyHas": false,
          "urgency": "high|medium|low",
          "timeToLearn": "2–3 weeks",
          "whyNeeded": "Why this skill matters for this trajectory"
        }
      ],
      "readinessScore": 72
    },
    {
      "year": 3,
      "jobTitles": ["..."],
      "probability": 55,
      "salaryRange": "$100k–$130k USD",
      "keyMilestone": "...",
      "requiredSkills": [],
      "readinessScore": 40
    },
    {
      "year": 5,
      "jobTitles": ["..."],
      "probability": 35,
      "salaryRange": "$140k–$180k USD",
      "keyMilestone": "...",
      "requiredSkills": [],
      "readinessScore": 20
    }
  ],
  "alternativePathways": [
    {
      "path": "AI/ML Engineer",
      "description": "Why this pivot makes sense given their background",
      "probability": 60,
      "bridgeSkills": ["PyTorch", "Hugging Face"],
      "timeToTransition": "12–18 months"
    }
  ],
  "biggestCareerRisk": "The one thing that could derail their career growth",
  "immediateActions": ["Concrete action 1", "Concrete action 2", "Concrete action 3"]
}

Rules:
- trajectories: exactly 3 objects for year 1, 3, and 5
- requiredSkills: 3-5 skills per trajectory, only skills NOT already on resume
- alternativePathways: 2-3 alternative career pivots that make sense given their background
- probability: realistic likelihood they reach this level given current trajectory. Most people don't reach 5-year targets.
- salaryRange: realistic for the market (default US market)
- readinessScore: 0-100, how ready are they TODAY for this level
- Return ONLY valid JSON, no markdown fences`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 5000 },
    });

    const text = response.text ?? "{}";
    let result: {
      currentLevel?: string;
      currentStrengths?: string[];
      trajectories?: Array<{
        year: number;
        jobTitles: string[];
        probability: number;
        salaryRange: string;
        keyMilestone: string;
        requiredSkills: Array<{
          skill: string;
          currentlyHas: boolean;
          urgency: string;
          timeToLearn: string;
          whyNeeded: string;
        }>;
        readinessScore: number;
      }>;
      alternativePathways?: Array<{
        path: string;
        description: string;
        probability: number;
        bridgeSkills: string[];
        timeToTransition: string;
      }>;
      biggestCareerRisk?: string;
      immediateActions?: string[];
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { currentLevel: "", currentStrengths: [], trajectories: [], alternativePathways: [], immediateActions: [] };
    }

    res.json({
      currentLevel: result.currentLevel ?? "",
      currentStrengths: result.currentStrengths ?? [],
      trajectories: result.trajectories ?? [],
      alternativePathways: result.alternativePathways ?? [],
      biggestCareerRisk: result.biggestCareerRisk ?? "",
      immediateActions: result.immediateActions ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Career trajectory prediction failed";
    res.status(500).json({ error: "career_trajectory_failed", message: msg });
  }
});

export default router;
