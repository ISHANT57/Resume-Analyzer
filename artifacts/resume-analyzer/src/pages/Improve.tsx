import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Wand2, ArrowRight, Sparkles, CheckCircle } from "lucide-react";
import { useImproveResume } from "@workspace/api-client-react";

interface ImproveProps {
  resumeId: number | null;
  analysisId: number | null;
}

interface ImprovementResult {
  improvedBullets: Array<{ original: string; improved: string }>;
  improvedSummary?: string;
  additionalSuggestions: string[];
}

export default function Improve({ resumeId, analysisId }: ImproveProps) {
  const [, navigate] = useLocation();
  const [result, setResult] = useState<ImprovementResult | null>(null);
  const improveMutation = useImproveResume();

  const handleImprove = async () => {
    if (!resumeId || !analysisId) return;
    try {
      const data = await improveMutation.mutateAsync({ data: { resumeId, analysisId } });
      setResult(data as ImprovementResult);
    } catch { /* ignore */ }
  };

  if (!resumeId || !analysisId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No analysis found. Please analyze a resume first.</p>
          <button onClick={() => navigate("/")} className="text-primary hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur z-10">
        <button onClick={() => navigate("/analyze")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back to Analysis
        </button>
        <span className="font-semibold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> AI Resume Improvements</span>
        <div />
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {!result && !improveMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-3">AI Resume Enhancement</h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Gemini AI will analyze your resume and rewrite weak bullet points with powerful action verbs and quantified achievements.
            </p>
            <motion.button
              onClick={handleImprove}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold text-base flex items-center gap-2 mx-auto hover:bg-primary/90 transition-colors"
            >
              <Wand2 className="w-5 h-5" /> Generate Improvements
            </motion.button>
          </motion.div>
        )}

        {improveMutation.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-2">Analyzing your resume...</h2>
            <p className="text-muted-foreground text-sm">Gemini AI is crafting personalized improvements</p>
          </motion.div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {/* Improved Bullets */}
              {result.improvedBullets.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-primary" /> Rewritten Bullet Points
                  </h2>
                  <div className="space-y-4">
                    {result.improvedBullets.map((b, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="grid lg:grid-cols-2 gap-0 rounded-xl overflow-hidden border border-border"
                      >
                        {/* Original */}
                        <div className="p-5 bg-destructive/5 border-r border-border">
                          <p className="text-xs font-semibold text-destructive/80 uppercase tracking-wider mb-2">Original</p>
                          <p className="text-sm text-foreground/70 leading-relaxed">{b.original}</p>
                        </div>
                        {/* Improved */}
                        <div className="p-5 bg-green-500/5 relative">
                          <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Improved
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">{b.improved}</p>
                          <ArrowRight className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-primary bg-background rounded-full p-0.5 hidden lg:block" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improved Summary */}
              {result.improvedSummary && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl p-6">
                  <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Improved Professional Summary</h2>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm leading-relaxed text-foreground">{result.improvedSummary}</p>
                  </div>
                </motion.div>
              )}

              {/* Additional Suggestions */}
              {result.additionalSuggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-xl p-6">
                  <h2 className="text-base font-semibold mb-4">Additional Recommendations</h2>
                  <div className="space-y-2.5">
                    {result.additionalSuggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground/90">{s}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3 pt-4">
                <button onClick={handleImprove} className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors">
                  <Wand2 className="w-4 h-4" /> Regenerate
                </button>
                <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                  Analyze Another Resume
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
