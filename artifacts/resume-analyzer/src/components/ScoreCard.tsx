import { motion } from "framer-motion";
import { getScoreColor, getScoreClass } from "@/lib/utils";

interface ScoreCardProps {
  label: string;
  score: number;
  description?: string;
  delay?: number;
  icon?: React.ReactNode;
}

export default function ScoreCard({ label, score, description, delay = 0, icon }: ScoreCardProps) {
  const color = getScoreColor(score);
  const scoreClass = getScoreClass(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <span className={`text-2xl font-bold ${scoreClass}`}>{score}</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
    </motion.div>
  );
}
