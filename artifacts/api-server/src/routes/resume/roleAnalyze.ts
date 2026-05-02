import { Router } from "express";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { parseResume } from "./parser";

const router = Router();

router.post("/role-analyze", async (req, res) => {
  try {
    const { resumeId, jobTitle } = req.body as { resumeId?: number; jobTitle?: string };
    if (!resumeId || !jobTitle?.trim()) {
      res.status(400).json({ error: "bad_request", message: "resumeId and jobTitle are required" });
      return;
    }

    const [resume] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
    if (!resume) {
      res.status(404).json({ error: "not_found", message: "Resume not found" });
      return;
    }

    const parsed = await parseResume(resume.fileContent ? Buffer.from(resume.fileContent, "base64") : resume.filePath, resume.mimeType ?? "application/pdf");

    const prompt = `You are a senior technical recruiter with 15 years of experience hiring for ${jobTitle} roles.

Analyze how well this resume matches the "${jobTitle}" role.

Resume Text (first 2000 chars):
${parsed.rawText.substring(0, 2000)}

Detected Skills: ${parsed.skills.slice(0, 30).join(", ") || "none detected"}

Your task:
1. Define what skills a strong "${jobTitle}" candidate MUST have (essential), should have (preferred), and it's nice to have.
2. Cross-reference with the resume.
3. Identify skill gaps.
4. Build a prioritized learning path.

Return ONLY a valid JSON object with this exact structure:
{
  "roleOverview": "2-3 sentence description of what strong ${jobTitle} candidates typically have",
  "matchScore": 72,
  "requiredSkills": [
    {"skill": "React", "importance": "essential", "category": "frontend", "present": true},
    {"skill": "GraphQL", "importance": "preferred", "category": "backend", "present": false}
  ],
  "missingSkills": [
    {"skill": "GraphQL", "importance": "essential", "category": "backend", "whyItMatters": "Used in 80% of modern frontend stacks"}
  ],
  "presentSkills": ["React", "TypeScript", "CSS"],
  "learningPath": [
    {"skill": "Docker", "priority": 1, "timeToLearn": "2 weeks", "resource": "Docker Official Docs + Play With Docker", "reason": "Required for CI/CD in most companies"}
  ],
  "hiringVerdict": "likely_shortlisted | possible_shortlisted | unlikely_shortlisted",
  "verdictReason": "One sentence on why they would/wouldn't pass screening"
}

Rules:
- requiredSkills: list 10-16 skills covering the full role spectrum
- missingSkills: only skills NOT present in resume (max 8)
- learningPath: ordered by hiring impact, max 6 items
- matchScore: 0-100, be realistic
- Return ONLY valid JSON, no markdown fences`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    });

    const text = response.text ?? "{}";
    let result: {
      roleOverview?: string;
      matchScore?: number;
      requiredSkills?: Array<{ skill: string; importance: string; category: string; present: boolean }>;
      missingSkills?: Array<{ skill: string; importance: string; category: string; whyItMatters: string }>;
      presentSkills?: string[];
      learningPath?: Array<{ skill: string; priority: number; timeToLearn: string; resource: string; reason: string }>;
      hiringVerdict?: string;
      verdictReason?: string;
    };

    try {
      result = JSON.parse(text);
    } catch {
      result = { matchScore: 0, requiredSkills: [], missingSkills: [], presentSkills: [], learningPath: [] };
    }

    res.json({
      roleOverview: result.roleOverview ?? "",
      matchScore: result.matchScore ?? 0,
      requiredSkills: result.requiredSkills ?? [],
      missingSkills: result.missingSkills ?? [],
      presentSkills: result.presentSkills ?? [],
      learningPath: result.learningPath ?? [],
      hiringVerdict: result.hiringVerdict ?? "unlikely_shortlisted",
      verdictReason: result.verdictReason ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Role analysis failed";
    res.status(500).json({ error: "role_analyze_failed", message: msg });
  }
});

export default router;
