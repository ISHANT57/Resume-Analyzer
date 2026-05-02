import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Zap, Shield, Target, ChevronRight, CheckCircle, PlayCircle } from "lucide-react";
import { useUploadResume, useAnalyzeResume } from "@workspace/api-client-react";

const DEMO_RESUMES = [
  {
    name: "Ishant Bhoyar",
    role: "Full Stack Developer & AI Engineer",
    file: "ishant-bhoyar.pdf",
    tags: ["React", "Node.js", "RAG", "PostgreSQL"],
    gpa: "7.94",
    university: "Sitare University, Lucknow",
  },
];

interface HomeProps {
  onAnalysisComplete: (resumeId: number, analysis: unknown) => void;
}

export default function Home({ onAnalysisComplete }: HomeProps) {
  const [, navigate] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [step, setStep] = useState<"idle" | "uploading" | "analyzing" | "done">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadResume();
  const analyzeMutation = useAnalyzeResume();

  const handleFile = useCallback((f: File) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
    if (!allowed.includes(f.type)) {
      setUploadError("Only PDF and DOCX files are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setUploadError("File must be under 10MB.");
      return;
    }
    setUploadError("");
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

  const handleLoadDemo = useCallback(async (demo: typeof DEMO_RESUMES[number]) => {
    setLoadingDemo(demo.file);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/demo/${demo.file}`);
      const blob = await res.blob();
      const f = new File([blob], demo.file, { type: "application/pdf" });
      handleFile(f);
    } catch {
      setUploadError("Failed to load demo resume. Please try again.");
    } finally {
      setLoadingDemo(null);
    }
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!file) return;
    setUploadError("");
    try {
      setStep("uploading");
      const uploadResult = await uploadMutation.mutateAsync({ data: { file } });
      setStep("analyzing");
      const analysisResult = await analyzeMutation.mutateAsync({ data: { resumeId: uploadResult.resumeId } });
      setStep("done");
      onAnalysisComplete(uploadResult.resumeId, analysisResult);
      setTimeout(() => navigate("/analyze"), 400);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("idle");
    }
  };

  const features = [
    { icon: Zap, title: "Instant ATS Score", desc: "Know exactly how applicant tracking systems score your resume" },
    { icon: Shield, title: "Section Analysis", desc: "Detailed breakdown of every resume section with fix suggestions" },
    { icon: Target, title: "AI Improvements", desc: "Gemini AI rewrites weak bullets into compelling achievements" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">ResumeAI</span>
        </div>
        <button
          onClick={() => navigate("/history")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          View History <ChevronRight className="w-3 h-3" />
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
            <Zap className="w-3 h-3" /> AI-Powered Resume Analysis
          </div>
          <h1 className="text-5xl font-bold mb-4 leading-tight">
            Get your resume{" "}
            <span className="gradient-text">ATS-ready</span>
            <br />in seconds
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Upload your resume and receive a detailed analysis with scores, issue detection, and AI-powered improvements — just like having a career coach in your pocket.
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="card-glow bg-card rounded-2xl p-8 mb-8"
        >
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragging ? "dropzone-active" : "border-border hover:border-primary/40 hover:bg-primary/3"
            } ${file ? "cursor-default" : ""}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — ready to analyze</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  >
                    Remove file
                  </button>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                    <Upload className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Drop your resume here</p>
                    <p className="text-sm text-muted-foreground">or click to browse — PDF or DOCX, up to 10MB</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {uploadError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-destructive text-sm mt-3 text-center">
              {uploadError}
            </motion.p>
          )}

          {/* Job Description (optional) */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Job Description <span className="text-muted-foreground/60 font-normal">(optional — for tailoring score)</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description to get a tailoring score and keyword analysis..."
              rows={4}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* CTA */}
          <motion.button
            onClick={handleAnalyze}
            disabled={!file || step !== "idle"}
            whileHover={{ scale: file && step === "idle" ? 1.01 : 1 }}
            whileTap={{ scale: file && step === "idle" ? 0.99 : 1 }}
            className="w-full mt-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            {step === "idle" && <><Zap className="w-4 h-4" /> Analyze My Resume</>}
            {step === "uploading" && <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>}
            {step === "analyzing" && <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing with AI...</>}
            {step === "done" && <><CheckCircle className="w-4 h-4" /> Complete!</>}
          </motion.button>
        </motion.div>

        {/* Demo Resumes */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Or try a demo resume</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <div className="grid gap-3">
            {DEMO_RESUMES.map((demo) => (
              <motion.div
                key={demo.file}
                whileHover={{ scale: 1.005 }}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-foreground">{demo.name}</p>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <p className="text-xs text-muted-foreground truncate">{demo.university}</p>
                  </div>
                  <p className="text-xs text-primary/80 font-medium mb-1.5">{demo.role}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {demo.tags.map(t => (
                      <span key={t} className="text-xs bg-muted border border-border px-2 py-0.5 rounded-md text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleLoadDemo(demo)}
                  disabled={loadingDemo === demo.file || !!file}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {loadingDemo === demo.file
                    ? <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    : <PlayCircle className="w-3.5 h-3.5" />}
                  {loadingDemo === demo.file ? "Loading…" : "Try Demo"}
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-3 gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold text-sm mb-1">{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
