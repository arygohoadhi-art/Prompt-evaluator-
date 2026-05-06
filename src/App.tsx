import { useState, useEffect, useMemo } from 'react';
import { Activity, TestTube2, LayoutPanelLeft, Clock, Layers, Download, Sparkles } from 'lucide-react';
import * as xlsx from 'xlsx';
import { EvalForm } from './components/EvalForm';
import { ResultCard } from './components/ResultCard';
import { ScoreChart } from './components/ScoreChart';
import { TrendChart, HistoryEntry } from './components/TrendChart';
import { checkBatchEvaluations, BatchEvalParams, BatchItemResult, EvalResult } from './services/evaluator';

import { Toaster, toast } from 'sonner';

export default function App() {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchItemResult[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('evalHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Revive Date objects
        const revived = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
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
      
      const newHistory = [...history, newEntry].slice(-10); // keep last 10
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
    if (confirm("Are you sure you want to clear your evaluation history?")) {
      setHistory([]);
      localStorage.removeItem('evalHistory');
      toast.success("History cleared");
    }
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
    <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      <Toaster theme="dark" position="top-right" />
      {/* Top Navigation */}
      <header className="flex-shrink-0 h-14 border-b border-slate-800/50 flex items-center px-6 justify-between bg-slate-950/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-semibold tracking-tight text-lg text-slate-100">Prompt Evaluator</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tracking-wider uppercase">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span>v1.0.0</span>
        </div>
      </header>

      {/* Main Content Area: Split View */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Configuration & Input */}
        <section className="w-full md:w-1/2 lg:w-5/12 xl:w-1/3 flex flex-col border-r border-zinc-800/50 bg-zinc-950 z-0">
          <div className="h-full overflow-hidden">
             <EvalForm onSubmit={handleEvaluate} isEvaluating={isEvaluating} />
          </div>
        </section>

        {/* Right Panel: Results */}
        <section className="hidden md:flex flex-1 flex-col bg-[#09090b]">
          <div className="flex-shrink-0 h-14 border-b border-zinc-800/50 flex items-center justify-between px-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <LayoutPanelLeft className="w-3.5 h-3.5" />
              Evaluation Results
            </h2>
            {history.length > 0 && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportHistory}
                  className="px-3 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 flex items-center gap-1.5 transition-colors"
                  title="Export History"
                >
                  <Download className="w-3.5 h-3.5" /> Export History
                </button>
                <button 
                  onClick={clearHistory}
                  className="px-3 py-1.5 rounded text-xs font-medium text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 transition-colors"
                  title="Clear history"
                >
                  <Clock className="w-3.5 h-3.5" /> Clear History
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth">
            {!batchResults && !isEvaluating && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                <TestTube2 className="w-12 h-12 opacity-20" />
                <p className="text-sm">Run an evaluation to see results here.</p>
                {history.length >= 2 && (
                  <div className="w-full max-w-3xl mt-8">
                     <TrendChart history={history} />
                  </div>
                )}
              </div>
            )}

            {isEvaluating && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <div className="w-8 h-8 border-4 border-zinc-800 border-t-zinc-300 rounded-full animate-spin" />
                <p className="text-xs uppercase tracking-widest font-mono animate-pulse">Running metrics...</p>
              </div>
            )}

            {batchResults && aggregatedResults && !isEvaluating && (
              <div className="space-y-4 max-w-3xl mx-auto pb-12">
                <div className="grid grid-cols-1 gap-6 mb-8">
                  <ScoreChart results={aggregatedResults} />
                  <TrendChart history={history} />
                </div>
                
                <div className="flex items-center justify-between mt-12 pt-6 border-t border-zinc-800/50 mb-6">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Detailed Breakdown ({batchResults.length} Items)
                  </h3>
                  <button 
                    onClick={exportBatchResults}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Results
                  </button>
                </div>
                <div className="space-y-8">
                  {batchResults.map((bResult) => (
                    <div key={bResult.itemIndex} className="bg-zinc-900/30 border border-zinc-800/50 p-5 rounded-2xl">
                      <h4 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-300 mb-4 border-b border-zinc-800/50 pb-3">
                        <Layers className="w-4 h-4 text-zinc-500" />
                        Test Case {String(bResult.itemIndex + 1).padStart(2, '0')}
                      </h4>
                      {bResult.item.input && (
                         <div className="mb-5 text-sm leading-relaxed text-zinc-400 bg-zinc-950 p-4 rounded-xl border border-zinc-900">
                           <strong className="text-zinc-200 block mb-1 text-xs uppercase tracking-wider">Input Prompt</strong> 
                           {bResult.item.input}
                         </div>
                      )}
                      <div className="space-y-3 mt-4">
                        {bResult.results.map((result, idx) => (
                          <ResultCard key={`${result.metricId}-${idx}`} result={result} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
