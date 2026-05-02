import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, CheckCircle, Info, XCircle, ChevronLeft,
  Wand2, Briefcase, User, Mail, Phone, Code2, ArrowRight,
  ShieldAlert, ShieldCheck, BarChart2, Type, Link2,
  Filter, ChevronDown, ChevronUp, Zap, Lightbulb, Target,
  TrendingUp, Clock, Rocket, ListChecks
} from "lucide-react";
import { useMatchJob, useGenerateActionPlan } from "@workspace/api-client-react";
import ScoreMeter from "@/components/ScoreMeter";
import ScoreCard from "@/components/ScoreCard";
import { getScoreClass, getScoreColor, getScoreBgClass, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ATSIssue {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  explanation?: string;
  impact?: string;
}

interface MissingSectionDetail {
  section: string;
  importance: "critical" | "important" | "recommended";
  why: string;
  example: string;
  scoreImpact: string;
}

interface ActionPlanStep {
  step: number;
  priority: "critical" | "high" | "medium";
  action: string;
  what: string;
  why: string;
  expectedScoreGain: number;
  effort: string;
}

interface FormattingProblem {
  type: string;
  detected: boolean;
  description: string;
  penalty: number;
}

interface ATSDetail {
  parseQualityBreakdown: {
    totalChars: number;
    printableRatio: number;
    garbledSequences: number;
    encodingIssues: number;
    avgLineLength: number;
  };
  formattingProblems: FormattingProblem[];
  headingAnalysis: {
    foundHeadings: string[];
    nonStandardHeadings: string[];
    missingStandardHeadings: string[];
    standardizationScore: number;
  };
  keywordDensity: {
    totalWords: number;
    meaningfulWords: number;
    densityPercent: number;
    keywordStuffingDetected: boolean;
    topKeywords: Array<{ word: string; count: number }>;
    lowDensity: boolean;
  };
  recruiterFilters: {
    autoRejected: boolean;
    rejectionReasons: string[];
    warnings: string[];
    passedFilters: string[];
  };
}

interface AnalysisResult {
  id: number;
  resumeId: number;
  overallScore: number;
  contentScore: number;
  sectionScore: number;
  atsScore: number;
  tailoringScore: number;
  parseRate: number;
  impactScore: number;
  confidenceScore: number;
  issues: ATSIssue[];
  suggestions: string[];
  missingSections: string[];
  missingSectionsDetail?: MissingSectionDetail[];
  metricsCount: number;
  weakBullets: string[];
  strongBullets: string[];
  parsedData?: {
    name?: string; email?: string; phone?: string;
    skills?: string[]; summary?: string;
    linkedin?: string; github?: string;
  };
  atsDetail?: ATSDetail;
  createdAt: string;
}

interface AnalyzeProps {
  analysis: AnalysisResult | null;
  resumeId: number | null;
  onNavigateImprove: () => void;
  onNavigateTools?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const severityConfig: Record<string, { icon: React.ReactNode; label: string; classes: string }> = {
  high:   { icon: <XCircle className="w-3.5 h-3.5" />,      label: "High",   classes: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Medium", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  low:    { icon: <Info className="w-3.5 h-3.5" />,          label: "Low",    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

function IssueRow({ issue, index }: { issue: ATSIssue; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = severityConfig[issue.severity] ?? severityConfig.low;
  const hasDetail = !!(issue.explanation || issue.impact);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-lg border text-xs overflow-hidden ${cfg.classes}`}
    >
      <div
        className={cn("flex items-start gap-2.5 px-3 py-2.5", hasDetail && "cursor-pointer select-none")}
        onClick={() => hasDetail && setExpanded(e => !e)}
      >
        <span className="mt-0.5 flex-shrink-0">{cfg.icon}</span>
        <span className="flex-1 leading-relaxed">{issue.message}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="font-semibold opacity-75">{cfg.label}</span>
          {hasDetail && (
            expanded ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />
          )}
        </div>
      </div>
      <AnimatePresence>
        {expanded && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-current/10 px-3 py-3 space-y-2 bg-black/10"
          >
            {issue.explanation && (
              <div>
                <span className="font-semibold opacity-80">Why it matters: </span>
                <span className="opacity-70">{issue.explanation}</span>
              </div>
            )}
            {issue.impact && (
              <div>
                <span className="font-semibold opacity-80">ATS impact: </span>
                <span className="opacity-70">{issue.impact}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── SmartMissingSection ───────────────────────────────────────────────────────

const importanceConfig = {
  critical:    { label: "Critical",    classes: "bg-destructive/10 border-destructive/25 text-destructive" },
  important:   { label: "Important",   classes: "bg-amber-500/10 border-amber-500/25 text-amber-400" },
  recommended: { label: "Recommended", classes: "bg-blue-500/10 border-blue-500/25 text-blue-400" },
};

function SmartMissingSection({ detail }: { detail: MissingSectionDetail }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = importanceConfig[detail.importance];
  return (
    <div className={`rounded-xl border overflow-hidden ${cfg.classes}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <XCircle className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold capitalize text-sm">{detail.section}</span>
          <span className="text-xs opacity-60 ml-2">section missing</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-current/10 opacity-80`}>{cfg.label}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 opacity-60 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-current/10 px-4 py-4 space-y-3 bg-black/10"
          >
            <div className="flex items-start gap-2 text-xs">
              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-70" />
              <div><span className="font-semibold opacity-80">Why it matters: </span><span className="opacity-70">{detail.why}</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-70" />
              <div><span className="font-semibold opacity-80">Score impact: </span><span className="opacity-70">{detail.scoreImpact}</span></div>
            </div>
            <div className="rounded-lg bg-black/15 border border-current/10 px-3 py-2.5 text-xs opacity-75 italic leading-relaxed">
              <span className="not-italic font-semibold opacity-90 block mb-1">Example:</span>
              {detail.example}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ActionPlanSection ─────────────────────────────────────────────────────────

const planPriorityConfig = {
  critical: { dot: "bg-destructive", label: "Critical", bar: "bg-destructive" },
  high:     { dot: "bg-amber-400",   label: "High",     bar: "bg-amber-400" },
  medium:   { dot: "bg-blue-400",    label: "Medium",   bar: "bg-blue-400" },
};

function ActionPlanCard({ step, index }: { step: ActionPlanStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = planPriorityConfig[step.priority] ?? planPriorityConfig.medium;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-start gap-3 px-4 py-3.5 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
          <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground/70">{step.step}</div>
          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug">{step.action}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-green-400 font-semibold whitespace-nowrap">+{step.expectedScoreGain} pts</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"><Clock className="w-3 h-3" />{step.effort}</span>
            </div>
          </div>
          <span className={`text-xs font-medium ${cfg.dot.replace("bg-", "text-")}`}>{cfg.label} priority</span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 opacity-40 flex-shrink-0 mt-1" /> : <ChevronDown className="w-3.5 h-3.5 opacity-40 flex-shrink-0 mt-1" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border px-4 py-3.5 bg-muted/30 space-y-2.5"
          >
            <div className="text-xs">
              <span className="font-semibold text-foreground/80">What to do: </span>
              <span className="text-foreground/65">{step.what}</span>
            </div>
            <div className="text-xs">
              <span className="font-semibold text-foreground/80">Why it matters: </span>
              <span className="text-foreground/65">{step.why}</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400`}>
              <TrendingUp className="w-3 h-3" /> Expected gain: +{step.expectedScoreGain} score points
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Analyze({ analysis, resumeId, onNavigateImprove, onNavigateTools }: AnalyzeProps) {
  const [, navigate] = useLocation();
  const [jobDesc, setJobDesc] = useState("");
  const [matchResult, setMatchResult] = useState<null | {
    matchPercentage: number; matchedKeywords: string[]; missingKeywords: string[]; suggestedSkills: string[];
  }>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlanStep[] | null>(null);
  const [planGenerated, setPlanGenerated] = useState(false);
  const matchMutation = useMatchJob();
  const planMutation = useGenerateActionPlan();

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No analysis found. Please upload a resume first.</p>
          <button onClick={() => navigate("/")} className="text-primary hover:underline flex items-center gap-1 mx-auto">
            <ChevronLeft className="w-4 h-4" /> Go back
          </button>
        </div>
      </div>
    );
  }

  const handleMatchJob = async () => {
    if (!resumeId || !jobDesc.trim()) return;
    try {
      const result = await matchMutation.mutateAsync({ data: { resumeId, jobDescription: jobDesc } });
      setMatchResult(result);
    } catch { /* ignore */ }
  };

  const handleGeneratePlan = async () => {
    if (!resumeId) return;
    try {
      const result = await planMutation.mutateAsync({ data: { resumeId } });
      setActionPlan(result.steps);
      setPlanGenerated(true);
    } catch { /* ignore */ }
  };

  const DEFAULT_ROLES = ["Frontend Developer", "Backend Engineer", "Full Stack Developer", "AI/ML Engineer", "DevOps Engineer"];

  const parsed = analysis.parsedData ?? {};
  const ats = analysis.atsDetail;
  const detectedFormatProblems = ats?.formattingProblems.filter(f => f.detected) ?? [];
  const highIssues = analysis.issues.filter(i => i.severity === "high");
  const mediumIssues = analysis.issues.filter(i => i.severity === "medium");
  const lowIssues = analysis.issues.filter(i => i.severity === "low");

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Nav */}
      <nav className="border-b border-border/50 px-6 py-3 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> New Analysis
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">Analyzed {formatDate(analysis.createdAt)}</span>
          <button onClick={onNavigateImprove} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Wand2 className="w-3.5 h-3.5" /> AI Improve
          </button>
          {onNavigateTools && (
            <button onClick={onNavigateTools} className="flex items-center gap-1.5 text-sm border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors font-medium">
              ⚡ Power Tools
            </button>
          )}
          <button onClick={() => navigate("/history")} className="text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors">
            History
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Score Overview ─────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <ScoreMeter score={analysis.overallScore} size={180} strokeWidth={14} />
              <p className="text-sm text-muted-foreground font-medium">Overall Resume Score</p>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
              {[
                { label: "Impact Score", value: analysis.impactScore, suffix: "", score: analysis.impactScore },
                { label: "Confidence", value: analysis.confidenceScore, suffix: "%", score: analysis.confidenceScore },
                { label: "Parse Rate", value: analysis.parseRate, suffix: "%", score: analysis.parseRate },
                { label: "Metrics Found", value: analysis.metricsCount, suffix: "", score: 75 },
                { label: "Critical Issues", value: highIssues.length, suffix: "", score: highIssues.length === 0 ? 90 : highIssues.length <= 2 ? 50 : 20, red: highIssues.length > 0 },
                { label: "Total Issues", value: analysis.issues.length, suffix: "", score: analysis.issues.length === 0 ? 90 : 70 },
              ].map(({ label, value, suffix, score, red }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <div className={`text-2xl font-bold ${red ? "text-destructive" : getScoreClass(score)}`}>
                    {value}{suffix}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-tight">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Recruiter Filter Banner ─────────────────────────────────────── */}
        {ats?.recruiterFilters && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-xl border p-5 ${
              ats.recruiterFilters.autoRejected
                ? "bg-destructive/8 border-destructive/30"
                : "bg-green-500/8 border-green-500/25"
            }`}
          >
            <div className="flex items-start gap-3">
              {ats.recruiterFilters.autoRejected
                ? <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                : <ShieldCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm mb-2 ${ats.recruiterFilters.autoRejected ? "text-destructive" : "text-green-400"}`}>
                  {ats.recruiterFilters.autoRejected
                    ? `Recruiter Auto-Filter: WOULD BE REJECTED (${ats.recruiterFilters.rejectionReasons.length} reason${ats.recruiterFilters.rejectionReasons.length > 1 ? "s" : ""})`
                    : "Recruiter Auto-Filter: PASSED"
                  }
                </p>
                {ats.recruiterFilters.rejectionReasons.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {ats.recruiterFilters.rejectionReasons.map((r, i) => (
                      <p key={i} className="text-xs text-destructive/90 leading-relaxed">{r}</p>
                    ))}
                  </div>
                )}
                {ats.recruiterFilters.passedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ats.recruiterFilters.passedFilters.map((f) => (
                      <span key={f} className="px-2 py-0.5 bg-green-500/15 border border-green-500/20 rounded text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" />{f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Category Scores ─────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold mb-3">Score Breakdown</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <ScoreCard label="Content" score={analysis.contentScore} description="Bullets, metrics, action verbs" delay={0.1} />
            <ScoreCard label="Sections" score={analysis.sectionScore} description="Required resume sections" delay={0.15} />
            <ScoreCard label="ATS Compat." score={analysis.atsScore} description="Formatting, parsing, headings" delay={0.2} />
            <ScoreCard label="Tailoring" score={analysis.tailoringScore} description="Job match alignment" delay={0.25} />
            <ScoreCard label="Impact" score={analysis.impactScore} description="Metrics, outcomes, results" delay={0.3} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* ── Issues ────────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Issues Detected
              <div className="ml-auto flex items-center gap-1.5">
                {highIssues.length > 0 && <span className="px-1.5 py-0.5 bg-destructive/15 text-destructive text-xs rounded font-medium">{highIssues.length} high</span>}
                {mediumIssues.length > 0 && <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded font-medium">{mediumIssues.length} med</span>}
                {lowIssues.length > 0 && <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded font-medium">{lowIssues.length} low</span>}
              </div>
            </h2>
            {analysis.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues found!</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {[...highIssues, ...mediumIssues, ...lowIssues].map((issue, i) => (
                  <IssueRow key={i} issue={issue} index={i} />
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Suggestions ───────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" /> Improvement Suggestions
            </h2>
            {analysis.suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional suggestions.</p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {analysis.suggestions.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                    className="flex items-start gap-2.5 text-xs">
                    <ArrowRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/85 leading-relaxed">{s}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── ATS Formatting Analysis ─────────────────────────────────────── */}
        {ats && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> ATS Formatting Analysis
              <span className="ml-auto text-xs text-muted-foreground">
                {detectedFormatProblems.length} issue{detectedFormatProblems.length !== 1 ? "s" : ""} detected
              </span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {ats.formattingProblems.map((problem) => (
                <div key={problem.type}
                  className={`rounded-lg border p-3.5 text-xs ${problem.detected
                    ? problem.penalty >= 15
                      ? "bg-destructive/8 border-destructive/20"
                      : problem.penalty >= 8
                      ? "bg-amber-500/8 border-amber-500/20"
                      : "bg-blue-500/8 border-blue-500/20"
                    : "bg-green-500/8 border-green-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {problem.detected
                      ? <XCircle className={`w-3.5 h-3.5 flex-shrink-0 ${problem.penalty >= 15 ? "text-destructive" : "text-amber-400"}`} />
                      : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-green-400" />
                    }
                    <span className="font-semibold capitalize">{problem.type.replace(/_/g, " ")}</span>
                    {problem.detected && problem.penalty > 0 && (
                      <span className="ml-auto text-xs opacity-60">−{problem.penalty} pts</span>
                    )}
                  </div>
                  <p className={`leading-relaxed ${problem.detected ? "opacity-85" : "opacity-60"}`}>
                    {problem.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Parse Quality & Heading Analysis ───────────────────────────── */}
        {ats && (
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Parse Quality Breakdown */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" /> Parse Quality Breakdown
              </h2>
              <div className="space-y-3">
                {[
                  { label: "Parse Rate", value: `${analysis.parseRate}%`, score: analysis.parseRate },
                  { label: "Printable Char Ratio", value: `${Math.round(ats.parseQualityBreakdown.printableRatio * 100)}%`, score: Math.round(ats.parseQualityBreakdown.printableRatio * 100) },
                  { label: "Total Characters", value: ats.parseQualityBreakdown.totalChars.toLocaleString(), score: null },
                  { label: "Garbled Sequences", value: ats.parseQualityBreakdown.garbledSequences, score: ats.parseQualityBreakdown.garbledSequences === 0 ? 100 : ats.parseQualityBreakdown.garbledSequences > 5 ? 20 : 50 },
                  { label: "Encoding Issues", value: ats.parseQualityBreakdown.encodingIssues, score: ats.parseQualityBreakdown.encodingIssues === 0 ? 100 : 30 },
                  { label: "Avg Line Length", value: `${ats.parseQualityBreakdown.avgLineLength} chars`, score: null },
                ].map(({ label, value, score }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-44 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      {score !== null && (
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: getScoreColor(score) }}
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      )}
                    </div>
                    <span className={`text-xs font-medium w-20 text-right ${score !== null ? getScoreClass(score) : "text-foreground/70"}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Heading Analysis */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" /> Section Heading Analysis
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${getScoreBgClass(ats.headingAnalysis.standardizationScore)}`}>
                  {ats.headingAnalysis.standardizationScore}/100
                </span>
              </h2>

              {ats.headingAnalysis.foundHeadings.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Detected headings</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ats.headingAnalysis.foundHeadings.slice(0, 12).map((h) => {
                      const isNonStd = ats.headingAnalysis.nonStandardHeadings.some(ns => ns.includes(`"${h}"`));
                      return (
                        <span key={h} className={`px-2 py-0.5 rounded text-xs border ${isNonStd
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-green-500/10 border-green-500/20 text-green-400"
                        }`}>
                          {h}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {ats.headingAnalysis.nonStandardHeadings.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-amber-400 mb-1.5">Non-standard headings</p>
                  {ats.headingAnalysis.nonStandardHeadings.map((h) => (
                    <p key={h} className="text-xs text-amber-400/80 mb-1">{h}</p>
                  ))}
                </div>
              )}

              {ats.headingAnalysis.missingStandardHeadings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-destructive mb-1.5">Missing standard sections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ats.headingAnalysis.missingStandardHeadings.map((h) => (
                      <span key={h} className="px-2 py-0.5 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive capitalize">{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {ats.headingAnalysis.nonStandardHeadings.length === 0 && ats.headingAnalysis.missingStandardHeadings.length === 0 && (
                <p className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> All detected headings are ATS-standard</p>
              )}
            </motion.div>
          </div>
        )}

        {/* ── Keyword Density ─────────────────────────────────────────────── */}
        {ats && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Keyword Density Analysis
              <div className="ml-auto flex items-center gap-2">
                {ats.keywordDensity.keywordStuffingDetected && (
                  <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Keyword Stuffing Detected</span>
                )}
                {ats.keywordDensity.lowDensity && (
                  <span className="text-xs bg-destructive/15 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full">Low Density</span>
                )}
              </div>
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              {[
                { label: "Total Words", value: ats.keywordDensity.totalWords },
                { label: "Meaningful Words", value: ats.keywordDensity.meaningfulWords },
                { label: "Keyword Density", value: `${ats.keywordDensity.densityPercent}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/40 rounded-lg px-4 py-3 text-center">
                  <div className="text-xl font-bold text-foreground">{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {ats.keywordDensity.topKeywords.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2.5">Top keywords by frequency</p>
                <div className="flex flex-wrap gap-2">
                  {ats.keywordDensity.topKeywords.slice(0, 20).map(({ word, count }) => (
                    <span key={word} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/15 rounded-lg text-xs">
                      <span className="text-primary font-medium">{word}</span>
                      <span className="text-muted-foreground">×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Missing Sections (Smart) ─────────────────────────────────────── */}
        {(analysis.missingSectionsDetail ?? []).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Missing Sections
              <span className="text-xs text-muted-foreground font-normal ml-1">— click each to see why it matters and an example</span>
            </h2>
            <div className="space-y-2">
              {(analysis.missingSectionsDetail ?? []).map((detail) => (
                <SmartMissingSection key={detail.section} detail={detail} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Bullet Strength ─────────────────────────────────────────────── */}
        {(analysis.weakBullets.length > 0 || analysis.strongBullets.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">Bullet Point Strength</h2>
            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-medium text-destructive mb-2 uppercase tracking-wider">Weak Bullets ({analysis.weakBullets.length})</p>
                <div className="space-y-1.5">
                  {analysis.weakBullets.length === 0
                    ? <p className="text-xs text-muted-foreground">None found</p>
                    : analysis.weakBullets.map((b, i) => (
                        <div key={i} className="text-xs bg-destructive/6 border border-destructive/15 rounded-lg px-3 py-2 text-foreground/75">{b}</div>
                      ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-green-400 mb-2 uppercase tracking-wider">Strong Bullets ({analysis.strongBullets.length})</p>
                <div className="space-y-1.5">
                  {analysis.strongBullets.length === 0
                    ? <p className="text-xs text-muted-foreground">None detected — use action verbs like "led", "built", "drove"</p>
                    : analysis.strongBullets.map((b, i) => (
                        <div key={i} className="text-xs bg-green-500/6 border border-green-500/15 rounded-lg px-3 py-2 text-foreground/80">{b}</div>
                      ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Parsed Contact & Skills ──────────────────────────────────────── */}
        {(parsed.name || parsed.email) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Parsed Contact Info</h2>
            <div className="flex flex-wrap gap-4 text-sm mb-4">
              {parsed.name && <div className="flex items-center gap-2 text-foreground/80"><User className="w-3.5 h-3.5 text-muted-foreground" />{parsed.name}</div>}
              {parsed.email && <div className="flex items-center gap-2 text-foreground/80"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{parsed.email}</div>}
              {parsed.phone && <div className="flex items-center gap-2 text-foreground/80"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{parsed.phone}</div>}
              {parsed.linkedin && (
                <div className="flex items-center gap-2 text-foreground/80">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs">{parsed.linkedin}</span>
                </div>
              )}
            </div>
            {parsed.skills && parsed.skills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Code2 className="w-3.5 h-3.5" /> Detected Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.skills.slice(0, 25).map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Action Plan ──────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }} className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Rocket className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Personalized Action Plan</h2>
            <span className="text-xs text-muted-foreground ml-1">AI-generated improvement roadmap</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Get a prioritized, step-by-step plan tailored to your resume's specific issues — with expected score gains for each fix.</p>
          {!planGenerated ? (
            <button
              onClick={handleGeneratePlan}
              disabled={planMutation.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 hover:bg-primary/90 transition-colors"
            >
              {planMutation.isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating plan...</>
                : <><ListChecks className="w-3.5 h-3.5" /> Generate My Action Plan</>
              }
            </button>
          ) : actionPlan && actionPlan.length > 0 ? (
            <div className="space-y-2">
              {actionPlan.map((step, i) => (
                <ActionPlanCard key={step.step} step={step} index={i} />
              ))}
              <div className="mt-3 p-3 bg-green-500/8 border border-green-500/20 rounded-lg text-xs text-green-400 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                Completing all steps could improve your overall score by approximately <span className="font-bold ml-1">+{actionPlan.reduce((a, s) => a + s.expectedScoreGain, 0)} points</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No plan generated yet.</p>
          )}
        </motion.div>

        {/* ── Job Description Match ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" /> Job Description Match</h2>
          <p className="text-xs text-muted-foreground mb-3">Paste a job description to see how well your resume aligns with the role's keywords.</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-xs text-muted-foreground self-center mr-1">Quick match:</span>
            {DEFAULT_ROLES.map(role => (
              <button
                key={role}
                onClick={() => setJobDesc(`We are hiring a ${role}. Requirements: strong programming skills, experience with relevant frameworks, problem-solving ability, team collaboration, system design, version control (Git), testing practices, and passion for building great products.`)}
                className="px-2.5 py-1 text-xs bg-muted border border-border rounded-full hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors"
              >
                {role}
              </button>
            ))}
          </div>
          <textarea
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
            placeholder="Paste job description here..."
            rows={4}
            className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary/50 transition-all"
          />
          <button
            onClick={handleMatchJob}
            disabled={!jobDesc.trim() || matchMutation.isPending}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            {matchMutation.isPending
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Matching...</>
              : "Analyze Match"
            }
          </button>
          {matchResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`text-3xl font-bold ${getScoreClass(matchResult.matchPercentage)}`}>{matchResult.matchPercentage}%</div>
                <div>
                  <p className="font-medium text-sm">Keyword Match Rate</p>
                  <p className="text-xs text-muted-foreground">How well your resume aligns with this job</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-green-400 mb-2">Matched Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.matchedKeywords.slice(0, 12).map((k) => (
                      <span key={k} className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">{k}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-destructive mb-2">Missing Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.missingKeywords.slice(0, 12).map((k) => (
                      <span key={k} className="px-2 py-0.5 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
              {matchResult.suggestedSkills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-2">Suggested Skills to Add</p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.suggestedSkills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* ── AI Improve CTA ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} className="bg-gradient-to-r from-primary/20 to-blue-600/20 border border-primary/30 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold mb-1">Ready to improve your resume?</h2>
            <p className="text-sm text-muted-foreground">Let Gemini AI rewrite weak bullets and craft a stronger professional summary.</p>
          </div>
          <button onClick={onNavigateImprove} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors flex-shrink-0 whitespace-nowrap">
            <Wand2 className="w-4 h-4" /> Improve with AI
          </button>
        </motion.div>

      </div>
    </div>
  );
}
