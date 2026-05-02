/**
 * Real-world ATS Engine
 * Simulates how Applicant Tracking Systems (Taleo, Greenhouse, Workday, Lever)
 * parse and score resumes, plus recruiter auto-filter logic.
 */

export interface ATSIssue {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  explanation: string;
  impact: string;
}

export interface FormattingProblem {
  type: string;
  detected: boolean;
  description: string;
  penalty: number;
}

export interface HeadingAnalysis {
  foundHeadings: string[];
  nonStandardHeadings: string[];
  missingStandardHeadings: string[];
  standardizationScore: number;
}

export interface KeywordDensityResult {
  totalWords: number;
  meaningfulWords: number;
  densityPercent: number;
  keywordStuffingDetected: boolean;
  topKeywords: Array<{ word: string; count: number }>;
  lowDensity: boolean;
}

export interface RecruiterFilterResult {
  autoRejected: boolean;
  rejectionReasons: string[];
  warnings: string[];
  passedFilters: string[];
}

export interface ATSEngineResult {
  parseRate: number;
  atsScore: number;
  issues: ATSIssue[];
  formattingProblems: FormattingProblem[];
  headingAnalysis: HeadingAnalysis;
  keywordDensity: KeywordDensityResult;
  recruiterFilters: RecruiterFilterResult;
  parseQualityBreakdown: {
    totalChars: number;
    printableRatio: number;
    garbledSequences: number;
    encodingIssues: number;
    avgLineLength: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** ATS-recognized section headings (canonical forms) */
const STANDARD_HEADINGS = new Set([
  "experience", "work experience", "professional experience",
  "employment history", "work history", "career history",
  "education", "academic background", "educational background",
  "skills", "technical skills", "core competencies", "key skills",
  "competencies", "proficiencies", "technologies",
  "summary", "professional summary", "executive summary",
  "objective", "career objective", "profile", "about",
  "projects", "personal projects", "key projects", "notable projects",
  "certifications", "certificates", "licenses",
  "awards", "honors", "achievements",
  "publications", "research",
  "volunteer", "volunteering", "community",
  "languages", "references", "contact",
  "internship", "internships",
  "leadership", "activities", "extracurricular",
]);

/** Non-standard / informal heading phrases that confuse parsers */
const NON_STANDARD_HEADING_PATTERNS = [
  { pattern: /what i[''']ve done/i, label: "What I've Done" },
  { pattern: /my (journey|story|path|background|career)/i, label: "My Journey/Story" },
  { pattern: /about me/i, label: "About Me (too informal)" },
  { pattern: /things i (know|do|built|made)/i, label: "Things I Know/Do" },
  { pattern: /where i[''']ve worked/i, label: "Where I've Worked" },
  { pattern: /cool stuff/i, label: "Cool Stuff" },
  { pattern: /superpowers?/i, label: "Superpowers" },
  { pattern: /achievements? & awards?/i, label: "Non-split Achievements & Awards" },
  { pattern: /work & education/i, label: "Combined Work & Education" },
  { pattern: /misc(ellaneous)?/i, label: "Miscellaneous" },
  { pattern: /other (stuff|things|info)/i, label: "Other Stuff/Things/Info" },
];

/** Unicode ranges that represent icons, emojis, dingbats */
const ICON_UNICODE_RANGES: Array<[number, number, string]> = [
  [0x2600, 0x26ff, "Miscellaneous Symbols"],
  [0x2700, 0x27bf, "Dingbats"],
  [0x1f300, 0x1f5ff, "Misc Symbols & Pictographs"],
  [0x1f600, 0x1f64f, "Emoticons"],
  [0x1f680, 0x1f6ff, "Transport & Map"],
  [0xe000, 0xf8ff, "Private Use Area (custom icons)"],
  [0x1f900, 0x1f9ff, "Supplemental Symbols"],
];

/** Common filler/stop words to exclude from keyword density */
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","as","is","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might","shall",
  "that","this","these","those","it","its","i","my","we","our","you","your",
  "he","she","they","their","his","her","not","also","both","either","each",
  "more","most","other","some","such","than","then","when","where","which","who",
  "how","all","any","few","so","if","up","out","about","into","through",
  "during","before","after","above","below","between","own","same",
  "just","because","while","although","though","however","therefore","thus",
]);

// ─── Parse Quality ────────────────────────────────────────────────────────────

function analyzeParseQuality(rawText: string): {
  parseRate: number;
  totalChars: number;
  printableRatio: number;
  garbledSequences: number;
  encodingIssues: number;
  avgLineLength: number;
} {
  const totalChars = rawText.length;

  if (totalChars === 0) {
    return { parseRate: 0, totalChars: 0, printableRatio: 0, garbledSequences: 0, encodingIssues: 0, avgLineLength: 0 };
  }

  // Count printable ASCII and common Unicode chars
  let printable = 0;
  for (const ch of rawText) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x20 && code <= 0x7e) ||   // printable ASCII
      (code >= 0xa0 && code <= 0x024f) ||  // Latin Extended
      ch === "\n" || ch === "\r" || ch === "\t"
    ) {
      printable++;
    }
  }
  const printableRatio = printable / totalChars;

  // Detect garbled text sequences (high-entropy character runs)
  const garbledPattern = /[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F]{3,}/g;
  const garbledMatches = rawText.match(garbledPattern) ?? [];
  const garbledSequences = garbledMatches.length;

  // Detect encoding replacement chars and common encoding artifacts
  const encodingIssues = (rawText.match(/[ï»¿â€™â€œâ€\ufffd]/g) ?? []).length +
    (rawText.match(/[^\x00-\x7F]{5,}/g) ?? []).length;

  // Average line length (short lines → multi-column or header/footer)
  const lines = rawText.split("\n").filter(l => l.trim().length > 0);
  const avgLineLength = lines.length > 0
    ? lines.reduce((sum, l) => sum + l.trim().length, 0) / lines.length
    : 0;

  // Compute parse rate
  let parseRate = 100;
  parseRate -= Math.min(30, garbledSequences * 3);
  parseRate -= Math.min(20, encodingIssues * 2);
  parseRate -= (1 - printableRatio) * 40;
  if (totalChars < 300) parseRate -= 30;
  else if (totalChars < 800) parseRate -= 10;
  parseRate = Math.max(5, Math.min(100, Math.round(parseRate)));

  return { parseRate, totalChars, printableRatio, garbledSequences, encodingIssues, avgLineLength };
}

// ─── Formatting Detection ─────────────────────────────────────────────────────

function detectFormattingProblems(rawText: string, isPDF: boolean): FormattingProblem[] {
  const problems: FormattingProblem[] = [];
  const lines = rawText.split("\n").map(l => l.trimEnd());
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);

  // 1. Multi-column layout detection
  // Signature: many lines shorter than ~40 chars, interspersed with tab characters
  const shortLines = nonEmptyLines.filter(l => l.trim().length < 45 && l.trim().length > 3);
  const tabLines = nonEmptyLines.filter(l => l.includes("\t") || /  {4,}/.test(l));
  const multiColumnIndicator = shortLines.length / Math.max(nonEmptyLines.length, 1);
  const multiColumnDetected = multiColumnIndicator > 0.55 || tabLines.length > 10;
  problems.push({
    type: "multi_column_layout",
    detected: multiColumnDetected,
    description: multiColumnDetected
      ? `Detected multi-column layout (${Math.round(multiColumnIndicator * 100)}% short lines, ${tabLines.length} tab-indented lines). Most ATS parsers read left-to-right and will scramble columns.`
      : "No multi-column layout detected.",
    penalty: multiColumnDetected ? 18 : 0,
  });

  // 2. Table detection (pipes or consistent spacing grids)
  const pipeLines = nonEmptyLines.filter(l => (l.match(/\|/g) ?? []).length >= 2);
  const tableDetected = pipeLines.length >= 3;
  problems.push({
    type: "table_detected",
    detected: tableDetected,
    description: tableDetected
      ? `Detected ${pipeLines.length} lines with table-like structure (pipe characters). ATS systems often skip table content entirely, losing critical information.`
      : "No table structures detected.",
    penalty: tableDetected ? 15 : 0,
  });

  // 3. Icon / emoji detection
  let iconCount = 0;
  const iconTypes: string[] = [];
  for (const char of rawText) {
    const code = char.codePointAt(0) ?? 0;
    for (const [start, end, name] of ICON_UNICODE_RANGES) {
      if (code >= start && code <= end) {
        iconCount++;
        if (!iconTypes.includes(name)) iconTypes.push(name);
        break;
      }
    }
  }
  const iconsDetected = iconCount > 0;
  problems.push({
    type: "icons_or_emojis",
    detected: iconsDetected,
    description: iconsDetected
      ? `Found ${iconCount} icon/symbol characters (${iconTypes.join(", ")}). ATS parsers treat these as garbage characters or skip them, which can corrupt surrounding text.`
      : "No icons or emojis detected.",
    penalty: Math.min(12, iconCount * 2),
  });

  // 4. Header/footer detection (very short repeated lines near start/end)
  const firstFiveLines = nonEmptyLines.slice(0, 5);
  const lastFiveLines = nonEmptyLines.slice(-5);
  const suspiciousFooter = lastFiveLines.some(l =>
    /page\s+\d+/i.test(l) || /\d+\s+of\s+\d+/i.test(l) || /confidential/i.test(l)
  );
  const suspiciousHeader = firstFiveLines.some(l =>
    /page\s+\d+/i.test(l) || /resume|curriculum vitae|cv\b/i.test(l)
  );
  problems.push({
    type: "header_footer",
    detected: suspiciousHeader || suspiciousFooter,
    description: suspiciousHeader || suspiciousFooter
      ? "Detected header or footer text (page numbers, 'Resume' label, 'Confidential'). ATS parsers may misread these as part of work experience or education."
      : "No problematic headers or footers detected.",
    penalty: (suspiciousHeader || suspiciousFooter) ? 5 : 0,
  });

  // 5. Text boxes (PDF-specific: very irregular line ordering, mixed indentation)
  const indentLevels = new Set(
    nonEmptyLines.map(l => l.match(/^(\s*)/)?.[1].length ?? 0)
  );
  const textBoxSuspected = isPDF && indentLevels.size > 8 && nonEmptyLines.length > 20;
  problems.push({
    type: "text_boxes",
    detected: textBoxSuspected,
    description: textBoxSuspected
      ? "Detected irregular indentation patterns typical of PDF text boxes or floating elements. These are often skipped or mis-ordered by ATS parsers."
      : "No text box anomalies detected.",
    penalty: textBoxSuspected ? 8 : 0,
  });

  // 6. Special/bullet characters that ATS may not handle
  const specialBullets = (rawText.match(/[✓✗✘➤➜►➝➞➟➠➡→▸▶❯•·‣⦁◆◇]/g) ?? []).length;
  const specialBulletsDetected = specialBullets > 5;
  problems.push({
    type: "special_bullet_characters",
    detected: specialBulletsDetected,
    description: specialBulletsDetected
      ? `Found ${specialBullets} non-standard bullet characters. Older ATS systems (Taleo, some Oracle HCM versions) may parse these as literal symbols, breaking the surrounding sentence.`
      : "Bullet characters are ATS-compatible.",
    penalty: specialBulletsDetected ? 6 : 0,
  });

  return problems;
}

// ─── Heading Analysis ─────────────────────────────────────────────────────────

function analyzeHeadings(rawText: string): HeadingAnalysis {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // A heading candidate: short line, all-caps OR Title Case, not a sentence
  const headingCandidates = lines.filter(l =>
    l.length >= 3 &&
    l.length <= 40 &&
    !l.includes(",") &&
    (
      l === l.toUpperCase() ||                                    // ALL CAPS
      /^[A-Z][a-z]+(\s+[A-Z][a-z]*)*$/.test(l) ||               // Title Case
      /^[A-Z][A-Z\s&/()]+$/.test(l)                              // ALLCAPS with symbols
    )
  );

  const foundHeadings: string[] = [...new Set(headingCandidates.map(h => h))];
  const foundHeadingsLower = foundHeadings.map(h => h.toLowerCase());

  const nonStandardHeadings: string[] = [];
  for (const heading of foundHeadings) {
    for (const { pattern, label } of NON_STANDARD_HEADING_PATTERNS) {
      if (pattern.test(heading)) {
        nonStandardHeadings.push(`"${heading}" → ${label}`);
      }
    }
  }

  // Check which standard headings are missing
  const importantStandard = ["experience", "education", "skills", "summary"];
  const missingStandardHeadings = importantStandard.filter(h =>
    !foundHeadingsLower.some(fh => fh.includes(h))
  );

  // Standardization score
  let standardizationScore = 100;
  standardizationScore -= nonStandardHeadings.length * 15;
  standardizationScore -= missingStandardHeadings.length * 10;
  standardizationScore = Math.max(0, Math.min(100, standardizationScore));

  return { foundHeadings, nonStandardHeadings, missingStandardHeadings, standardizationScore };
}

// ─── Keyword Density ──────────────────────────────────────────────────────────

function analyzeKeywordDensity(rawText: string): KeywordDensityResult {
  const words = rawText
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1);

  const totalWords = words.length;
  const meaningfulWords = words.filter(w => !STOP_WORDS.has(w) && w.length > 2);

  // Word frequency map
  const freq = new Map<string, number>();
  for (const w of meaningfulWords) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  // Detect keyword stuffing (any single word >5% of all words)
  const maxFreq = Math.max(...freq.values(), 0);
  const keywordStuffingDetected = totalWords > 50 && maxFreq / totalWords > 0.05;

  const topKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  const densityPercent = totalWords > 0
    ? Math.round((meaningfulWords.length / totalWords) * 100)
    : 0;

  return {
    totalWords,
    meaningfulWords: meaningfulWords.length,
    densityPercent,
    keywordStuffingDetected,
    topKeywords,
    lowDensity: densityPercent < 35 || totalWords < 150,
  };
}

// ─── Link Detection ───────────────────────────────────────────────────────────

function detectLinkIssues(rawText: string): ATSIssue[] {
  const issues: ATSIssue[] = [];

  // Find all URL-like patterns
  const urlPattern = /https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+|linkedin\.com[^\s"'<>]*/gi;
  const urls = rawText.match(urlPattern) ?? [];

  // Detect LinkedIn without https://
  const bareLinkedIn = rawText.match(/(?<!https?:\/\/)(linkedin\.com\/in\/[^\s"'<>]+)/gi) ?? [];
  if (bareLinkedIn.length > 0) {
    issues.push({
      type: "bare_linkedin_url",
      severity: "low",
      message: `LinkedIn URL missing https:// prefix`,
      explanation: "Some ATS systems (Greenhouse, Lever) only recognize LinkedIn URLs starting with https://. A bare linkedin.com URL may not be parsed as a clickable link.",
      impact: "Recruiter may not be able to click your profile link directly from the ATS.",
    });
  }

  // Detect GitHub without https://
  const bareGitHub = rawText.match(/(?<!https?:\/\/)(github\.com\/[^\s"'<>]+)/gi) ?? [];
  if (bareGitHub.length > 0) {
    issues.push({
      type: "bare_github_url",
      severity: "low",
      message: "GitHub URL missing https:// prefix",
      explanation: "GitHub URLs without https:// may not be hyperlinked in ATS exports.",
      impact: "Recruiter may need to manually type your GitHub URL.",
    });
  }

  // Detect potentially broken URLs (very long, no TLD, or contain spaces)
  const brokenUrls = urls.filter(u =>
    u.length > 200 || !/\.[a-z]{2,6}(\/|$)/i.test(u)
  );
  if (brokenUrls.length > 0) {
    issues.push({
      type: "potentially_broken_url",
      severity: "low",
      message: `${brokenUrls.length} potentially malformed URL(s) detected`,
      explanation: "URLs that are very long or missing a valid TLD may be broken or truncated in the ATS.",
      impact: "Broken links look unprofessional and prevent recruiters from viewing your work.",
    });
  }

  return issues;
}

// ─── Recruiter Filter Simulation ─────────────────────────────────────────────

function simulateRecruiterFilters(
  rawText: string,
  keywordDensity: KeywordDensityResult,
  hasExperience: boolean,
  hasSummary: boolean,
  formattingProblems: FormattingProblem[],
  parseRate: number,
): RecruiterFilterResult {
  const rejectionReasons: string[] = [];
  const warnings: string[] = [];
  const passedFilters: string[] = [];

  // Filter 1: Experience section required
  if (!hasExperience) {
    rejectionReasons.push(
      "AUTO-REJECT: No experience section found. Most ATS filters require at least one of: 'Experience', 'Work History', or 'Employment History' to rank the resume."
    );
  } else {
    passedFilters.push("Experience section present");
  }

  // Filter 2: Keyword density too low
  if (keywordDensity.lowDensity) {
    rejectionReasons.push(
      `AUTO-REJECT: Keyword density too low (${keywordDensity.densityPercent}% meaningful content, ${keywordDensity.totalWords} words total). ATS filters typically require 40-60% meaningful keyword density and at least 150 words to rank the resume.`
    );
  } else {
    passedFilters.push(`Adequate keyword density (${keywordDensity.densityPercent}%)`);
  }

  // Filter 3: Parse rate too low
  if (parseRate < 50) {
    rejectionReasons.push(
      `AUTO-REJECT: Parse rate critically low (${parseRate}%). ATS cannot extract sufficient information — the resume may be heavily image-based or use unsupported formatting.`
    );
  } else if (parseRate < 70) {
    warnings.push(
      `Low parse rate (${parseRate}%). ATS may miss key sections. Consider simplifying formatting.`
    );
  } else {
    passedFilters.push(`Parse rate acceptable (${parseRate}%)`);
  }

  // Filter 4: Keyword stuffing penalty
  if (keywordDensity.keywordStuffingDetected) {
    warnings.push(
      "Keyword stuffing detected. Some ATS systems (Workday, SuccessFactors) flag resumes with unnatural keyword repetition as spam and lower their rank."
    );
  }

  // Filter 5: Severe formatting issues
  const severeFormatting = formattingProblems.filter(p => p.detected && p.penalty >= 15);
  if (severeFormatting.length >= 2) {
    rejectionReasons.push(
      `AUTO-REJECT: ${severeFormatting.length} severe formatting issues detected (${severeFormatting.map(f => f.type).join(", ")}). Resume likely cannot be parsed reliably.`
    );
  } else if (severeFormatting.length === 1) {
    warnings.push(
      `Major formatting issue: ${severeFormatting[0].description}`
    );
  }

  // Filter 6: No summary (soft filter)
  if (!hasSummary) {
    warnings.push(
      "No professional summary/objective detected. Many ATS rankings use the summary to match candidates to job descriptions — missing it reduces keyword match potential."
    );
  } else {
    passedFilters.push("Professional summary present");
  }

  // Filter 7: Contact information
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawText);
  if (!hasEmail) {
    rejectionReasons.push(
      "AUTO-REJECT: No email address found. ATS systems require a valid email address to create a candidate profile."
    );
  } else {
    passedFilters.push("Email address present");
  }

  return {
    autoRejected: rejectionReasons.length > 0,
    rejectionReasons,
    warnings,
    passedFilters,
  };
}

// ─── Issue Builder ────────────────────────────────────────────────────────────

function buildIssues(
  parseQuality: ReturnType<typeof analyzeParseQuality>,
  formattingProblems: FormattingProblem[],
  headingAnalysis: HeadingAnalysis,
  linkIssues: ATSIssue[],
  keywordDensity: KeywordDensityResult,
  recruiterFilters: RecruiterFilterResult,
): ATSIssue[] {
  const issues: ATSIssue[] = [];

  // Parse quality issues
  if (parseQuality.parseRate < 70) {
    issues.push({
      type: "low_parse_rate",
      severity: parseQuality.parseRate < 50 ? "high" : "medium",
      message: `ATS parse rate: ${parseQuality.parseRate}% — content extraction is incomplete`,
      explanation: "Parse rate measures how much of the resume text can be reliably extracted by an ATS. Low rates indicate formatting barriers like images, text boxes, or encoding problems.",
      impact: `ATS systems like Taleo and Greenhouse may skip ${100 - parseQuality.parseRate}% of your content, making your qualifications invisible to recruiters.`,
    });
  }

  if (parseQuality.garbledSequences > 0) {
    issues.push({
      type: "garbled_text",
      severity: parseQuality.garbledSequences > 5 ? "high" : "medium",
      message: `${parseQuality.garbledSequences} garbled text sequence(s) detected`,
      explanation: "Garbled character sequences suggest the PDF was created from scanned images, has font embedding issues, or uses non-standard encoding.",
      impact: "ATS parsers output garbage characters that corrupt the candidate profile. Skills and job titles may be unrecognizable.",
    });
  }

  // Formatting problems
  for (const problem of formattingProblems) {
    if (!problem.detected) continue;
    issues.push({
      type: problem.type,
      severity: problem.penalty >= 15 ? "high" : problem.penalty >= 8 ? "medium" : "low",
      message: problem.description.split(".")[0],
      explanation: problem.description,
      impact: getFormattingImpact(problem.type),
    });
  }

  // Non-standard headings
  for (const heading of headingAnalysis.nonStandardHeadings) {
    issues.push({
      type: "non_standard_heading",
      severity: "medium",
      message: `Non-standard section heading: ${heading}`,
      explanation: `ATS systems look for specific heading keywords to classify resume sections. '${heading}' may not be recognized by standard parsers.`,
      impact: "Content under unrecognized headings is often ignored or misclassified, reducing your match score.",
    });
  }

  // Missing standard headings
  for (const heading of headingAnalysis.missingStandardHeadings) {
    issues.push({
      type: "missing_standard_heading",
      severity: heading === "experience" || heading === "education" ? "high" : "medium",
      message: `Standard section not detected: "${heading.charAt(0).toUpperCase() + heading.slice(1)}"`,
      explanation: `The "${heading}" section is expected by virtually all ATS systems. Without it, the resume scores poorly on section completeness filters.`,
      impact: `Resume may fail ATS "required section" filter and be auto-rejected before a human reads it.`,
    });
  }

  // Link issues
  issues.push(...linkIssues);

  // Keyword density
  if (keywordDensity.lowDensity) {
    issues.push({
      type: "low_keyword_density",
      severity: "high",
      message: `Low keyword density: ${keywordDensity.densityPercent}% meaningful content (${keywordDensity.totalWords} words)`,
      explanation: "ATS ranking algorithms use keyword density to score relevance. Resumes with too few words or too many filler words score poorly on all job matches.",
      impact: "Resume will rank near the bottom for all job searches, even for roles you are qualified for.",
    });
  }

  if (keywordDensity.keywordStuffingDetected) {
    issues.push({
      type: "keyword_stuffing",
      severity: "medium",
      message: "Keyword stuffing detected — unnatural repetition of terms",
      explanation: "Some ATS systems (Workday, SmartRecruiters) use anti-spam filters that detect unnatural keyword repetition.",
      impact: "Resume may be flagged as manipulative and ranked lower or filtered out by spam detection.",
    });
  }

  // Recruiter filter rejection reasons
  for (const reason of recruiterFilters.rejectionReasons) {
    // Only add if not already captured above
    const isDuplicate = issues.some(i => reason.toLowerCase().includes(i.type.replace(/_/g, " ")));
    if (!isDuplicate) {
      issues.push({
        type: "recruiter_filter_rejection",
        severity: "high",
        message: reason.replace("AUTO-REJECT: ", "").split(".")[0],
        explanation: reason,
        impact: "Resume will be filtered out before reaching a human recruiter.",
      });
    }
  }

  return issues;
}

function getFormattingImpact(type: string): string {
  const impacts: Record<string, string> = {
    multi_column_layout: "Column text is read in the wrong order by ATS, mixing up job titles, dates, and company names. A Senior Engineer may appear as '2019 Google Engineer Senior'.",
    table_detected: "Table cells are either completely skipped or all merged into one line of garbled text. Skills listed in tables are invisible to keyword matching.",
    icons_or_emojis: "Icon characters are parsed as random symbols (e.g., '★' becomes '?'), corrupting the surrounding text in the ATS profile.",
    header_footer: "Page numbers and labels parsed as job experience lines, adding fake entries to your work history.",
    text_boxes: "Text box content is extracted out of order or skipped entirely, scrambling the logical flow of your resume.",
    special_bullet_characters: "Bullet symbols converted to literal characters like '?' or '\ufffd', potentially splitting sentences mid-word.",
  };
  return impacts[type] ?? "May cause incorrect parsing of surrounding content.";
}

// ─── Main ATS Engine ──────────────────────────────────────────────────────────

export function runATSEngine(
  rawText: string,
  isPDF: boolean,
  hasExperience: boolean,
  hasSummary: boolean,
): ATSEngineResult {
  const parseQuality = analyzeParseQuality(rawText);
  const formattingProblems = detectFormattingProblems(rawText, isPDF);
  const headingAnalysis = analyzeHeadings(rawText);
  const keywordDensity = analyzeKeywordDensity(rawText);
  const linkIssues = detectLinkIssues(rawText);

  const recruiterFilters = simulateRecruiterFilters(
    rawText,
    keywordDensity,
    hasExperience,
    hasSummary,
    formattingProblems,
    parseQuality.parseRate,
  );

  const issues = buildIssues(
    parseQuality,
    formattingProblems,
    headingAnalysis,
    linkIssues,
    keywordDensity,
    recruiterFilters,
  );

  // ATS Score: weighted sum of sub-scores
  const totalFormattingPenalty = formattingProblems
    .filter(p => p.detected)
    .reduce((sum, p) => sum + p.penalty, 0);

  let atsScore = 100;
  atsScore -= Math.min(40, totalFormattingPenalty);
  atsScore -= Math.max(0, (100 - parseQuality.parseRate) * 0.4);
  atsScore -= (100 - headingAnalysis.standardizationScore) * 0.15;
  atsScore -= keywordDensity.lowDensity ? 15 : 0;
  atsScore -= keywordDensity.keywordStuffingDetected ? 10 : 0;
  atsScore -= recruiterFilters.autoRejected ? 20 : 0;
  atsScore -= linkIssues.length * 3;
  atsScore = Math.max(5, Math.min(100, Math.round(atsScore)));

  return {
    parseRate: parseQuality.parseRate,
    atsScore,
    issues,
    formattingProblems,
    headingAnalysis,
    keywordDensity,
    recruiterFilters,
    parseQualityBreakdown: {
      totalChars: parseQuality.totalChars,
      printableRatio: Math.round(parseQuality.printableRatio * 100) / 100,
      garbledSequences: parseQuality.garbledSequences,
      encodingIssues: parseQuality.encodingIssues,
      avgLineLength: Math.round(parseQuality.avgLineLength),
    },
  };
}
