import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { EvalResult } from '../services/evaluator';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface ResultCardProps {
  result: EvalResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const isError = result.status === 'error';
  const score = result.score;
  const scoreColor = isError 
    ? 'text-rose-500' 
    : score >= 4 
      ? 'text-emerald-400' 
      : score >= 3 
        ? 'text-amber-400' 
        : 'text-rose-500';

  const getScoreBg = () => {
    if (isError) return 'bg-rose-500/10 border-rose-500/20';
    if (score >= 4) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 3) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-rose-500/10 border-rose-500/20';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0c0c0e] border border-zinc-800/40 rounded-2xl overflow-hidden mb-4 shadow-xl hover:border-zinc-700/50 transition-all group/card"
    >
      <div 
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-all group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-5">
          <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all bg-gradient-to-br shadow-inner", getScoreBg())}>
            {isError ? (
              <AlertCircle className="w-5 h-5 text-rose-500" />
            ) : (
              <CheckCircle className={cn("w-5 h-5", scoreColor)} />
            )}
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-[13px] tracking-tight group-hover:text-white transition-colors">{result.metricName}</h3>
            {!isError && (
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.1em] mt-0.5">
                {score >= 4 ? 'Exceptional' : score >= 3 ? 'Acceptable' : 'Suboptimal'}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          {!isError && (
            <div className="flex flex-col items-end">
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-2xl font-mono font-black italic tracking-tighter leading-none transition-all", scoreColor)}>
                  {score.toFixed(1)}
                </span>
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Mark</span>
              </div>
              <div className="w-20 h-1 bg-zinc-900 rounded-full mt-2 overflow-hidden border border-zinc-800/20">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${score * 20}%` }}
                   className={cn("h-full rounded-full transition-all duration-1000 ease-out", isError ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : score >= 4 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : score >= 3 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]')}
                />
              </div>
            </div>
          )}
          <div className="p-2 rounded-lg bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-zinc-800/20 bg-zinc-900/10">
              {isError ? (
                <div className="text-rose-400 text-xs font-mono mt-4 bg-rose-500/5 p-4 rounded-lg border border-rose-500/10">
                  <span className="font-bold uppercase tracking-widest text-[9px] block mb-2 text-rose-500/60">Execution Error</span>
                  {result.errorMessage}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-[1px] flex-1 bg-zinc-800" />
                    <h4 className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Evaluation Logic Breakdown</h4>
                    <div className="h-[1px] flex-1 bg-zinc-800" />
                  </div>
                  <div className="markdown-body text-[11px] font-mono bg-zinc-950/80 border border-zinc-800/50 p-5 rounded-lg leading-relaxed text-zinc-400 prose prose-invert prose-xs max-w-none shadow-inner">
                    <Markdown>{result.reasoning}</Markdown>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
