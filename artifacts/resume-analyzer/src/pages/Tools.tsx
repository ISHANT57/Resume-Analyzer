import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Briefcase, Eye, BarChart3, Zap,
  CheckCircle, XCircle, AlertTriangle, ArrowRight,
  Clock, BookOpen, TrendingUp, TrendingDown, Minus,
  Star, Shield, Target, Wand2, ChevronDown, ChevronUp,
  Users, Award, Layers, Flame, ScanSearch, Route,
  TriangleAlert, BadgeCheck, CircleSlash, ChevronRight,
  Sparkles, MapPin, Rocket,
} from "lucide-react";
import {
  useRoleAnalyze, useRecruiterSim, useBenchmarkResume, useImproveBullets,
  useScanRedFlags, useDetectPadding, usePredictCareerTrajectory,
} from "@workspace/api-client-react";
import type {
  RoleAnalyzeResult, RecruiterSimResult, BenchmarkResult, ImproveBulletsResult,
  RedFlagsResult, PaddingDetectorResult, CareerTrajectoryResult,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { getScoreColor, getScoreClass } from "@/lib/utils";

// ── Shared helpers ───────────────────────────────────────────────────────────

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20" />
        <div className="w-12 h-12 rounded-full border-2 border-t-primary animate-spin absolute inset-0" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
    </div>
  );
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function EmptyState({ onRun, label, icon: Icon, description }: {
  onRun: () => void; label: string; icon: React.FC<{ className?: string }>; description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <div>
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      </div>
    </div>
  );
}

// ── Tab 1: Role Analyzer ─────────────────────────────────────────────────────

function RoleAnalyzerTab({ resumeId }: { resumeId: number }) {
  const [jobTitle, setJobTitle] = useState("");
  const [result, setResult] = useState<RoleAnalyzeResult | null>(null);
  const mutation = useRoleAnalyze();

  const handleRun = async () => {
    if (!jobTitle.trim()) return;
    const r = await mutation.mutateAsync({ data: { resumeId, jobTitle } });
    setResult(r);
  };

  const importanceColor = (imp: string) =>
    imp === "essential" ? "text-destructive bg-destructive/10 border-destructive/20"
    : imp === "preferred" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-blue-400 bg-blue-500/10 border-blue-500/20";

  const verdictConfig = result ? {
    likely_shortlisted:   { color: "text-green-400",  bg: "bg-green-500/10 border-green-500/25",   icon: CheckCircle, label: "Likely to be Shortlisted" },
    possible_shortlisted: { color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/25",   icon: AlertTriangle, label: "Possible — Room to Improve" },
    unlikely_shortlisted: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/25", icon: XCircle, label: "Unlikely to Pass Screening" },
  }[result.hiringVerdict] ?? { color: "text-muted-foreground", bg: "bg-muted border-border", icon: AlertTriangle, label: result?.hiringVerdict } : null;

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="flex gap-3">
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="e.g., Frontend Developer, ML Engineer, Product Manager..."
          className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
        />
        <button
          onClick={handleRun}
          disabled={!jobTitle.trim() || mutation.isPending}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          {mutation.isPending ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</> : <><Target className="w-3.5 h-3.5" /> Analyze Fit</>}
        </button>
      </div>

      {mutation.isPending && <LoadingSpinner label="Gemini is analyzing role requirements..." />}

      {!result && !mutation.isPending && (
        <EmptyState onRun={handleRun} icon={Briefcase} label="Job Role Analyzer" description="Enter a job title above and Gemini will map required skills, compare with your resume, and build a learning path." />
      )}

      {result && !mutation.isPending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Verdict + score */}
          {verdictConfig && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${verdictConfig.bg}`}>
              <verdictConfig.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${verdictConfig.color}`} />
              <div className="flex-1">
                <p className={`font-semibold text-sm ${verdictConfig.color}`}>{verdictConfig.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{result.verdictReason}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-3xl font-bold ${getScoreClass(result.matchScore)}`}>{result.matchScore}%</div>
                <div className="text-xs text-muted-foreground">match</div>
              </div>
            </div>
          )}

          {/* Role overview */}
          {result.roleOverview && (
            <div className="bg-muted/40 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Role Overview</p>
              {result.roleOverview}
            </div>
          )}

          {/* Skills grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider">Present Skills ({result.presentSkills.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {result.presentSkills.map((s) => (
                  <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
                    <CheckCircle className="w-2.5 h-2.5" />{s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-destructive mb-2 uppercase tracking-wider">Missing Skills ({result.missingSkills.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.map((s) => (
                  <span key={s.skill} className={`flex items-center gap-1 px-2.5 py-1 border rounded-lg text-xs ${importanceColor(s.importance)}`}>
                    <XCircle className="w-2.5 h-2.5" />{s.skill}
                    <span className="opacity-60 capitalize">({s.importance})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Required skills table */}
          {result.requiredSkills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Full Skill Map for {jobTitle}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {result.requiredSkills.map((s) => (
                  <div key={s.skill} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${s.present ? "bg-green-500/6 border-green-500/15" : "bg-muted/40 border-border"}`}>
                    {s.present
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                    }
                    <span className={s.present ? "text-foreground/80" : "text-muted-foreground"}>{s.skill}</span>
                    <span className={`ml-auto capitalize text-xs px-1.5 py-0.5 rounded border ${importanceColor(s.importance)}`}>{s.importance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning path */}
          {result.learningPath.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-primary mb-3 uppercase tracking-wider">Recommended Learning Path</p>
              <div className="space-y-2.5">
                {result.learningPath.map((item, i) => (
                  <div key={item.skill} className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-3.5">
                    <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{item.skill}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="w-3 h-3" />{item.timeToLearn}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{item.reason}</p>
                      <p className="text-xs flex items-center gap-1 text-primary/80"><BookOpen className="w-3 h-3" />{item.resource}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Tab 2: Recruiter Simulation ──────────────────────────────────────────────

const attentionConfig = (level: string) => ({
  high:    { color: "text-green-400",        bg: "bg-green-500/15", barColor: "#22c55e", width: "100%" },
  medium:  { color: "text-amber-400",        bg: "bg-amber-500/15", barColor: "#f59e0b", width: "65%"  },
  low:     { color: "text-blue-400",         bg: "bg-blue-500/15",  barColor: "#3b82f6", width: "30%"  },
  ignored: { color: "text-muted-foreground", bg: "bg-muted/50",     barColor: "#4b5563", width: "8%"   },
}[level] ?? { color: "text-muted-foreground", bg: "bg-muted/50", barColor: "#6b7280", width: "20%" });

function AttentionSectionRow({ section, index }: { section: RecruiterSimResult["attentionMap"][number]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = attentionConfig(section.attentionLevel);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="w-28 flex-shrink-0">
          <p className="text-xs font-medium text-foreground/80 truncate">{section.section}</p>
          <p className={`text-xs font-semibold capitalize ${cfg.color}`}>{section.attentionLevel}</p>
        </div>
        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: cfg.barColor }}
              initial={{ width: 0 }}
              animate={{ width: cfg.width }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{section.timeSpent}</span>
          <span className={`text-xs font-bold ${getScoreClass(section.score)}`}>{section.score}</span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-3 border-t border-border pt-3 space-y-2">
              <p className="text-xs italic text-foreground/70">"{section.recruiterThought}"</p>
              {section.positives.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {section.positives.map(p => (
                    <span key={p} className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded">✓ {p}</span>
                  ))}
                </div>
              )}
              {section.issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {section.issues.map(issue => (
                    <span key={issue} className="text-xs bg-destructive/10 border border-destructive/20 text-destructive px-2 py-0.5 rounded">✗ {issue}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RecruiterSimTab({ resumeId }: { resumeId: number }) {
  const [result, setResult] = useState<RecruiterSimResult | null>(null);
  const mutation = useRecruiterSim();

  const handleRun = async () => {
    const r = await mutation.mutateAsync({ data: { resumeId } });
    setResult(r);
  };

  const verdictBg = result?.verdict === "shortlisted"
    ? "from-green-500/15 to-emerald-500/10 border-green-500/30"
    : result?.verdict === "rejected"
    ? "from-destructive/15 to-red-900/10 border-destructive/30"
    : "from-amber-500/15 to-yellow-500/10 border-amber-500/30";

  const verdictColor = result?.verdict === "shortlisted" ? "text-green-400"
    : result?.verdict === "rejected" ? "text-destructive"
    : "text-amber-400";

  return (
    <div className="space-y-5">
      {!result && !mutation.isPending && (
        <div className="space-y-4">
          <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm leading-relaxed text-foreground/80">
            <p className="font-semibold mb-2 flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> The 6-Second Rule</p>
            Research shows recruiters spend just 6 seconds on initial resume review before deciding to shortlist or reject. This simulation uses AI to model exactly where their eyes go and what they think.
          </div>
          <EmptyState onRun={handleRun} icon={Eye} label="Recruiter Simulation" description="Simulate a real recruiter scanning your resume for 6 seconds and get an honest shortlist/reject verdict." />
          <div className="flex justify-center">
            <button onClick={handleRun} disabled={mutation.isPending} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2">
              <Eye className="w-4 h-4" /> Run 6-Second Simulation
            </button>
          </div>
        </div>
      )}

      {mutation.isPending && <LoadingSpinner label="Simulating recruiter eye-tracking..." />}

      {result && !mutation.isPending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Verdict banner */}
          <div className={`bg-gradient-to-r ${verdictBg} border rounded-xl p-5`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-2xl font-bold ${verdictColor}`}>{result.verdictLabel}</p>
                <p className="text-sm text-muted-foreground mt-1">{result.firstImpression}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-3xl font-bold ${getScoreClass(result.confidenceScore)}`}>{result.confidenceScore}%</div>
                <div className="text-xs text-muted-foreground">confidence</div>
              </div>
            </div>
          </div>

          {/* 6-second summary */}
          {result.sixSecondSummary && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">After 6 Seconds</p>
              {result.sixSecondSummary}
            </div>
          )}

          {/* Attention heatmap */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Attention Heatmap</p>
            <div className="space-y-2.5">
              {result.attentionMap.map((section, i) => (
                <AttentionSectionRow key={section.section} section={section} index={i} />
              ))}
            </div>
          </div>

          {/* Strengths & weaknesses */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-green-500/6 border border-green-500/15 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-400 mb-2.5 uppercase tracking-wider">What Works</p>
              <div className="space-y-1.5">
                {result.criticalStrengths.map((s) => (
                  <p key={s} className="text-xs flex items-start gap-2 text-foreground/80"><CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />{s}</p>
                ))}
              </div>
            </div>
            <div className="bg-destructive/6 border border-destructive/15 rounded-xl p-4">
              <p className="text-xs font-semibold text-destructive mb-2.5 uppercase tracking-wider">Critical Weaknesses</p>
              <div className="space-y-1.5">
                {result.criticalWeaknesses.map((w) => (
                  <p key={w} className="text-xs flex items-start gap-2 text-foreground/80"><XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />{w}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Red flags */}
          {result.redFlags.length > 0 && (
            <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">Red Flags</p>
              {result.redFlags.map((f) => (
                <p key={f} className="text-xs text-red-300/80 flex items-start gap-2 mb-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{f}</p>
              ))}
            </div>
          )}

          {/* What to fix */}
          {result.whatWouldGetThemShortlisted.length > 0 && (
            <div className="bg-primary/8 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary mb-2.5 uppercase tracking-wider">What Would Get You Shortlisted</p>
              <div className="space-y-2">
                {result.whatWouldGetThemShortlisted.map((a, i) => (
                  <p key={i} className="text-xs flex items-start gap-2 text-foreground/85">
                    <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    {a}
                  </p>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Run simulation again
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Tab 3: Benchmark ─────────────────────────────────────────────────────────

function BenchmarkTab({ resumeId }: { resumeId: number }) {
  const [jobTitle, setJobTitle] = useState("");
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const mutation = useBenchmarkResume();

  const handleRun = async () => {
    const r = await mutation.mutateAsync({ data: { resumeId, jobTitle: jobTitle || undefined } });
    setResult(r);
  };

  const tierConfig = (tier: string) => {
    const tiers: Record<string, {color: string; bg: string; icon: React.FC<{className?: string}>}> = {
      elite:         { color: 'text-purple-400',  bg: 'bg-purple-500/15 border-purple-500/30',   icon: Award },
      strong:        { color: 'text-green-400',   bg: 'bg-green-500/15 border-green-500/30',     icon: TrendingUp },
      average:       { color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30',     icon: Minus },
      below_average: { color: 'text-destructive', bg: 'bg-destructive/15 border-destructive/30', icon: TrendingDown },
    };
    return tiers[tier] ?? { color: 'text-muted-foreground', bg: 'bg-muted border-border', icon: Minus };
  }

  const impactColor = (impact: string) => impact === "high" ? "text-destructive" : impact === "medium" ? "text-amber-400" : "text-blue-400";

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="Job title for context (optional, e.g., Backend Engineer)"
          className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
        />
        <button
          onClick={handleRun}
          disabled={mutation.isPending}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          {mutation.isPending ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Benchmarking...</> : <><BarChart3 className="w-3.5 h-3.5" /> Benchmark</>}
        </button>
      </div>

      {mutation.isPending && <LoadingSpinner label="Comparing against top industry candidates..." />}

      {!result && !mutation.isPending && (
        <EmptyState onRun={handleRun} icon={BarChart3} label="Resume Benchmarking" description="AI compares your resume against thousands of top-tier candidates to give you an honest percentile ranking." />
      )}

      {result && !mutation.isPending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Percentile rank */}
          {(() => { const cfg = tierConfig(result.tier); return (
            <div className={`border rounded-xl p-5 ${cfg.bg}`}>
              <div className="flex items-center gap-5">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${cfg.color}`}>{result.percentileRank}</div>
                  <div className="text-xs text-muted-foreground">percentile</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className={`font-semibold ${cfg.color}`}>{result.tierLabel}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{result.overallGapSummary}</p>
                </div>
              </div>
              {/* Visual percentile bar */}
              <div className="mt-4">
                <div className="relative h-3 bg-gradient-to-r from-destructive/30 via-amber-500/30 to-green-500/30 rounded-full">
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md"
                    initial={{ left: "0%" }}
                    animate={{ left: `${result.percentileRank}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{ transform: `translateX(-50%) translateY(-50%)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0th</span><span>25th</span><span>50th</span><span>75th</span><span>100th</span>
                </div>
              </div>
            </div>
          );})()}

          {/* Category breakdown */}
          {result.categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">You vs Top 10% Candidates</p>
              <div className="space-y-3">
                {result.categories.map((cat) => (
                  <div key={cat.name} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className={`text-xs font-semibold ${impactColor(cat.impact)}`}>{cat.impact} impact</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">You</span>
                        <div className="flex-1"><ScoreBar value={cat.yourScore} color={getScoreColor(cat.yourScore)} /></div>
                        <span className={`text-xs font-semibold w-8 text-right ${getScoreClass(cat.yourScore)}`}>{cat.yourScore}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">Top 10%</span>
                        <div className="flex-1"><ScoreBar value={cat.topCandidateScore} color="#a855f7" /></div>
                        <span className="text-xs font-semibold w-8 text-right text-purple-400">{cat.topCandidateScore}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">Median</span>
                        <div className="flex-1"><ScoreBar value={cat.industryMedian} color="#6b7280" /></div>
                        <span className="text-xs font-semibold w-8 text-right text-muted-foreground">{cat.industryMedian}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{cat.gapDescription}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick wins */}
          {result.quickWins.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-primary mb-3 uppercase tracking-wider">Quick Wins to Climb the Rankings</p>
              <div className="space-y-2">
                {result.quickWins.map((win, i) => (
                  <div key={i} className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-0.5">{win.action}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Effort: <span className={impactColor(win.effort)}>{win.effort}</span></span>
                        <span>Impact: <span className={impactColor(win.impact)}>{win.impact}</span></span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex-shrink-0 whitespace-nowrap">{win.estimatedPercentileGain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 10% profile */}
          {result.topCandidateProfile && (
            <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wider flex items-center gap-1.5"><Star className="w-3 h-3" /> What Top 10% Looks Like</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{result.topCandidateProfile}</p>
              {result.whatTop10PercentHaveThatYouDont.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {result.whatTop10PercentHaveThatYouDont.map((item) => (
                    <p key={item} className="text-xs flex items-start gap-2 text-foreground/70"><ArrowRight className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />{item}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Tab 4: Bullet Improver ───────────────────────────────────────────────────

function BulletImproverTab({ resumeId }: { resumeId: number }) {
  const [result, setResult] = useState<ImproveBulletsResult | null>(null);
  const mutation = useImproveBullets();

  const handleRun = async () => {
    const r = await mutation.mutateAsync({ data: { resumeId } });
    setResult(r);
  };

  const scoreColor = (score: number) => score >= 80 ? "text-green-400" : score >= 60 ? "text-amber-400" : "text-muted-foreground";

  return (
    <div className="space-y-5">
      {!result && !mutation.isPending && (
        <div className="space-y-4">
          <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">
            <p className="font-semibold mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> The ATIM Formula</p>
            Every strong resume bullet follows: <span className="font-mono text-primary bg-primary/10 px-1 rounded">Action Verb</span> + <span className="font-mono text-amber-400 bg-amber-500/10 px-1 rounded">Technology/Context</span> + <span className="font-mono text-green-400 bg-green-500/10 px-1 rounded">Impact</span> + <span className="font-mono text-blue-400 bg-blue-500/10 px-1 rounded">Metrics</span>. Gemini rewrites each bullet using this formula.
          </div>
          <EmptyState onRun={handleRun} icon={Wand2} label="Bullet Point Improver" description="Gemini detects weak phrases and rewrites each bullet using the Action + Technology + Impact + Metrics formula." />
          <div className="flex justify-center">
            <button onClick={handleRun} disabled={mutation.isPending} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Improve All Bullets
            </button>
          </div>
        </div>
      )}

      {mutation.isPending && <LoadingSpinner label="Gemini is rewriting your bullets..." />}

      {result && !mutation.isPending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {result.overallAdvice && (
            <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">
              <p className="text-xs font-semibold text-primary mb-1.5 uppercase tracking-wider">Overall Advice</p>
              {result.overallAdvice}
            </div>
          )}

          {result.improvements.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">No bullet points detected in this resume. Bullets must start with •, -, *, — or –.</div>
          )}

          {result.improvements.map((imp, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 space-y-3">
                {/* Score badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Bullet {i + 1}</span>
                  <span className={`text-xs font-semibold ${scoreColor(imp.improvementScore)}`}>
                    +{imp.improvementScore}% stronger
                  </span>
                </div>

                {/* Before */}
                <div className="bg-destructive/6 border border-destructive/15 rounded-lg p-3">
                  <p className="text-xs font-semibold text-destructive mb-1.5">Before</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{imp.original}</p>
                  {imp.weaknessIdentified && (
                    <p className="text-xs text-destructive/70 mt-1.5 flex items-start gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{imp.weaknessIdentified}</p>
                  )}
                </div>

                {/* After */}
                <div className="bg-green-500/6 border border-green-500/15 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-400 mb-1.5">After</p>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">{imp.improved}</p>
                </div>

                {/* Formula breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: "action", label: "Action", color: "text-primary bg-primary/10 border-primary/20" },
                    { key: "context", label: "Technology", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                    { key: "impact", label: "Impact", color: "text-green-400 bg-green-500/10 border-green-500/20" },
                    { key: "metrics", label: "Metrics", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                  ].map(({ key, label, color }) => (
                    <div key={key} className={`border rounded-lg px-2.5 py-2 ${color}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">{label}</p>
                      <p className="text-xs leading-relaxed">{imp.formulaBreakdown[key as keyof typeof imp.formulaBreakdown]}</p>
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">{imp.explanation}</p>
              </div>
            </motion.div>
          ))}

          <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Run again
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Tab 5: Red Flag Scanner ───────────────────────────────────────────────────

const riskConfig = (risk: string) => ({
  high:   { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",   label: "High Risk",   barColor: "#ef4444" },
  medium: { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30", label: "Medium Risk", barColor: "#f59e0b" },
  low:    { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30", label: "Low Risk",    barColor: "#22c55e" },
}[risk] ?? { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "Unknown", barColor: "#6b7280" });

const severityConfig = (sev: string) => ({
  critical: { icon: XCircle,      color: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/25",   label: "Critical" },
  warning:  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", label: "Warning"  },
  info:     { icon: Minus,         color: "text-blue-400",  bg: "bg-blue-500/10",  border: "border-blue-500/25",  label: "Info"     },
}[sev] ?? { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "Note" });

function RedFlagCard({ flag, index }: { flag: RedFlagsResult["flags"][number]; index: number }) {
  const [open, setOpen] = useState(false);
  const sev = severityConfig(flag.severity);
  const SevIcon = sev.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className={`rounded-xl border overflow-hidden ${sev.border}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <SevIcon className={`w-4 h-4 flex-shrink-0 ${sev.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{flag.title}</p>
          <p className="text-xs text-muted-foreground truncate">{flag.location}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sev.bg} ${sev.color} flex-shrink-0`}>{sev.label}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className={`px-4 pb-4 border-t ${sev.border} pt-3 space-y-2 ${sev.bg}`}>
              <p className="text-xs text-foreground/80 leading-relaxed">{flag.description}</p>
              <div className="flex items-start gap-2 bg-background/50 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-300">{flag.howToFix}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RedFlagScannerTab({ resumeId }: { resumeId: number }) {
  const [result, setResult] = useState<RedFlagsResult | null>(null);
  const mutation = useScanRedFlags();

  const handleRun = async () => {
    const r = await mutation.mutateAsync({ data: { resumeId } });
    setResult(r);
  };

  if (mutation.isPending) return <LoadingSpinner label="Scanning for red flags…" />;

  if (!result) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <ScanSearch className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <p className="font-semibold mb-1">Red Flag Scanner</p>
        <p className="text-sm text-muted-foreground max-w-xs">Ruthlessly identifies every issue that causes immediate disqualification — no sugar-coating.</p>
      </div>
      <button onClick={handleRun} className="mt-2 px-6 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-sm rounded-xl transition-all flex items-center gap-2">
        <Flame className="w-4 h-4" /> Run Red Flag Scan
      </button>
    </div>
  );

  const risk = riskConfig(result.overallRisk);
  const criticals = result.flags.filter(f => f.severity === "critical");
  const warnings = result.flags.filter(f => f.severity === "warning");
  const infos = result.flags.filter(f => f.severity === "info");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Risk header */}
      <div className={`rounded-2xl border p-5 ${risk.bg} ${risk.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Overall Risk Level</p>
            <p className={`text-2xl font-bold ${risk.color}`}>{risk.label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
            <p className={`text-4xl font-bold ${risk.color}`}>{result.riskScore}</p>
            <p className="text-xs text-muted-foreground">/100</p>
          </div>
        </div>
        <div className="h-2 bg-black/20 rounded-full overflow-hidden mb-3">
          <motion.div className="h-full rounded-full" style={{ backgroundColor: risk.barColor }}
            initial={{ width: 0 }} animate={{ width: `${result.riskScore}%` }} transition={{ duration: 1, ease: "easeOut" }} />
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{result.summary}</p>
      </div>

      {/* Flag counts */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Critical", count: criticals.length, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" },
          { label: "Warnings", count: warnings.length,  color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
          { label: "Info",     count: infos.length,     color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg} ${s.border}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Disqualification risk */}
      {result.disqualificationRisk && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 flex items-start gap-3">
          <TriangleAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80 italic">{result.disqualificationRisk}</p>
        </div>
      )}

      {/* All flags */}
      {result.flags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Flags ({result.flags.length})</p>
          <div className="space-y-2">
            {result.flags.map((flag, i) => <RedFlagCard key={i} flag={flag} index={i} />)}
          </div>
        </div>
      )}

      {/* Buzzwords */}
      {result.buzzwordsFound.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Buzzwords to Remove</p>
          <div className="flex flex-wrap gap-2">
            {result.buzzwordsFound.map(w => (
              <span key={w} className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-full">✗ {w}</span>
            ))}
          </div>
        </div>
      )}

      {/* ATS issues */}
      {result.atsFormatIssues.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">ATS Formatting Issues</p>
          <div className="space-y-1.5">
            {result.atsFormatIssues.map((issue, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {issue}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick fixes */}
      {result.quickFixes.length > 0 && (
        <div className="bg-green-500/6 border border-green-500/15 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Top Quick Fixes</p>
          <div className="space-y-1.5">
            {result.quickFixes.map((fix, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" /> {fix}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Scan again</button>
    </motion.div>
  );
}

// ── Tab 6: Padding vs Achievement Detector ───────────────────────────────────

const bulletTypeConfig = (type: string) => ({
  achievement: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25", label: "Achievement", icon: BadgeCheck },
  padding:     { color: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/25",   label: "Padding",     icon: CircleSlash },
  mixed:       { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", label: "Mixed",       icon: AlertTriangle },
}[type] ?? { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", label: "Unknown", icon: Minus });

function BulletRow({ bullet, index }: { bullet: PaddingDetectorResult["bullets"][number]; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = bulletTypeConfig(bullet.type);
  const BIcon = cfg.icon;
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
      className={`rounded-xl border overflow-hidden ${cfg.border}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <BIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
        <p className="flex-1 text-xs text-foreground/80 leading-relaxed line-clamp-2">{bullet.text}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold ${bullet.score >= 60 ? "text-green-400" : bullet.score >= 35 ? "text-amber-400" : "text-red-400"}`}>{bullet.score}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className={`px-4 pb-3 border-t ${cfg.border} pt-3 space-y-2 ${cfg.bg}`}>
              <p className="text-xs text-foreground/80">{bullet.reason}</p>
              <div className="flex flex-wrap gap-1.5">
                {bullet.signals.map(s => (
                  <span key={s} className="text-xs bg-background/50 border border-border px-2 py-0.5 rounded text-muted-foreground">{s.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PaddingDetectorTab({ resumeId }: { resumeId: number }) {
  const [result, setResult] = useState<PaddingDetectorResult | null>(null);
  const mutation = useDetectPadding();

  const handleRun = async () => {
    const r = await mutation.mutateAsync({ data: { resumeId } });
    setResult(r);
  };

  if (mutation.isPending) return <LoadingSpinner label="Analyzing bullet quality…" />;

  if (!result) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <ScanSearch className="w-8 h-8 text-amber-400" />
      </div>
      <div>
        <p className="font-semibold mb-1">Padding vs. Achievement Detector</p>
        <p className="text-sm text-muted-foreground max-w-xs">Scores every bullet as a genuine achievement or filler padding — calls out the bluffing.</p>
      </div>
      <button onClick={handleRun} className="mt-2 px-6 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-semibold text-sm rounded-xl transition-all flex items-center gap-2">
        <Sparkles className="w-4 h-4" /> Detect Padding
      </button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Donut summary */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Bullet Quality Breakdown</p>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3"
                strokeDasharray={`${result.achievementRatio} ${100 - result.achievementRatio}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-lg font-bold text-green-400">{result.achievementRatio}%</p>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">"{result.verdict}"</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-500/10 border border-green-500/25 rounded-lg p-2">
                <p className="text-lg font-bold text-green-400">{result.achievementCount}</p>
                <p className="text-xs text-muted-foreground">Achievements</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-2">
                <p className="text-lg font-bold text-red-400">{result.paddingCount}</p>
                <p className="text-xs text-muted-foreground">Padding</p>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-2">
                <p className="text-lg font-bold text-foreground">{result.bullets.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top achievements */}
      {result.topAchievements.length > 0 && (
        <div className="bg-green-500/6 border border-green-500/15 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Your Best Bullets</p>
          <div className="space-y-1.5">
            {result.topAchievements.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <BadgeCheck className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" /> {a}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worst padding */}
      {result.worstPadding.length > 0 && (
        <div className="bg-red-500/6 border border-red-500/15 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Worst Padding to Fix First</p>
          <div className="space-y-1.5">
            {result.worstPadding.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <CircleSlash className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" /> {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All bullets */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Bullets Scored</p>
        <div className="space-y-2">
          {result.bullets.map((b, i) => <BulletRow key={i} bullet={b} index={i} />)}
        </div>
      </div>

      {/* Overall advice */}
      {result.overallAdvice && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coach's Verdict</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{result.overallAdvice}</p>
        </div>
      )}

      <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Run again</button>
    </motion.div>
  );
}

// ── Tab 7: Career Trajectory Predictor ───────────────────────────────────────

const trajectoryColors = ["#6366f1", "#8b5cf6", "#a855f7"];
const trajectoryYearLabels: Record<number, string> = { 1: "1 Year", 3: "3 Years", 5: "5 Years" };

function CareerTrajectoryTab({ resumeId }: { resumeId: number }) {
  const [result, setResult] = useState<CareerTrajectoryResult | null>(null);
  const [activeYear, setActiveYear] = useState<number>(1);
  const mutation = usePredictCareerTrajectory();

  const handleRun = async () => {
    const r = await mutation.mutateAsync({ data: { resumeId } });
    setResult(r);
    if (r.trajectories.length > 0) setActiveYear(r.trajectories[0].year);
  };

  if (mutation.isPending) return <LoadingSpinner label="Mapping your career trajectory…" />;

  if (!result) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <Route className="w-8 h-8 text-violet-400" />
      </div>
      <div>
        <p className="font-semibold mb-1">Career Trajectory Predictor</p>
        <p className="text-sm text-muted-foreground max-w-xs">Maps realistic 1, 3, and 5-year career paths with specific skills needed for each milestone.</p>
      </div>
      <button onClick={handleRun} className="mt-2 px-6 py-2.5 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-400 font-semibold text-sm rounded-xl transition-all flex items-center gap-2">
        <Rocket className="w-4 h-4" /> Predict My Trajectory
      </button>
    </div>
  );

  const active = result.trajectories.find(t => t.year === activeYear) ?? result.trajectories[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Current level */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Level</p>
            <p className="text-xl font-bold text-foreground">{result.currentLevel}</p>
          </div>
          <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
        </div>
        {result.currentStrengths.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {result.currentStrengths.map(s => (
              <span key={s} className="text-xs bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Year selector */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trajectory Timeline</p>
        <div className="flex gap-2">
          {result.trajectories.map((t, i) => (
            <button key={t.year} onClick={() => setActiveYear(t.year)}
              className={cn(
                "flex-1 py-3 rounded-xl border text-sm font-semibold transition-all",
                activeYear === t.year
                  ? "border-2 text-white"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
              style={activeYear === t.year ? { borderColor: trajectoryColors[i], background: `${trajectoryColors[i]}18` } : {}}
            >
              <span style={activeYear === t.year ? { color: trajectoryColors[i] } : {}}>
                {trajectoryYearLabels[t.year] ?? `${t.year}yr`}
              </span>
              <p className={`text-xs mt-0.5 ${activeYear === t.year ? "" : "text-muted-foreground"}`}>{t.probability}% likely</p>
            </button>
          ))}
        </div>
      </div>

      {/* Active trajectory detail */}
      {active && (
        <motion.div key={activeYear} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Job titles + salary */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Likely Roles</p>
                <div className="space-y-1">
                  {active.jobTitles.map((title, i) => (
                    <div key={title} className="flex items-center gap-2">
                      {i === 0 ? <Star className="w-3.5 h-3.5 text-amber-400" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      <p className={`text-sm font-${i === 0 ? "semibold" : "normal"} text-foreground`}>{title}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground mb-1">Salary Range</p>
                <p className="text-sm font-bold text-green-400">{active.salaryRange}</p>
              </div>
            </div>

            {/* Readiness bar */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-xs text-muted-foreground">Readiness today</p>
                <p className={`text-xs font-bold ${active.readinessScore >= 60 ? "text-green-400" : active.readinessScore >= 35 ? "text-amber-400" : "text-red-400"}`}>{active.readinessScore}%</p>
              </div>
              <ScoreBar value={active.readinessScore} color={active.readinessScore >= 60 ? "#22c55e" : active.readinessScore >= 35 ? "#f59e0b" : "#ef4444"} />
            </div>

            {/* Key milestone */}
            <div className="mt-4 flex items-start gap-2 bg-primary/6 border border-primary/15 rounded-lg px-3 py-2">
              <Target className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80"><span className="font-semibold text-primary">Key milestone:</span> {active.keyMilestone}</p>
            </div>
          </div>

          {/* Skills to build */}
          {active.requiredSkills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills to Build for This Level</p>
              <div className="space-y-2">
                {active.requiredSkills.map((skill, i) => (
                  <motion.div key={skill.skill} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${skill.urgency === "high" ? "bg-red-400" : skill.urgency === "medium" ? "bg-amber-400" : "bg-blue-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{skill.skill}</p>
                      <p className="text-xs text-muted-foreground truncate">{skill.whyNeeded}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">{skill.timeToLearn}</p>
                      <p className={`text-xs font-medium capitalize ${skill.urgency === "high" ? "text-red-400" : skill.urgency === "medium" ? "text-amber-400" : "text-blue-400"}`}>{skill.urgency}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Alternative pathways */}
      {result.alternativePathways.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alternative Career Pivots</p>
          <div className="space-y-2">
            {result.alternativePathways.map((p, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-foreground">{p.path}</p>
                  <span className="text-xs text-violet-400 font-medium">{p.probability}% fit</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{p.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{p.timeToTransition} ·</span>
                  {p.bridgeSkills.map(s => (
                    <span key={s} className="text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Career risk + immediate actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        {result.biggestCareerRisk && (
          <div className="bg-red-500/6 border border-red-500/15 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Biggest Risk</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{result.biggestCareerRisk}</p>
          </div>
        )}
        {result.immediateActions.length > 0 && (
          <div className="bg-green-500/6 border border-green-500/15 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Do This Now</p>
            <div className="space-y-1.5">
              {result.immediateActions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" /> {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Predict again</button>
    </motion.div>
  );
}

// ── Main Tools Page ──────────────────────────────────────────────────────────

const TABS = [
  { id: "role",       label: "Role Analyzer",     icon: Briefcase,  shortLabel: "Role" },
  { id: "recruiter",  label: "Recruiter Sim",      icon: Eye,        shortLabel: "Recruiter" },
  { id: "benchmark",  label: "Benchmarking",       icon: BarChart3,  shortLabel: "Benchmark" },
  { id: "bullets",    label: "Bullet Improver",    icon: Zap,        shortLabel: "Bullets" },
  { id: "redflags",   label: "Red Flag Scanner",   icon: ScanSearch, shortLabel: "Red Flags" },
  { id: "padding",    label: "Padding Detector",   icon: Flame,      shortLabel: "Padding" },
  { id: "trajectory", label: "Career Trajectory",  icon: Route,      shortLabel: "Trajectory" },
] as const;

type TabId = typeof TABS[number]["id"];

interface ToolsProps {
  resumeId: number | null;
  onNavigateAnalyze: () => void;
}

export default function Tools({ resumeId, onNavigateAnalyze }: ToolsProps) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("role");

  if (!resumeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-primary" />
          </div>
          <p className="font-semibold mb-2">No resume analyzed yet</p>
          <p className="text-sm text-muted-foreground mb-5">Upload and analyze your resume first to unlock the Power Tools suite.</p>
          <button onClick={() => navigate("/")} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto">
            <ArrowRight className="w-4 h-4" /> Analyze Resume First
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> Power Tools</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onNavigateAnalyze} className="text-sm text-muted-foreground border border-border hover:text-foreground px-3 py-1.5 rounded-lg transition-colors">
            Analysis
          </button>
          <button onClick={() => navigate("/improve")} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Wand2 className="w-3.5 h-3.5" /> AI Improve
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Resume Power Tools</h1>
          <p className="text-sm text-muted-foreground">7 AI-powered modules to deeply analyze, benchmark, and optimize your resume.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6">
          {TABS.map(({ id, label, icon: Icon, shortLabel }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all",
                activeTab === id
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:block">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {activeTab === "role"       && <RoleAnalyzerTab resumeId={resumeId} />}
            {activeTab === "recruiter"  && <RecruiterSimTab resumeId={resumeId} />}
            {activeTab === "benchmark"  && <BenchmarkTab resumeId={resumeId} />}
            {activeTab === "bullets"    && <BulletImproverTab resumeId={resumeId} />}
            {activeTab === "redflags"   && <RedFlagScannerTab resumeId={resumeId} />}
            {activeTab === "padding"    && <PaddingDetectorTab resumeId={resumeId} />}
            {activeTab === "trajectory" && <CareerTrajectoryTab resumeId={resumeId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
