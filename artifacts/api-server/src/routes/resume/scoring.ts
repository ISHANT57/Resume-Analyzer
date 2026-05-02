import type { ParsedResumeData } from "./parser";
import { runATSEngine, type ATSEngineResult } from "./ats-engine";

export interface IssueItem {
  type: string;
  message: string;
  severity: "high" | "medium" | "low";
  explanation?: string;
  impact?: string;
}

export interface MissingSectionDetail {
  section: string;
  importance: "critical" | "important" | "recommended";
  why: string;
  example: string;
  scoreImpact: string;
}

export interface ScoringResult {
  overallScore: number;
  contentScore: number;
  sectionScore: number;
  atsScore: number;
  tailoringScore: number;
  parseRate: number;
  impactScore: number;
  confidenceScore: number;
  issues: IssueItem[];
  suggestions: string[];
  missingSections: string[];
  missingSectionsDetail: MissingSectionDetail[];
  metricsCount: number;
  weakBullets: string[];
  strongBullets: string[];
  atsDetail: ATSEngineResult;
}

const WEAK_VERBS = [
  "worked", "helped", "did", "made", "was responsible for",
  "involved in", "assisted", "participated", "contributed", "handled",
  "used", "dealt with",
];

const STRONG_VERBS = [
  "achieved", "accelerated", "amplified", "built", "delivered",
  "drove", "engineered", "executed", "generated", "grew",
  "implemented", "improved", "increased", "launched", "led",
  "optimized", "reduced", "saved", "scaled", "spearheaded",
  "transformed", "shipped", "designed", "architected", "automated",
  "deployed", "migrated", "refactored", "researched", "resolved",
];

const OUTCOME_PATTERNS = [
  /result(ed|ing)?/i, /achiev/i, /impact/i, /outcom/i, /success/i,
  /improv/i, /increas/i, /reduc/i, /sav(ed|ing)/i, /generat/i,
  /earn/i, /deliver(ed)?/i, /complet/i, /launch/i, /boost/i,
];

const MISSING_SECTION_DETAILS: Record<string, Omit<MissingSectionDetail, "section">> = {
  experience: {
    importance: "critical",
    why: "Experience is the #1 ranked section in ATS algorithms. Its absence triggers auto-rejection in Taleo, Workday, and Greenhouse before any human sees the resume.",
    example: "Software Engineer at Acme Corp (2021-2024) — Led migration from monolith to microservices; reduced deployment time by 60% and improved uptime to 99.9%.",
    scoreImpact: "Missing experience can drop your ATS score by 25+ points and cause immediate auto-rejection.",
  },
  education: {
    importance: "critical",
    why: "Education credentials are required by most ATS systems to validate minimum qualifications. Many job postings filter out candidates missing this section entirely.",
    example: "B.S. Computer Science — Stanford University, 2020. GPA: 3.8. Relevant coursework: Algorithms, Machine Learning, Systems Design.",
    scoreImpact: "Missing education costs 15-20 ATS score points and blocks degree-required roles completely.",
  },
  skills: {
    importance: "critical",
    why: "The Skills section is the primary source of keyword matches in ATS ranking. Without it, you won't match keyword filters for specific technologies or tools.",
    example: "Languages: Python, TypeScript, Go | Frameworks: React, FastAPI, Node.js | Tools: Docker, Kubernetes, AWS, PostgreSQL",
    scoreImpact: "Missing skills section reduces keyword match rate by up to 40% against any job description.",
  },
  summary: {
    importance: "important",
    why: "Professional summaries are indexed heavily by ATS systems and are the first section recruiters read. A strong summary packs keyword-rich positioning into a scannable block.",
    example: "Full-stack engineer with 4+ years building scalable SaaS platforms. Specialized in React + Node.js serving 100K+ users. Track record of shipping features that measurably improve retention.",
    scoreImpact: "A missing summary reduces ATS keyword coverage and costs 8-12 content score points.",
  },
  projects: {
    importance: "recommended",
    why: "Projects demonstrate applied skills and real-world problem-solving — especially critical for junior candidates or those transitioning between roles.",
    example: "AI Resume Analyzer — React + Python + GPT-4. Reduced resume review time by 70% for 500+ beta users. github.com/user/resume-ai",
    scoreImpact: "Without projects, candidates with limited experience lose significant differentiation against peers.",
  },
};

export function scoreResume(parsed: ParsedResumeData, rawText: string, isPDF = true): ScoringResult {
  const issues: IssueItem[] = [];
  const suggestions: string[] = [];
  const missingSections: string[] = [];
  const missingSectionsDetail: MissingSectionDetail[] = [];

  const atsDetail = runATSEngine(rawText, isPDF, parsed.hasExperience, parsed.hasSummary);

  // ── Section Score ─────────────────────────────────────────────────────────
  let sectionPoints = 0;
  if (parsed.hasExperience) {
    sectionPoints += 25;
  } else {
    missingSections.push("experience");
    missingSectionsDetail.push({ section: "experience", ...MISSING_SECTION_DETAILS.experience });
    issues.push({ type: "missing_section", message: "No Experience section found", severity: "high",
      explanation: "Experience is the most critical section for ATS ranking. Its absence triggers auto-rejection in most systems.",
      impact: "Resume will be auto-rejected by recruiter filters before any human reads it." });
  }

  if (parsed.hasEducation) {
    sectionPoints += 20;
  } else {
    missingSections.push("education");
    missingSectionsDetail.push({ section: "education", ...MISSING_SECTION_DETAILS.education });
    issues.push({ type: "missing_section", message: "No Education section found", severity: "high",
      explanation: "Education is required for most ATS filters — especially for roles requiring a degree.",
      impact: "Scores 0 on education keyword matching." });
  }

  if (parsed.hasSkills) {
    sectionPoints += 20;
  } else {
    missingSections.push("skills");
    missingSectionsDetail.push({ section: "skills", ...MISSING_SECTION_DETAILS.skills });
    issues.push({ type: "missing_section", message: "No Skills section found", severity: "medium",
      explanation: "Skills sections are the primary source of keyword matches in ATS ranking.",
      impact: "Significantly reduces match score for any job posting." });
  }

  if (parsed.hasProjects) {
    sectionPoints += 15;
  } else {
    missingSections.push("projects");
    missingSectionsDetail.push({ section: "projects", ...MISSING_SECTION_DETAILS.projects });
  }

  if (parsed.hasSummary) {
    sectionPoints += 20;
  } else {
    missingSections.push("summary");
    missingSectionsDetail.push({ section: "summary", ...MISSING_SECTION_DETAILS.summary });
    issues.push({ type: "missing_section", message: "No Professional Summary section", severity: "low",
      explanation: "Professional summaries are indexed heavily by ATS systems to match candidates to job descriptions.",
      impact: "Reduces keyword match coverage — summary is prime real estate for job-relevant terms." });
  }

  const sectionScore = Math.min(100, sectionPoints);

  // ── Bullets & Content ─────────────────────────────────────────────────────
  const allBullets = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("•") || l.startsWith("-") || l.startsWith("*") || /^[–—]\s/.test(l))
    .map(l => l.replace(/^[•\-*–—]\s*/, ""));

  const weakBullets: string[] = [];
  const strongBullets: string[] = [];
  for (const bullet of allBullets.slice(0, 25)) {
    const bLower = bullet.toLowerCase();
    if (WEAK_VERBS.some(v => bLower.startsWith(v))) weakBullets.push(bullet);
    else if (STRONG_VERBS.some(v => bLower.startsWith(v))) strongBullets.push(bullet);
  }

  const metricsMatches = rawText.match(/\d+[\s]?(%|percent|x\b|times|million|billion|k\b|\+\s*(?:users|clients|customers))/gi) ?? [];
  const metricsCount = metricsMatches.length;

  let contentScore = 50;
  contentScore += Math.min(20, metricsCount * 5);
  contentScore += Math.min(15, strongBullets.length * 3);
  contentScore -= Math.min(20, weakBullets.length * 3);
  if (parsed.email) contentScore += 3;
  if (parsed.phone) contentScore += 3;
  if (parsed.skills.length > 5) contentScore += 4;
  if (allBullets.length > 8) contentScore += 5;
  contentScore = Math.max(10, Math.min(100, contentScore));

  if (weakBullets.length > 2) {
    issues.push({ type: "weak_bullets", message: `${weakBullets.length} bullet points use weak action verbs`, severity: "medium",
      explanation: "ATS ranking algorithms in some systems (Lever, Greenhouse) score bullet point quality by verb strength.",
      impact: "Weak verbs reduce content score and make bullets less compelling to recruiters who skim after ATS ranking." });
    suggestions.push("Replace weak verbs (worked, helped, used) with strong action verbs (delivered, engineered, drove)");
  }

  if (metricsCount < 2) {
    issues.push({ type: "no_metrics", message: "Resume lacks quantified achievements", severity: "medium",
      explanation: "Quantified achievements (numbers, percentages, dollar amounts) are a primary signal of impact for both ATS and human reviewers.",
      impact: "Without metrics, your bullets read as job duties rather than accomplishments, ranking lower against candidates with quantified results." });
    suggestions.push("Add quantified achievements: 'Reduced API latency by 40%' instead of 'Improved API performance'");
  }

  // ── Impact Score ──────────────────────────────────────────────────────────
  const outcomeCount = allBullets.filter(b => OUTCOME_PATTERNS.some(p => p.test(b))).length;
  let impactScore = 35;
  impactScore += Math.min(35, metricsCount * 9);
  impactScore += Math.min(20, strongBullets.length * 4);
  impactScore += Math.min(10, outcomeCount * 3);
  impactScore -= Math.min(20, weakBullets.length * 5);
  if (parsed.summary.length > 80) impactScore += 5;
  impactScore = Math.max(5, Math.min(100, Math.round(impactScore)));

  // ── Confidence Score ──────────────────────────────────────────────────────
  let confidenceScore = 50;
  confidenceScore += (atsDetail.parseRate - 50) * 0.4;
  if (parsed.email) confidenceScore += 6;
  if (parsed.phone) confidenceScore += 4;
  if (parsed.name) confidenceScore += 6;
  if (parsed.skills.length > 3) confidenceScore += 5;
  if (parsed.hasExperience) confidenceScore += 8;
  if (parsed.hasEducation) confidenceScore += 5;
  if (parsed.hasSkills) confidenceScore += 5;
  if (parsed.hasSummary) confidenceScore += 3;
  confidenceScore -= atsDetail.parseQualityBreakdown.garbledSequences * 2;
  confidenceScore -= atsDetail.parseQualityBreakdown.encodingIssues * 3;
  if (atsDetail.parseQualityBreakdown.printableRatio > 0.9) confidenceScore += 5;
  confidenceScore = Math.max(20, Math.min(100, Math.round(confidenceScore)));

  // ── ATS Score ─────────────────────────────────────────────────────────────
  const atsScore = atsDetail.atsScore;
  const parseRate = atsDetail.parseRate;

  for (const atsIssue of atsDetail.issues) {
    if (!issues.some(i => i.type === atsIssue.type)) {
      issues.push({ type: atsIssue.type, message: atsIssue.message, severity: atsIssue.severity,
        explanation: atsIssue.explanation, impact: atsIssue.impact });
    }
  }

  if (!parsed.email) {
    issues.push({ type: "missing_email", message: "No email address found", severity: "high",
      explanation: "ATS systems require an email to create the candidate record.",
      impact: "Resume cannot be processed — an ATS candidate profile cannot be created without an email." });
    suggestions.push("Add a professional email address");
  }
  if (!parsed.phone) suggestions.push("Add a phone number so recruiters can contact you quickly");
  if (!parsed.linkedin) {
    issues.push({ type: "missing_linkedin", message: "No LinkedIn URL found", severity: "low",
      explanation: "LinkedIn is increasingly used by ATS systems to validate and enrich candidate profiles.",
      impact: "Missing LinkedIn reduces credibility score in platforms like Workday and SAP SuccessFactors." });
    suggestions.push("Add your LinkedIn profile URL (e.g., linkedin.com/in/yourname)");
  }

  for (const warning of atsDetail.recruiterFilters.warnings) suggestions.push(warning);

  if (parsed.summary.length < 50) suggestions.push("Write a 3-4 sentence professional summary packed with your top skills and career goal");
  if (parsed.skills.length < 5) suggestions.push("List at least 8-10 relevant technical and soft skills");
  if (!parsed.hasProjects) suggestions.push("Add a Projects section showcasing real-world work, especially if you have limited experience");

  const tailoringScore = 40;

  const overallScore = Math.round(
    sectionScore   * 0.20 +
    contentScore   * 0.30 +
    atsScore       * 0.35 +
    tailoringScore * 0.15
  );

  return {
    overallScore: Math.max(5, Math.min(100, overallScore)),
    contentScore,
    sectionScore,
    atsScore,
    tailoringScore,
    parseRate,
    impactScore,
    confidenceScore,
    issues,
    suggestions: [...new Set(suggestions)].slice(0, 12),
    missingSections,
    missingSectionsDetail,
    metricsCount,
    weakBullets: weakBullets.slice(0, 5),
    strongBullets: strongBullets.slice(0, 5),
    atsDetail,
  };
}
