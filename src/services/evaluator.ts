import { EVAL_METRICS } from '../lib/metrics';

export interface EvalResult {
  metricId: string;
  metricName: string;
  score: number;
  reasoning: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface EvalItem {
  input: string;
  actualOutput: string;
  expectedOutput: string;
  context: string;
  criteria?: string;
}

export interface BatchEvalParams {
  items: EvalItem[];
  selectedMetrics: string[];
  model?: string;
}

export interface BatchItemResult {
  itemIndex: number;
  item: EvalItem;
  results: EvalResult[];
}

async function evaluateSingleMetric(
  item: EvalItem,
  metricId: string,
  model: string = 'gemini-3-flash-preview'
): Promise<EvalResult> {
  const metric = EVAL_METRICS[metricId];
  if (!metric) {
    return {
      metricId,
      metricName: metricId,
      score: 0,
      reasoning: '',
      status: 'error',
      errorMessage: 'Unknown metric',
    };
  }

  try {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, metricId, model })
    });

    if (!response.ok) {
       const errData = await response.json();
       throw new Error(errData.error || `Server error: ${response.status}`);
    }

    const resultObj = await response.json();

    return {
      metricId: metric.id,
      metricName: metric.name,
      score: resultObj.score,
      reasoning: resultObj.reasoning,
      status: 'success',
    };
  } catch (error: any) {
    console.error(`Error evaluating ${metric.name}:`, error);
    
    let errorMessage = error?.message || 'Evaluation failed';
    const errorLower = errorMessage.toLowerCase();

    if (errorLower.includes('api key') || errorLower.includes('403') || errorLower.includes('unauthorized') || errorLower.includes('openai_api_key')) {
      errorMessage = 'Invalid or missing API Key. Please provide the required API keys (Gemini or OpenAI) in the environment settings.';
    } else if (errorLower.includes('rate limit') || errorLower.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
    } else if (errorLower.includes('quota') || errorLower.includes('exhausted')) {
      errorMessage = 'Quota exhausted. You have reached your LLM provider API limits.';
    } else if (errorLower.includes('500') || errorLower.includes('503')) {
      errorMessage = 'Service error. The model provider might be temporarily busy or unavailable.';
    } else if (errorLower.includes('safety')) {
      errorMessage = 'The content was flagged by safety filters and could not be evaluated.';
    }

    return {
      metricId: metric.id,
      metricName: metric.name,
      score: 0,
      reasoning: '',
      status: 'error',
      errorMessage,
    };
  }
}

export async function checkBatchEvaluations(params: BatchEvalParams): Promise<BatchItemResult[]> {
  const model = params.model || 'gemini-3-flash-preview';
  const batchPromises = params.items.map(async (item, index) => {
    const promises = params.selectedMetrics.map((mid) => evaluateSingleMetric(item, mid, model));
    const results = await Promise.all(promises);
    return {
      itemIndex: index,
      item,
      results
    };
  });
  return Promise.all(batchPromises);
}
