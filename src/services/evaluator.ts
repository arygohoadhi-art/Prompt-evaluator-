import { GoogleGenAI, Type } from '@google/genai';
import { EVAL_METRICS } from '../lib/metrics';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) {
      throw new Error('VITE_GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

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
}

export interface BatchItemResult {
  itemIndex: number;
  item: EvalItem;
  results: EvalResult[];
}

async function evaluateSingleMetric(
  item: EvalItem,
  metricId: string
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
    let instructions = `1. Read the inputs carefully.
2. Step-by-step, reason through how the Actual Output scores against the Metric Definition.
3. Assign a final score from 0 to 10 (integers only) based on your reasoning.`;

    if (metric.id === 'g_eval' || metric.id.startsWith('custom_geval_')) {
      instructions = `1. Read the inputs and Evaluation Criteria carefully.
2. First, generate a series of clear, objective evaluation steps based solely on the provided Evaluation Criteria.
3. Second, execute those evaluation steps strictly on the Actual Output (and other provided data).
4. Step-by-step, reason through how the Actual Output scores against the criteria using your evaluation steps.
5. Assign a final score from 0 to 10 (integers only). Score 10 if it perfectly meets the criteria. Score 0 if it completely fails.`;
    }

    const prompt = `You are an expert AI evaluator. You are using the explicitly defined evaluation metric: "${metric.name}".

**Metric Definition**:
${metric.definition}

**Evaluation Data**:
${item.input ? `- Input/Prompt:\n${item.input}\n` : ''}
${item.actualOutput ? `- Actual Output (Response):\n${item.actualOutput}\n` : ''}
${item.expectedOutput && metric.requiresExpectedOutput ? `- Expected Output (Reference):\n${item.expectedOutput}\n` : ''}
${item.context && metric.requiresContext ? `- Context:\n${item.context}\n` : ''}
${(metric.customCriteria || item.criteria) ? `- Evaluation Criteria / Guidelines:\n${metric.customCriteria || item.criteria}\n` : ''}

**Instructions**:
${instructions}

Provide your response in JSON format matching the schema.`;

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: {
              type: Type.STRING,
              description: 'Your detailed step-by-step thought process and justification for the score.',
            },
            score: {
              type: Type.INTEGER,
              description: 'The final score from 0 to 10.',
            },
          },
          required: ['reasoning', 'score'],
        },
      },
    });

    const resultText = response.text || '{}';
    const resultObj = JSON.parse(resultText);

    return {
      metricId: metric.id,
      metricName: metric.name,
      score: resultObj.score || 0,
      reasoning: resultObj.reasoning || '',
      status: 'success',
    };
  } catch (error: any) {
    console.error(`Error evaluating ${metric.name}:`, error);
    return {
      metricId: metric.id,
      metricName: metric.name,
      score: 0,
      reasoning: '',
      status: 'error',
      errorMessage: error?.message || 'Evaluation failed',
    };
  }
}

export async function checkBatchEvaluations(params: BatchEvalParams): Promise<BatchItemResult[]> {
  const batchPromises = params.items.map(async (item, index) => {
    const promises = params.selectedMetrics.map((mid) => evaluateSingleMetric(item, mid));
    const results = await Promise.all(promises);
    return {
      itemIndex: index,
      item,
      results
    };
  });
  return Promise.all(batchPromises);
}
