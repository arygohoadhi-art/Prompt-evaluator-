import React, { useRef, useState, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { EVAL_METRICS } from '../lib/metrics';
import { cn } from '../lib/utils';
import { Check, FileJson, FileText, Upload, FileSpreadsheet, Search, FileSearch, CheckCircle2, Lightbulb, Scale, Settings2, Play } from 'lucide-react';
import { BatchEvalParams, EvalItem } from '../services/evaluator';
import { toast } from 'sonner';

const METRIC_CATEGORIES = [
  {
    name: 'Relevance & Context',
    metrics: ['answer_relevancy', 'contextual_precision', 'contextual_recall', 'contextual_relevancy'],
    icon: FileSearch,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    ringColor: 'ring-blue-500/50'
  },
  {
    name: 'Accuracy & Faithfulness',
    metrics: ['faithfulness', 'answer_correctness', 'hallucination', 'summarization'],
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    ringColor: 'ring-emerald-500/50'
  },
  {
    name: 'Quality & Structure',
    metrics: ['task_completion', 'coherence'],
    icon: Lightbulb,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    ringColor: 'ring-amber-500/50'
  },
  {
    name: 'Safety & Fairness',
    metrics: ['toxicity', 'bias', 'robustness'],
    icon: Scale,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    ringColor: 'ring-rose-500/50'
  },
  {
    name: 'Custom',
    metrics: ['g_eval'],
    icon: Settings2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    ringColor: 'ring-purple-500/50'
  }
];

const CUSTOM_TEMPLATES = [
  {
    name: 'Summarization Quality',
    criteria: 'Evaluate the summary based on these elements:\n1. Accuracy: Does it accurately reflect the source text?\n2. Conciseness: Does it avoid unnecessary details?\n3. Comprehensiveness: Does it capture the main points?\nAssign a score from 0 to 10 based on how well it summarizes the text.'
  },
  {
    name: 'RAG Faithfulness',
    criteria: 'Evaluate if the actual output is strictly faithful to the provided context. The output must NOT introduce any information (hallucinations) that is absent from the context.\nScore 10 if completely faithful. Deduct points proportionally for unverified claims or external knowledge.'
  },
  {
    name: 'Creative Writing',
    criteria: 'Evaluate the writing for creativity, engaging tone, and stylistic flair.\n1. Originality: Are the ideas and phrasing unique?\n2. Flow: Is the writing rhythm smooth and engaging?\n3. Emotion: Does it successfully evoke the intended feeling?\nScore 10 for exceptionally creative and engaging text.'
  },
  {
    name: 'Tone & Style',
    criteria: 'Evaluate if the output adheres strictly to the required tone (e.g., professional, casual, empathetic).\nCheck for appropriate vocabulary, sentence structure, and overall demeanor. Score 10 if the tone perfectly matches expectations.'
  }
];

interface EvalFormProps {
  onSubmit: (params: BatchEvalParams) => void;
  isEvaluating: boolean;
}

export function EvalForm({ onSubmit, isEvaluating }: EvalFormProps) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Single mode state
  const [input, setInput] = useState('');
  const [actualOutput, setActualOutput] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [context, setContext] = useState('');
  const [criteria, setCriteria] = useState('');

  // Batch mode state
  const [batchJson, setBatchJson] = useState('[\n  {\n    "input": "What is the capital of France?",\n    "actualOutput": "Paris is the capital of France.",\n    "context": "France is a country in Europe. Its capital is Paris.",\n    "expectedOutput": "Paris",\n    "criteria": "Must accurately state the capital"\n  }\n]');

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['answer_relevancy', 'toxicity', 'answer_correctness', 'g_eval']);

  // Custom Metrics State
  const [metricCategories, setMetricCategories] = useState(METRIC_CATEGORIES);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCriteria, setNewCustomCriteria] = useState('');

  const handleAddCustomMetric = () => {
    if (!newCustomName.trim() || !newCustomCriteria.trim()) {
      toast.error('Name and Criteria are required for a custom metric.');
      return;
    }
    const newId = `custom_geval_${Date.now()}`;
    EVAL_METRICS[newId] = {
      id: newId,
      name: newCustomName,
      description: 'Custom user-defined G-Eval metric.',
      definition: 'Evaluate the actual output strictly based on the provided "Evaluation Criteria / Guidelines". Use a Chain-of-Thought approach to reason through how well the output satisfies the criteria. Score 10 if it perfectly meets the criteria. Score 0 if it completely fails to meet the criteria.',
      requiresContext: false,
      requiresExpectedOutput: false,
      requiresCriteria: true,
      customCriteria: newCustomCriteria,
    };
    
    setMetricCategories(prev => {
      const customCat = prev.find(c => c.name === 'Custom');
      if (customCat) {
        return prev.map(c => 
          c.name === 'Custom' 
            ? { ...c, metrics: [...c.metrics, newId] }
            : c
        );
      }
      return prev;
    });

    setSelectedMetrics(prev => [...prev, newId]);
    setShowAddCustom(false);
    setNewCustomName('');
    setNewCustomCriteria('');
    toast.success('Custom metric added!');
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return metricCategories;
    const lowerQuery = searchQuery.toLowerCase();
    
    return metricCategories.map(cat => ({
      ...cat,
      metrics: cat.metrics.filter(mId => {
        const metric = EVAL_METRICS[mId];
        return metric?.name.toLowerCase().includes(lowerQuery) || 
               metric?.description.toLowerCase().includes(lowerQuery);
      })
    })).filter(cat => cat.metrics.length > 0);
  }, [searchQuery]);

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = xlsx.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const json = xlsx.utils.sheet_to_json(worksheet);
        
        // Format to string
        setBatchJson(JSON.stringify(json, null, 2));
        toast.success("File parsed successfully");
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        toast.error("Failed to parse file. Please ensure it's a valid format (.xlsx or .csv)");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so the same file could be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEvaluate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMetrics.length === 0) {
      toast.warning("Please select at least one metric.");
      return;
    }

    let items: EvalItem[] = [];

    if (mode === 'single') {
      if (!actualOutput.trim()) {
        toast.error("Actual Output is required for evaluation.");
        return;
      }
      items = [{ input, actualOutput, expectedOutput, context, criteria }];
    } else {
      try {
        const parsed = JSON.parse(batchJson);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON must be an array of objects.");
        }
        if (parsed.length === 0) {
          throw new Error("Batch array is empty.");
        }
        items = parsed.map((item: any) => ({
          input: item.input || '',
          actualOutput: item.actualOutput || '',
          expectedOutput: item.expectedOutput || '',
          context: item.context || '',
          criteria: item.criteria || ''
        }));

          if (items.some(it => !it.actualOutput?.trim())) {
          toast.error("All items in the batch must have an 'actualOutput' field.");
          return;
        }
      } catch (err: any) {
        toast.error("Invalid Batch JSON: " + err.message);
        return;
      }
    }

    onSubmit({
      items,
      selectedMetrics
    });
  };

  const hasMetricRequiringContext = selectedMetrics.some(id => EVAL_METRICS[id]?.requiresContext);
  const hasMetricRequiringExpected = selectedMetrics.some(id => EVAL_METRICS[id]?.requiresExpectedOutput);
  const hasMetricRequiringCriteria = selectedMetrics.some(id => EVAL_METRICS[id]?.requiresCriteria);

  return (
    <form onSubmit={handleEvaluate} className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {/* Metrics Selection */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">1. Select Metrics</h2>
            <div className="relative w-48 sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search metrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111113] border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-shadow"
              />
            </div>
          </div>
          
          <div className="space-y-6">
            {filteredCategories.map((category) => {
              const CategoryIcon = category.icon;
              return (
              <div key={category.name} className="space-y-3">
                <h3 className={cn("text-xs font-bold uppercase tracking-wider flex items-center gap-2", category.color)}>
                  {CategoryIcon && <CategoryIcon className="w-4 h-4" />}
                  {category.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {category.metrics.map((metricId) => {
                    const metric = EVAL_METRICS[metricId];
                    if (!metric) return null;
                    const isSelected = selectedMetrics.includes(metric.id);
                    return (
                      <div 
                        key={metric.id}
                        onClick={() => toggleMetric(metric.id)}
                        className={cn(
                          "relative p-4 rounded-xl border cursor-pointer transition-all duration-200",
                          isSelected 
                            ? `${category.bgColor} ${category.borderColor} text-white ring-1 ${category.ringColor} shadow-[0_0_15px_rgba(0,0,0,0.2)]`
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/80"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className={cn("font-medium", isSelected ? category.color : "text-zinc-200")}>
                            {metric.name}
                          </h3>
                          {isSelected && <Check className={cn("w-4 h-4", category.color)} />}
                        </div>
                        <p className={cn("text-xs leading-relaxed", isSelected ? "text-white/80" : "opacity-80")}>{metric.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )})}
            
            {filteredCategories.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm bg-[#111113] rounded-xl border border-white/5 border-dashed">
                No metrics found matching "{searchQuery}"
              </div>
            )}

            {showAddCustom ? (
              <div className="mt-6 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Add Custom G-Eval Metric</h3>
                  <button type="button" onClick={() => setShowAddCustom(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {CUSTOM_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.name}
                        type="button"
                        onClick={() => {
                          setNewCustomName(tmpl.name);
                          setNewCustomCriteria(tmpl.criteria);
                        }}
                        className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-md text-[10px] text-purple-300 transition-colors uppercase tracking-wider font-semibold"
                      >
                        {tmpl.name}
                      </button>
                    ))}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newCustomName}
                      onChange={e => setNewCustomName(e.target.value)}
                      placeholder="Metric Name (e.g. Tone, Conciseness)"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <textarea
                      value={newCustomCriteria}
                      onChange={e => setNewCustomCriteria(e.target.value)}
                      placeholder="Evaluation criteria and grading guidelines..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 min-h-[80px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomMetric}
                    className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Add Metric
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="flex items-center gap-2 text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-lg transition-colors border border-purple-500/20"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Add Custom G-Eval Metric
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Input Data Section */}
        <section className="pt-8 border-t border-zinc-800/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">2. Evaluation Data</h2>
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button 
                type="button"
                onClick={() => setMode('single')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-2",
                  mode === 'single' ? "bg-zinc-100 text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
              >
                <FileText className="w-3.5 h-3.5" /> Single
              </button>
              <button 
                type="button"
                onClick={() => setMode('batch')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-2",
                  mode === 'batch' ? "bg-zinc-100 text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
              >
                <FileJson className="w-3.5 h-3.5" /> Batch
              </button>
            </div>
          </div>

          {mode === 'single' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Input Prompt <span className="text-zinc-600 font-normal lowercase tracking-normal">(Optional)</span></label>
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="The user's prompt..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-shadow resize-y min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Actual Output <span className="text-red-500">*</span></label>
                <textarea 
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                  placeholder="The LLM's response to evaluate..."
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-shadow resize-y min-h-[120px]"
                />
              </div>
              
              <div className={cn("space-y-2 transition-opacity duration-300", hasMetricRequiringCriteria ? "opacity-100 hidden" : "opacity-50 hidden")}></div>{/* Reordering */}

              <div className={cn("space-y-2 transition-opacity duration-300", hasMetricRequiringContext ? "opacity-100" : "opacity-50")}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Context Data</label>
                  {!hasMetricRequiringContext && <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Not required</span>}
                </div>
                <textarea 
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Background information or retrieved documents (e.g. for RAG evaluation)..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-shadow resize-y min-h-[100px]"
                />
              </div>

              <div className={cn("space-y-2 transition-opacity duration-300", hasMetricRequiringExpected ? "opacity-100" : "opacity-50")}>
                 <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Expected Output (Reference)</label>
                  {!hasMetricRequiringExpected && <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Not required</span>}
                </div>
                <textarea 
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  placeholder="The ideal, perfect response..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-shadow resize-y min-h-[80px]"
                />
              </div>

              <div className={cn("space-y-2 transition-opacity duration-300", hasMetricRequiringCriteria ? "opacity-100" : "opacity-50")}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Criteria / Guidelines <span className="text-zinc-600 font-normal lowercase tracking-normal">(Optional)</span></label>
                  {!hasMetricRequiringCriteria && <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Not required</span>}
                </div>
                <textarea 
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  placeholder="Evaluation criteria, rubrics, or specific guidelines for the metrics (e.g. for G-Eval)..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-shadow resize-y min-h-[80px]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Batch Data (JSON Array)</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-md transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Load Excel / CSV
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <textarea 
                  value={batchJson}
                  onChange={(e) => setBatchJson(e.target.value)}
                  placeholder="Paste an array of evaluation JSON objects or upload an Excel file..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-sm font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-shadow resize-y min-h-[400px] whitespace-pre"
                />
                <p className="text-xs text-zinc-500">
                  Provide an array of objects. Keys: <code className="text-zinc-400 bg-zinc-800/50 px-1 py-0.5 rounded">input</code>, <code className="text-zinc-400 bg-zinc-800/50 px-1 py-0.5 rounded">actualOutput</code>, <code className="text-zinc-400 bg-zinc-800/50 px-1 py-0.5 rounded">expectedOutput</code>, <code className="text-zinc-400 bg-zinc-800/50 px-1 py-0.5 rounded">context</code>, <code className="text-zinc-400 bg-zinc-800/50 px-1 py-0.5 rounded">criteria</code>.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="flex-shrink-0 p-6 border-t border-zinc-800/50 bg-zinc-950/90 backdrop-blur z-10 relative">
        <button
          type="submit"
          disabled={isEvaluating || selectedMetrics.length === 0 || (mode === 'single' && !actualOutput.trim())}
          className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-[13px] uppercase tracking-widest font-bold transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-[0_4px_25px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_35px_rgba(59,130,246,0.5)] active:scale-[0.99]"
        >
          {isEvaluating ? (
             <>
               <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
               Evaluating...
             </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Run Evaluation
            </>
          )}
        </button>
      </div>
    </form>
  );
}
