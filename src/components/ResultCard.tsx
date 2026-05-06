import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { EvalResult } from '../services/evaluator';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface ResultCardProps {
  result: EvalResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const [expanded, setExpanded] = useState(true);
  
  const isError = result.status === 'error';
  const scoreColor = isError 
    ? 'text-red-500' 
    : result.score >= 8 
      ? 'text-green-500' 
      : result.score >= 5 
        ? 'text-yellow-500' 
        : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-950 border border-zinc-800/50 rounded-xl overflow-hidden mb-4 shadow-sm"
    >
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-900 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {isError ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle className={cn("w-5 h-5", scoreColor)} />
          )}
          <h3 className="font-semibold text-zinc-200">{result.metricName}</h3>
        </div>
        
        <div className="flex items-center gap-4">
          {!isError && (
            <div className="flex items-end gap-1">
              <span className={cn("text-2xl font-mono font-bold leading-none tracking-tight", scoreColor)}>
                {result.score}
              </span>
              <span className="text-zinc-500 text-sm mb-[2px]">/ 10</span>
            </div>
          )}
          <button className="text-zinc-500 hover:text-zinc-300">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 pt-0 border-t border-zinc-800/50 mt-2">
          {isError ? (
            <div className="text-red-400 text-sm font-mono mt-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
              Error: {result.errorMessage}
            </div>
          ) : (
            <div className="mt-4">
              <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Evaluation Reasoning</h4>
              <div className="markdown-body text-sm font-mono bg-zinc-900 border-zinc-800 p-5 rounded-xl border leading-relaxed text-zinc-400">
                <Markdown>{result.reasoning}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
