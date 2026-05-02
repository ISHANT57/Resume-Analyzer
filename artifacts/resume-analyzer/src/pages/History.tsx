import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChevronLeft, FileText, TrendingUp, Award, BarChart2 } from "lucide-react";
import { useGetHistory, useGetHistoryStats } from "@workspace/api-client-react";
import { getScoreClass, getScoreColor, formatDate } from "@/lib/utils";

export default function History() {
  const [, navigate] = useLocation();
  const historyQuery = useGetHistory({ limit: 20 }, { query: { queryKey: ["history"] } });
  const statsQuery = useGetHistoryStats({ query: { queryKey: ["history-stats"] } });

  const history = historyQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur z-10">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="font-semibold text-sm">Analysis History</span>
        <div />
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: BarChart2, label: "Total Analyses", value: stats.totalAnalyses, suffix: "" },
              { icon: TrendingUp, label: "Average Score", value: stats.averageScore, suffix: "/100" },
              { icon: Award, label: "Best Score", value: stats.bestScore, suffix: "/100" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <div className={`text-3xl font-bold ${i > 0 ? getScoreClass(item.value as number) : "text-foreground"}`}>
                  {item.value}{item.suffix}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Score Trend Chart */}
        {stats && stats.trend.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-6"
          >
            <h2 className="text-base font-semibold mb-5">Score Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.trend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 30% 18%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(215 25% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(215 25% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(217 30% 18%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(210 40% 96%)" }}
                  itemStyle={{ color: "hsl(252 95% 67%)" }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(252 95% 67%)"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(252 95% 67%)", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* History Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Past Analyses</h2>
          </div>
          {historyQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No analyses yet. Upload a resume to get started.</p>
              <button onClick={() => navigate("/")} className="mt-4 text-primary text-sm hover:underline">Analyze a resume</button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.filename ?? "Resume"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center hidden sm:block">
                      <div className="text-xs text-muted-foreground mb-0.5">Content</div>
                      <div className={`text-sm font-semibold ${getScoreClass(entry.contentScore)}`}>{entry.contentScore}</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-xs text-muted-foreground mb-0.5">ATS</div>
                      <div className={`text-sm font-semibold ${getScoreClass(entry.atsScore)}`}>{entry.atsScore}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">Overall</div>
                      <div className="text-xl font-bold" style={{ color: getScoreColor(entry.overallScore) }}>{entry.overallScore}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="text-center">
          <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors">
            Analyze Another Resume
          </button>
        </div>
      </div>
    </div>
  );
}
