import fs from "fs";
import { createRequire } from "module";
import mammoth from "mammoth";

// pdf-parse and mammoth are kept external (not bundled by esbuild) so Node
// resolves them natively from node_modules — this avoids CJS wrapping issues.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

export interface ParsedResumeData {
  rawText: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string[];
  education: string[];
  projects: string[];
  summary: string;
  linkedin: string;
  github: string;
  hasExperience: boolean;
  hasEducation: boolean;
  hasSkills: boolean;
  hasProjects: boolean;
  hasSummary: boolean;
}

export async function parseResume(filePathOrBuffer: string | Buffer, mimeType: string): Promise<ParsedResumeData> {
  let rawText = "";

  if (mimeType === "application/pdf") {
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer as string);
    const data = await pdfParse(buffer);
    rawText = data.text;
  } else {
    if (Buffer.isBuffer(filePathOrBuffer)) {
      const result = await mammoth.extractRawText({ buffer: filePathOrBuffer });
      rawText = result.value;
    } else {
      const result = await mammoth.extractRawText({ path: filePathOrBuffer as string });
      rawText = result.value;
    }
  }

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Extract email
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";

  // Extract phone
  const phoneMatch = rawText.match(/(\+?[\d\s\-().]{7,20})/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  // Extract LinkedIn
  const linkedinMatch = rawText.match(/linkedin\.com\/in\/[\w-]+/i);
  const linkedin = linkedinMatch ? linkedinMatch[0] : "";

  // Extract GitHub
  const githubMatch = rawText.match(/github\.com\/[\w-]+/i);
  const github = githubMatch ? githubMatch[0] : "";

  // Try to get name (first non-empty line that's not an email or phone)
  const name = lines.find((l) => l.length > 2 && l.length < 60 && !l.includes("@") && !/^\+?[\d\s-]+$/.test(l)) || "";

  // Section detection helpers
  const textLower = rawText.toLowerCase();
  const hasExperience = /\b(experience|work history|employment|professional background)\b/i.test(rawText);
  const hasEducation = /\b(education|academic|degree|university|college|school)\b/i.test(rawText);
  const hasSkills = /\b(skills|technologies|technical skills|competencies|proficiencies)\b/i.test(rawText);
  const hasProjects = /\b(projects|portfolio|personal projects|side projects)\b/i.test(rawText);
  const hasSummary = /\b(summary|objective|profile|about me|introduction)\b/i.test(rawText);

  // Extract skills (look for comma-separated or bullet list in skills section)
  const skillsMatch = textLower.match(/skills[:\s]*([^]*?)(?=education|experience|projects|$)/i);
  const skillsText = skillsMatch ? skillsMatch[1].substring(0, 500) : "";
  const skills = skillsText
    .split(/[,\n•\-|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 50);

  // Extract experience bullets
  const expMatch = textLower.indexOf("experience");
  const expText = expMatch >= 0 ? rawText.substring(expMatch, expMatch + 2000) : "";
  const experience = expText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("•") || l.startsWith("-") || l.startsWith("*") || /^[A-Z]/.test(l))
    .slice(0, 10);

  // Extract education
  const eduMatch = textLower.indexOf("education");
  const eduText = eduMatch >= 0 ? rawText.substring(eduMatch, eduMatch + 1000) : "";
  const education = eduText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5)
    .slice(1, 6);

  // Extract projects
  const projMatch = textLower.indexOf("project");
  const projText = projMatch >= 0 ? rawText.substring(projMatch, projMatch + 1000) : "";
  const projects = projText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5)
    .slice(1, 6);

  // Extract summary
  const summaryMatch = textLower.match(/(?:summary|objective|profile)[:\s]*([^\n]{20,300})/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : "";

  return {
    rawText,
    name,
    email,
    phone,
    linkedin,
    github,
    skills: skills.slice(0, 20),
    experience,
    education,
    projects,
    summary,
    hasExperience,
    hasEducation,
    hasSkills,
    hasProjects,
    hasSummary,
  };
}
