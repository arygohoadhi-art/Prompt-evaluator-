import React, { useRef, useState, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { EVAL_METRICS } from '../lib/metrics';
import { cn } from '../lib/utils';
import { Check, FileJson, FileText, FileSpreadsheet, Search, FileSearch, CheckCircle2, Lightbulb, Scale, Settings2, Play, RotateCcw, Cpu, ChevronRight, ChevronLeft } from 'lucide-react';
import { BatchEvalParams, EvalItem } from '../services/evaluator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

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
    criteria: 'Evaluate the summary based on these elements:\n1. Accuracy: Does it accurately reflect the source text?\n2. Conciseness: Does it avoid unnecessary details?\n3. Comprehensiveness: Does it capture the main points?\nAssign a score from 1 to 5 based on how well it summarizes the text.'
  },
  {
    name: 'RAG Faithfulness',
    criteria: 'Evaluate if the actual output is strictly faithful to the provided context. The output must NOT introduce any information (hallucinations) that is absent from the context.\nScore 5 if completely faithful. Score 1 if it contains significant hallucinations.'
  },
  {
    name: 'Creative Writing',
    criteria: 'Evaluate the writing for creativity, engaging tone, and stylistic flair.\n1. Originality: Are the ideas and phrasing unique?\n2. Flow: Is the writing rhythm smooth and engaging?\n3. Emotion: Does it successfully evoke the intended feeling?\nScore 5 for exceptionally creative and engaging text.'
  },
  {
    name: 'Tone & Style',
    criteria: 'Evaluate if the output adheres strictly to the required tone (e.g., professional, casual, empathetic).\nCheck for appropriate vocabulary, sentence structure, and overall demeanor. Score 5 if the tone perfectly matches expectations.'
  }
];

interface EvalFormProps {
  onSubmit: (params: BatchEvalParams) => void;
  isEvaluating: boolean;
}

const LLM_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Latest)', description: 'Fast and accurate for most tasks.', provider: 'google' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', description: 'Experimental features and optimizations.', provider: 'google' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Highly efficient, great for large batches.', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most advanced OpenAI model.', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Classic powerful reasoning model.', provider: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy fast model.', provider: 'openai' },
];

export function EvalForm({ onSubmit, isEvaluating }: EvalFormProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');

  // Single mode state
  const [input, setInput] = useState('');
  const [actualOutput, setActualOutput] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [context, setContext] = useState('');
  const [criteria, setCriteria] = useState('');

  // Batch mode state
  const [batchJson, setBatchJson] = useState('[\n  {\n    "input": "What is the capital of France?",\n    "actualOutput": "Paris is the capital of France.",\n    "context": "France is a country in Europe. Its capital is Paris.",\n    "expectedOutput": "Paris",\n    "criteria": "Must accurately state the capital"\n  }\n]');

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['answer_relevancy', 'faithfulness', 'contextual_precision', 'contextual_recall', 'bias']);

  // Custom Metrics State
  const [metricCategories, setMetricCategories] = useState<any[]>(METRIC_CATEGORIES);
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
      definition: `Evaluate the actual output based on this custom criteria: ${newCustomCriteria}. Use a Chain-of-Thought approach to reason through how well the output satisfies the criteria. Score 5 if it perfectly meets the criteria. Score 1 if it completely fails to meet the criteria.`,
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
      metrics: cat.metrics.filter((mId: string) => {
        const metric = EVAL_METRICS[mId];
        return metric?.name.toLowerCase().includes(lowerQuery) || 
               metric?.description.toLowerCase().includes(lowerQuery);
      })
    })).filter(cat => cat.metrics.length > 0);
  }, [searchQuery, metricCategories]);

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
        const workbook = xlsx.read(data, { type: 'array' });
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setInput('');
    setActualOutput('');
    setExpectedOutput('');
    setContext('');
    setCriteria('');
    setBatchJson('[\n  {\n    "input": "What is the capital of France?",\n    "actualOutput": "Paris is the capital of France.",\n    "context": "France is a country in Europe. Its capital is Paris.",\n    "expectedOutput": "Paris",\n    "criteria": "Must accurately state the capital"\n  }\n]');
    setStep(1);
    toast.success("Environment reset");
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
      selectedMetrics,
      model: selectedModel
    });
  };

  const hasMetricRequiringContext = selectedMetrics.some(id => EVAL_METRICS[id]?.requiresContext);
  const hasMetricRequiringExpected = selectedMetrics.some(id => EVAL_METRICS[id]?.requiresExpectedOutput);
  const hasMetricRequiringCriteria = selectedMetrics.some(id => EVAL_METRICS[id]?.requiresCriteria);

  const nextStep = () => {
    if (step === 1 && selectedMetrics.length === 0) {
      toast.error('Pick at least one metric to continue.');
      return;
    }
    setStep(prev => prev + 1);
  };
  const prevStep = () => setStep(prev => prev - 1);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0c] relative">
      {/* Step Header */}
      <div className="flex-shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-zinc-800/40">
        <div className="flex items-center justify-between gap-4 mb-4 sm:mb-8">
           <div className="flex items-center gap-2 sm:gap-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2 sm:gap-3">
                  <div className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black transition-all",
                    step === s ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-zinc-900 text-zinc-600 border border-zinc-800",
                    step > s && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                  )}>
                    {step > s ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : s}
                  </div>
                  <span className={cn(
                    "text-[9px] sm:text-[10px] font-black uppercase tracking-widest hidden xs:block",
                    step === s ? "text-zinc-100" : "text-zinc-600"
                  )}>
                    {s === 1 ? 'Metrics' : s === 2 ? 'Engine' : 'Payload'}
                  </span>
                  {s < 3 && <div className="h-px w-4 sm:w-8 bg-zinc-800" />}
                </div>
              ))}
           </div>
           {step < 3 && (
             <button 
               onClick={nextStep}
               type="button"
               className="group flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-zinc-100 text-black rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-white active:scale-95 transition-all shadow-xl whitespace-nowrap"
             >
               <span className="hidden sm:inline">Next Stage</span>
               <span className="sm:hidden">Next</span>
               <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
             </button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="h-full overflow-y-auto p-4 sm:p-8 space-y-8 sm:space-y-12"
            >
              <section className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 sm:mb-10">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Metric Parameters</h2>
                    <p className="text-[10px] sm:text-xs text-zinc-600 mt-1 uppercase font-mono tracking-wider">Select the alignment indicators for this run</p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter protocol..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800/60 rounded-2xl py-3 pl-10 pr-4 text-xs text-zinc-200 placeholder-zinc-800 focus:outline-none focus:border-blue-500/30 transition-all font-mono"
                    />
                  </div>
                </div>
                
                <div className="space-y-12">
                  {filteredCategories.map((category) => {
                    const CategoryIcon = category.icon;
                    return (
                    <div key={category.name} className="space-y-6">
                      <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2.5 pl-1", category.color)}>
                        <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]", category.bgColor.replace('/10', '/40'))} />
                        {category.name}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {category.metrics.map((metricId: string) => {
                          const metric = EVAL_METRICS[metricId];
                          if (!metric) return null;
                          const isSelected = selectedMetrics.includes(metric.id);
                          return (
                            <div 
                              key={metric.id}
                              onClick={() => toggleMetric(metric.id)}
                              className={cn(
                                "relative p-5 rounded-3xl border cursor-pointer transition-all duration-300 group/metric",
                                isSelected 
                                  ? `${category.bgColor} ${category.borderColor} text-white shadow-[0_12px_24px_rgba(0,0,0,0.4)] scale-[1.02] z-10`
                                  : "bg-zinc-950/20 border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/10"
                              )}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <h3 className={cn("font-bold text-[13px] tracking-tight transition-colors", isSelected ? "text-white" : "text-zinc-400 group-hover/metric:text-zinc-200")}>
                                  {metric.name}
                                </h3>
                                <div className={cn(
                                  "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                                  isSelected ? `${category.color} ${category.borderColor} border-opacity-50 ring-2 ring-white/10` : "border-zinc-800 opacity-20 group-hover/metric:opacity-100"
                                )}>
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                              </div>
                              <p className={cn("text-[11px] leading-relaxed transition-opacity", isSelected ? "text-white/70 font-medium" : "opacity-40 group-hover/metric:opacity-60")}>{metric.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )})}
                  
                  {showAddCustom ? (
                    <div className="p-8 rounded-[40px] border border-purple-500/20 bg-purple-500/[0.03] space-y-6 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between">
                         <div>
                           <h3 className="text-sm font-black uppercase tracking-widest text-purple-400">Custom Protocol</h3>
                           <p className="text-[10px] text-purple-900 mt-1 uppercase font-mono">Define unique alignment heuristics</p>
                         </div>
                         <button type="button" onClick={() => setShowAddCustom(false)} className="p-2 hover:bg-purple-500/10 rounded-xl text-purple-500 transition-colors">
                           <RotateCcw className="w-4 h-4" />
                         </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-4">
                           <div className="flex flex-wrap gap-2">
                             {CUSTOM_TEMPLATES.map((tmpl) => (
                               <button
                                 key={tmpl.name}
                                 type="button"
                                 onClick={() => {
                                   setNewCustomName(tmpl.name);
                                   setNewCustomCriteria(tmpl.criteria);
                                 }}
                                 className="px-3 py-2 bg-zinc-950 hover:bg-purple-950/20 border border-zinc-800/50 hover:border-purple-500/30 rounded-xl text-[10px] text-zinc-500 hover:text-purple-400 transition-all uppercase tracking-wider font-bold"
                               >
                                 {tmpl.name}
                               </button>
                             ))}
                           </div>
                           <input
                             type="text"
                             value={newCustomName}
                             onChange={e => setNewCustomName(e.target.value)}
                             placeholder="Metric Label"
                             className="w-full bg-black border border-zinc-800/60 rounded-2xl px-5 py-4 text-xs text-zinc-200 placeholder-zinc-800 focus:outline-none focus:border-purple-500/50 shadow-inner"
                           />
                        </div>
                        <div className="lg:col-span-8 flex flex-col gap-4">
                           <textarea
                             value={newCustomCriteria}
                             onChange={e => setNewCustomCriteria(e.target.value)}
                             placeholder="Specify the rigorous evaluation criteria for this custom metric..."
                             className="flex-1 bg-black border border-zinc-800/60 rounded-[32px] px-6 py-5 text-xs text-zinc-200 placeholder-zinc-800 focus:outline-none focus:border-purple-500/50 min-h-[160px] shadow-inner"
                           />
                           <button
                             type="button"
                             onClick={handleAddCustomMetric}
                             className="w-full py-4 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-purple-500 shadow-xl active:scale-95"
                           >
                             Register Heuristic
                           </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center pt-8">
                      <button
                        type="button"
                        onClick={() => setShowAddCustom(true)}
                        className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 px-8 py-4 rounded-[20px] transition-all border border-purple-500/20 hover:border-purple-500/40 shadow-xl"
                      >
                        <Settings2 className="w-4 h-4" />
                        Init Custom Metric
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col items-center justify-center p-4 sm:p-8 lg:p-24"
            >
              <div className="w-full">
                <div className="mb-10 sm:mb-16 text-center">
                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Inference Backbone</h2>
                  <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                    Select the large language model that will perform the scoring and reasoning logic for your evaluation suite.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {LLM_MODELS.map((m) => (
                    <div 
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={cn(
                        "relative p-8 rounded-[40px] border cursor-pointer transition-all flex flex-col items-center text-center group/model",
                        selectedModel === m.id
                          ? "bg-blue-600/5 border-blue-500/30 shadow-[0_20px_40px_rgba(0,0,0,0.5)] scale-[1.05] z-10"
                          : "bg-zinc-950 border-zinc-900/50 hover:border-zinc-800 hover:bg-zinc-900/20"
                      )}
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-3xl mb-6 flex items-center justify-center transition-all",
                        selectedModel === m.id ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                      )}>
                        <Cpu className="w-8 h-8" />
                      </div>
                      
                      <div className="space-y-2">
                        <span className={cn("text-[13px] font-black uppercase tracking-widest block transition-colors", selectedModel === m.id ? "text-white" : "text-zinc-500 group-hover/model:text-zinc-300")}>
                          {m.name}
                        </span>
                        <p className="text-[11px] text-zinc-600 group-hover/model:text-zinc-500 transition-colors leading-relaxed px-2">
                          {m.description}
                        </p>
                      </div>

                      {selectedModel === m.id && (
                        <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-blue-500 border-4 border-[#0a0a0c] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-20 flex justify-center gap-4">
                  <button onClick={prevStep} type="button" className="px-10 py-4 rounded-2xl bg-zinc-900 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">Back to Protocols</button>
                  <button onClick={nextStep} type="button" className="px-12 py-4 rounded-2xl bg-zinc-100 text-black text-[10px] font-black uppercase tracking-widest hover:bg-white shadow-xl transition-all active:scale-95">Configure Payload</button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              className="h-full overflow-hidden flex flex-col"
            >
              {/* Working Place Header */}
              <div className="bg-zinc-900/10 border-b border-zinc-800/40 p-6 sm:p-10 lg:p-14 lg:pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8">
                 <div>
                    <div className="flex items-center gap-3 mb-3 sm:mb-4">
                       <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] sm:text-[9px] font-black text-emerald-500 uppercase tracking-widest">Environment Ready</div>
                       <div className="h-px w-4 sm:w-8 bg-zinc-800" />
                       <div className="text-[8px] sm:text-[10px] font-mono text-zinc-600 uppercase italic">{selectedModel} active</div>
                    </div>
                    <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter mb-2 sm:mb-4">Payload Discovery</h2>
                    <p className="text-zinc-500 max-w-lg text-sm sm:text-lg font-medium leading-relaxed">
                      Provide the input vectors for the evaluation engine. Optimized for single and batch stream processing.
                    </p>
                 </div>
                 
                 <div className="flex bg-zinc-950 p-1.5 sm:p-2 rounded-2xl sm:rounded-[24px] border border-zinc-900 shadow-2xl">
                    <button 
                      type="button"
                      onClick={() => setMode('single')}
                      className={cn(
                        "flex-1 sm:flex-none px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3",
                        mode === 'single' ? "bg-zinc-100 text-zinc-900 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Single
                    </button>
                    <button 
                      type="button"
                      onClick={() => setMode('batch')}
                      className={cn(
                        "flex-1 sm:flex-none px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3",
                        mode === 'batch' ? "bg-zinc-100 text-zinc-900 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <FileJson className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Batch
                    </button>
                 </div>
              </div>

              {/* Scrollable Working Area */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 lg:p-14 scroll-smooth">
                <form onSubmit={handleEvaluate} className="w-full space-y-8 sm:space-y-12">
                  {mode === 'single' ? (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 pl-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                             <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Retrieval Context / Prompt</label>
                           </div>
                           <textarea 
                             value={input}
                             onChange={(e) => setInput(e.target.value)}
                             placeholder="Paste the user prompt or context provided to the model..."
                             className="w-full bg-[#050505] border border-zinc-900 rounded-[32px] p-8 text-[14px] font-mono text-zinc-200 placeholder-zinc-800 focus:outline-none focus:border-blue-500/30 focus:bg-blue-500/[0.01] transition-all resize-none min-h-[220px] shadow-2xl leading-relaxed"
                           />
                        </div>

                        <div className="space-y-4">
                           <div className="flex items-center gap-2 pl-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                             <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Model inference Output <span className="text-red-500/50 ml-1">*</span></label>
                           </div>
                           <textarea 
                             value={actualOutput}
                             onChange={(e) => setActualOutput(e.target.value)}
                             placeholder="The response vector generated by the test object..."
                             required
                             className="w-full bg-[#050505] border border-zinc-800/60 rounded-[32px] p-8 text-[14px] font-mono text-zinc-100 placeholder-zinc-800 focus:outline-none focus:border-blue-500/30 focus:bg-blue-500/[0.01] transition-all resize-none min-h-[220px] shadow-2xl leading-relaxed"
                           />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className={cn("space-y-4 transition-all duration-700", hasMetricRequiringContext ? "opacity-100" : "opacity-20 blur-sm pointer-events-none")}>
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 block pl-2 italic">Grounding Source</label>
                           <textarea 
                             value={context}
                             onChange={(e) => setContext(e.target.value)}
                             placeholder="Supporting knowledge base data..."
                             disabled={!hasMetricRequiringContext}
                             className="w-full bg-black border border-zinc-900 rounded-[32px] p-6 text-[12px] font-mono text-zinc-400 placeholder-zinc-900 focus:outline-none focus:border-emerald-500/20 transition-all resize-none min-h-[180px] shadow-inner"
                           />
                        </div>

                        <div className={cn("space-y-4 transition-all duration-700", hasMetricRequiringExpected ? "opacity-100" : "opacity-20 blur-sm pointer-events-none")}>
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 block pl-2 italic">Gold Standard Reference</label>
                           <textarea 
                             value={expectedOutput}
                             onChange={(e) => setExpectedOutput(e.target.value)}
                             placeholder="The statistically ideal response..."
                             disabled={!hasMetricRequiringExpected}
                             className="w-full bg-black border border-zinc-900 rounded-[32px] p-6 text-[12px] font-mono text-zinc-400 placeholder-zinc-900 focus:outline-none focus:border-emerald-500/20 transition-all resize-none min-h-[180px] shadow-inner"
                           />
                        </div>

                        <div className={cn("space-y-4 transition-all duration-700", hasMetricRequiringCriteria ? "opacity-100" : "opacity-20 blur-sm pointer-events-none")}>
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 block pl-2 italic">Dynamic Heuristics</label>
                           <textarea 
                             value={criteria}
                             onChange={(e) => setCriteria(e.target.value)}
                             placeholder="Strict qualitative alignment rules..."
                             disabled={!hasMetricRequiringCriteria}
                             className="w-full bg-black border border-zinc-900 rounded-[32px] p-6 text-[12px] font-mono text-zinc-400 placeholder-zinc-900 focus:outline-none focus:border-emerald-500/20 transition-all resize-none min-h-[180px] shadow-inner"
                           />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="pl-4 border-l-2 border-blue-600/30">
                           <h4 className="text-xl font-black text-white tracking-tight uppercase">JSON Dataset Orchestration</h4>
                           <p className="text-[10px] text-zinc-600 font-mono mt-1 italic uppercase">Upload Excel, CSV, or paste an array of objects</p>
                        </div>
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
                            className="flex items-center gap-3 px-10 py-4 text-[10px] font-black uppercase tracking-[0.15em] bg-zinc-900 text-white border border-zinc-800 rounded-3xl hover:bg-zinc-800 transition-all shadow-2xl active:scale-95"
                          >
                            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                            Ingest Data Cluster
                          </button>
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-[48px] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <textarea 
                          value={batchJson}
                          onChange={(e) => setBatchJson(e.target.value)}
                          placeholder="[ { 'input': '...', 'actualOutput': '...' }, ... ]"
                          className="relative w-full bg-[#050505] border border-zinc-900 rounded-[40px] p-12 text-[14px] font-mono text-zinc-400 placeholder-zinc-900 focus:outline-none focus:border-blue-500/30 focus:bg-white/[0.01] transition-all resize-y min-h-[540px] shadow-2xl leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Execution Zone */}
                  <div className="flex items-center gap-4 pt-10 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="p-6 rounded-[24px] bg-zinc-900 text-zinc-500 hover:text-white transition-all active:scale-95 border border-zinc-800"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="p-6 rounded-[24px] bg-zinc-900 text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95 border border-zinc-800"
                      title="Abort Workspace"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <button
                      type="submit"
                      disabled={isEvaluating || selectedMetrics.length === 0 || (mode === 'single' && !actualOutput.trim())}
                      className="flex-1 flex items-center justify-center gap-4 py-6 px-10 rounded-[28px] text-[13px] font-black uppercase tracking-[0.3em] transition-all
                               disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed
                               bg-white text-black hover:bg-zinc-200 shadow-2xl hover:shadow-white/10 hover:-translate-y-1 active:scale-[0.98]"
                    >
                      {isEvaluating ? (
                         <div className="flex items-center gap-4">
                           <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                           Awaiting Inference...
                         </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center -ml-2 shadow-xl">
                            <Play className="w-4 h-4 fill-white translate-x-0.5" />
                          </div>
                          Trigger Evaluation
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
