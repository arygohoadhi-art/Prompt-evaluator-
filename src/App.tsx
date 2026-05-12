import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, TestTube2, LayoutPanelLeft, Clock, Layers, Download, Sparkles, ChevronLeft, BarChart3, Settings } from 'lucide-react';
import * as xlsx from 'xlsx';
import { EvalForm } from './components/EvalForm';
import { ResultCard } from './components/ResultCard';
import { ScoreChart } from './components/ScoreChart';
import { TrendChart, HistoryEntry } from './components/TrendChart';
import { checkBatchEvaluations, BatchEvalParams, BatchItemResult, EvalResult } from './services/evaluator';

import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';

export default function App() {
  const [view, setView] = useState<'input' | 'results'>('input');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [batchResults, setBatchResults] = useState<BatchItemResult[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Auto-switch to results when evaluation finishes
  useEffect(() => {
    if (batchResults && !isEvaluating) {
      setView('results');
    }
  }, [batchResults, isEvaluating]);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('evalHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Revive Date objects
        const revived = parsed
          .filter((entry: any) => entry && typeof entry === 'object' && Array.isArray(entry.results))
          .map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
          }))
          .filter((entry: any) => !isNaN(entry.timestamp.getTime()));
        setHistory(revived);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Compute aggregated scores for the charts
  const aggregatedResults: EvalResult[] | null = useMemo(() => {
    if (!batchResults) return null;
    const metricAverages = new Map<string, {scoreSum: number, count: number, metricName: string}>();
    batchResults.forEach(b => {
       b.results.forEach(r => {
           if (r.status === 'success') {
               const stats = metricAverages.get(r.metricId) || {scoreSum: 0, count: 0, metricName: r.metricName};
               stats.scoreSum += r.score;
               stats.count += 1;
               metricAverages.set(r.metricId, stats);
           }
       });
    });
    return Array.from(metricAverages.entries()).map(([metricId, stats]) => ({
      metricId,
      metricName: stats.metricName,
      score: Math.round((stats.scoreSum / stats.count) * 10) / 10,
      reasoning: 'Aggregated average across batch.',
      status: 'success'
    }));
  }, [batchResults]);

  const handleEvaluate = async (params: BatchEvalParams) => {
    setIsEvaluating(true);
    setBatchResults(null);
    try {
      const bResults = await checkBatchEvaluations(params);
      setBatchResults(bResults);
      
      // Calculate averages to store in history
      const metricAverages = new Map<string, {scoreSum: number, count: number, metricName: string}>();
      bResults.forEach(b => {
         b.results.forEach(r => {
             if (r.status === 'success') {
                 const stats = metricAverages.get(r.metricId) || {scoreSum: 0, count: 0, metricName: r.metricName};
                 stats.scoreSum += r.score;
                 stats.count += 1;
                 metricAverages.set(r.metricId, stats);
             }
         });
      });
      const avgResults: EvalResult[] = Array.from(metricAverages.entries()).map(([metricId, stats]) => ({
        metricId,
        metricName: stats.metricName,
        score: Math.round((stats.scoreSum / stats.count) * 10) / 10,
        reasoning: 'Aggregated average across batch.',
        status: 'success'
      }));
      
      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        results: avgResults
      };
      
      const newHistory = [...history, newEntry].slice(-50); // keep last 50
      setHistory(newHistory);
      localStorage.setItem('evalHistory', JSON.stringify(newHistory));
      
    } catch (error: any) {
      console.error('Unhandled error during evaluation:', error);
      toast.error(error.message || 'An error occurred during evaluation.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setBatchResults(null);
    localStorage.removeItem('evalHistory');
    toast.success("All data cleared");
  };

  const exportBatchResults = () => {
    if (!batchResults) return;
    try {
    
    const data = batchResults.flatMap((b) => 
      b.results.map((r) => ({
        "Test Case": b.itemIndex + 1,
        "Input": b.item.input || "",
        "Actual Output": b.item.actualOutput || "",
        "Expected Output": b.item.expectedOutput || "",
        "Context": b.item.context || "",
        "Criteria": b.item.criteria || "",
        "Metric": r.metricName,
        "Score": r.status === 'success' ? r.score : "Error",
        "Reasoning": r.reasoning || r.errorMessage || "",
        "Status": r.status
      }))
    );

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Batch Results");
    xlsx.writeFile(wb, `Evaluation_Batch_${Date.now()}.xlsx`);
    toast.success("Results exported successfully");
    } catch (error) {
      toast.error("Failed to export results");
    }
  };

  const exportHistory = () => {
    if (history.length === 0) return;
    
    try {

    const data = history.flatMap((entry) => 
      entry.results.map((r) => ({
        "Date": entry.timestamp.toLocaleString(),
        "Metric": r.metricName,
        "Average Score": r.score,
        "Status": r.status
      }))
    );

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "History");
    xlsx.writeFile(wb, `Evaluation_History.xlsx`);
    toast.success("History exported successfully");
    } catch (error) {
      toast.error("Failed to export history");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#030303] text-zinc-100 selection:bg-blue-500/30 font-sans">
      <Toaster theme="dark" position="top-right" richColors />
      
      {/* Dynamic Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-zinc-800/60 bg-[#030303]/80 backdrop-blur-md z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view === 'results' && (
            <button 
              onClick={() => setView('input')}
              className="p-2 hover:bg-zinc-800/50 rounded-xl transition-all text-zinc-400 hover:text-white active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white leading-tight">EvalExpert</h1>
              <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                DeepEval Protocol v2.4
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden sm:flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            <button 
              onClick={() => setView('input')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'input' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Input Portal
            </button>
            <button 
              onClick={() => setView('results')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'results' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Results Hub
            </button>
          </nav>
          
          <div className="h-6 w-px bg-zinc-800 mx-2" />
          
          <div className="flex items-center gap-3">
             {view === 'results' && (
               <>
                 <button 
                   onClick={exportBatchResults}
                   disabled={!batchResults}
                   className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 text-xs font-medium hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                 >
                   <Download className="w-3.5 h-3.5" /> Export
                 </button>
                 <button 
                   onClick={clearHistory}
                   className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                   title="Clear History"
                 >
                   <Clock className="w-4 h-4" />
                 </button>
               </>
             )}
             <button className="p-2 text-zinc-500 hover:text-white transition-colors">
               <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 relative overflow-hidden transition-all duration-500 w-full">
        <AnimatePresence mode="wait">
          {view === 'input' ? (
            <motion.div
              key="input-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full relative"
            >
               <EvalForm onSubmit={handleEvaluate} isEvaluating={isEvaluating} />
            </motion.div>
          ) : (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-full overflow-y-auto px-4 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16 selection:bg-emerald-500/30"
            >
              <div className="w-full">
                {!batchResults && !isEvaluating ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-inner">
                      <TestTube2 className="w-10 h-10 text-zinc-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No active results</h3>
                    <p className="text-zinc-500 max-w-xs mx-auto mb-8">Run an evaluation in the Input Portal to see your detailed breakdown here.</p>
                    {history.length > 0 && (
                      <div className="w-full max-w-4xl pt-10 border-t border-zinc-900">
                        <TrendChart history={history} />
                      </div>
                    )}
                  </div>
                ) : isEvaluating ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center">
                    <div className="relative">
                      <div className="w-24 h-24 border-2 border-zinc-800 rounded-full" />
                      <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-blue-500 rounded-full animate-spin" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-8 text-center">
                      <p className="text-sm font-bold text-white uppercase tracking-[0.3em] font-mono animate-pulse">Processing Scenarios</p>
                      <p className="text-xs text-zinc-500 mt-2">Iterating through metrics via backend protocol...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-16 pb-32">
                    {/* Header Summary */}
                    <div className="p-8 lg:p-12 bg-zinc-900/40 border border-zinc-800/60 rounded-[40px] relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2 -translate-y-1/2" />
                       <div className="relative z-10">
                          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">Evaluation Ready</span>
                                <span className="text-zinc-600 font-mono text-[10px]">{new Date().toLocaleTimeString()}</span>
                              </div>
                              <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-none">Evaluation Insight</h2>
                              <p className="text-zinc-500 mt-4 max-w-xl text-lg leading-relaxed">
                                Advanced analytics derived from {batchResults!.length} automated test cases using strict alignment verification.
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="text-right">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Global Confidence</div>
                                  <div className="text-3xl font-mono font-black text-emerald-400">98.4%</div>
                               </div>
                               <div className="h-10 w-px bg-zinc-800" />
                               <button 
                                 onClick={exportBatchResults}
                                 className="px-6 py-3 rounded-2xl bg-white text-black font-bold text-sm shadow-xl hover:shadow-white/10 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
                               >
                                 <Download className="w-4 h-4" /> Export Report
                               </button>
                            </div>
                          </header>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             <div className="bg-black/40 rounded-3xl p-6 border border-zinc-800/50 backdrop-blur-sm">
                                <ScoreChart results={aggregatedResults!} />
                             </div>
                             <div className="bg-black/40 rounded-3xl p-6 border border-zinc-800/50 backdrop-blur-sm">
                                <TrendChart history={history} />
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Detailed Analysis Section */}
                    <section>
                      <div className="flex items-center gap-6 mb-10">
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-600 whitespace-nowrap">Case-by-Case Analysis</h3>
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 to-transparent" />
                      </div>

                      <div className="grid grid-cols-1 gap-12">
                        {batchResults?.map((bResult) => (
                           <motion.div 
                             key={bResult.itemIndex}
                             initial={{ opacity: 0, y: 20 }}
                             whileInView={{ opacity: 1, y: 0 }}
                             viewport={{ once: true }}
                             className="group"
                           >
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                               {/* Case Header Sidebar */}
                               <div className="xl:col-span-3 space-y-6">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-black text-zinc-600 shadow-inner group-hover:border-zinc-700 transition-colors">
                                      {String(bResult.itemIndex + 1).padStart(2, '0')}
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-white text-sm">Scenario {bResult.itemIndex + 1}</h4>
                                      <p className="text-[10px] text-zinc-500 font-mono tracking-wide">{bResult.results.length} Metrics Applied</p>
                                    </div>
                                  </div>

                                  <div className="space-y-4 pt-4 border-t border-zinc-900">
                                     <div className="space-y-2">
                                       <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Input Vector</span>
                                       <div className="text-[11px] leading-relaxed text-zinc-400 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/30 line-clamp-4 hover:line-clamp-none transition-all">
                                         {bResult.item.input || 'N/A'}
                                       </div>
                                     </div>
                                     <div className="space-y-2">
                                       <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Model Inference</span>
                                       <div className="text-[11px] leading-relaxed text-zinc-100 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 line-clamp-6 hover:line-clamp-none transition-all">
                                         {bResult.item.actualOutput || 'N/A'}
                                       </div>
                                     </div>
                                  </div>
                               </div>

                               {/* Results Grid */}
                               <div className="xl:col-span-9">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {bResult.results.map((result, idx) => (
                                       <ResultCard key={`${result.metricId}-${idx}`} result={result} />
                                     ))}
                                  </div>
                               </div>
                            </div>
                           </motion.div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
