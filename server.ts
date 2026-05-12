import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';
import { EVAL_METRICS } from './src/lib/metrics.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Evaluation API
  app.post('/api/evaluate', async (req, res) => {
    const { item, metricId, model } = req.body;
    
    try {
      const metric = EVAL_METRICS[metricId];
      if (!metric) {
        return res.status(400).json({ error: 'Unknown metric' });
      }

      let evaluationSteps = '';
      const isGEval = metric.id === 'g_eval' || metric.id.startsWith('custom_geval_');

      const isOpenAI = model.startsWith('gpt-');
      
      const getPrompt = (steps: string) => `You are an expert AI evaluator specializing in LLM performance measurement, following the rigorous standards of evaluation frameworks like DeepEval. Your task is to perform a strict and objective evaluation using the "${metric.name}" metric.

### METRIC DEFINITION:
${metric.definition}

### DATA FOR EVALUATION:
${item.input ? `**Input Prompt**:
${item.input}
` : ''}
${item.actualOutput ? `**Actual Output (to be evaluated)**:
${item.actualOutput}
` : ''}
${item.expectedOutput && metric.requiresExpectedOutput ? `**Expected Output (Reference)**:
${item.expectedOutput}
` : ''}
${item.context && metric.requiresContext ? `**Context (Source of Truth)**:
${item.context}
` : ''}
${(metric.customCriteria || item.criteria) ? `**Evaluation Guidelines**:
${metric.customCriteria || item.criteria}
` : ''}

### EVALUATION PROCESS:
${steps || `1. Analyze the Actual Output against the provided data and Metric Definition.
2. If this is a Faithfulness/Hallucination check, extract factual claims from the output and verify them one-by-one against the Context.
3. If this is an Answer Relevancy check, identify query intents in the Input Prompt and verify if the Actual Output addresses them.
4. If this is an Answer Correctness check, compare the semantic meaning and factual content of the Actual Output with the Expected Output.
5. Assign a final score from 1 to 5 (integers only) based on your reasoning. 1 is the worst, 5 is the best.`}

### OUTPUT FORMAT:
You must return only a JSON object with the following keys:
- "reasoning": A detailed analysis FOLLOWING THE EVALUATION PROCESS ABOVE. Be specific about claims, intents, or semantic gaps found.
- "score": An integer from 1 to 5.

Your evaluation must be objective, strict, and precise. Avoid being overly lenient; identify even minor inaccuracies or irrelevant tangents.`;

      const generateStepsPrompt = `You are an expert in Natural Language Generation evaluation. Your goal is to generate a set of detailed, step-by-step evaluation instructions (Chain-of-Thought) for the metric: "${metric.name}", similar to the rigorous methodologies used in DeepEval.

### METRIC DEFINITION:
${metric.definition}

${(metric.customCriteria || item.criteria) ? `### EVALUATION CRITERIA:
${metric.customCriteria || item.criteria}` : ''}

### TASK:
Generate exactly 3-5 clear, numbered evaluation steps that an AI evaluator should follow to strictly and objectively score an output based on this metric. These steps should guide the evaluator from initial reading to final score assignment on a scale of 1 to 5.

### OUTPUT:
Just the numbered list of steps.`;

      if (isOpenAI) {
        if (!process.env.OPENAI_API_KEY) {
          return res.status(400).json({ error: 'OPENAI_API_KEY is not configured' });
        }
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        if (isGEval) {
          const stepRes = await openai.chat.completions.create({
            model: model,
            messages: [{ role: 'system', content: 'You are an evaluation expert.' }, { role: 'user', content: generateStepsPrompt }]
          });
          evaluationSteps = stepRes.choices[0].message.content || '';
        }

        const sampleCount = isGEval ? 3 : 1;
        const samples = [];

        for (let i = 0; i < sampleCount; i++) {
          const comp = await openai.chat.completions.create({
            model: model,
            messages: [{ role: 'system', content: 'You are an objective judge.' }, { role: 'user', content: getPrompt(evaluationSteps) }],
            response_format: { type: 'json_object' },
            temperature: isGEval ? 1 : 0
          });
          const result = JSON.parse(comp.choices[0].message.content || '{}');
          samples.push(result);
        }

        const averageScore = samples.reduce((acc, s) => acc + (s.score || 0), 0) / samples.length;
        return res.json({
          score: averageScore,
          reasoning: isGEval ? `### Automated Evaluation Steps:\n${evaluationSteps}\n\n### Reasoning:\n${samples[0].reasoning}` : samples[0].reasoning
        });

      } else {
        if (!process.env.GEMINI_API_KEY) {
          return res.status(400).json({ error: 'GEMINI_API_KEY is not configured' });
        }
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        if (isGEval) {
          const stepRes = await ai.models.generateContent({
            model: model,
            contents: generateStepsPrompt
          });
          evaluationSteps = stepRes.text || '';
        }

        const sampleCount = isGEval ? 3 : 1;
        const samples = [];

        for (let i = 0; i < sampleCount; i++) {
           const result = await ai.models.generateContent({
             model: model,
             contents: getPrompt(evaluationSteps),
             config: {
               responseMimeType: 'application/json',
               responseSchema: {
                 type: Type.OBJECT,
                 properties: {
                   reasoning: { type: Type.STRING },
                   score: { type: Type.INTEGER },
                 },
                 required: ['reasoning', 'score'],
               },
               temperature: isGEval ? 1 : 0
             }
           });
           samples.push(JSON.parse(result.text || '{}'));
        }

        const averageScore = samples.reduce((acc, s) => acc + s.score, 0) / samples.length;
        return res.json({
          score: averageScore,
          reasoning: isGEval ? `### Automated Evaluation Steps:\n${evaluationSteps}\n\n### Reasoning:\n${samples[0].reasoning}` : samples[0].reasoning
        });
      }

    } catch (error: any) {
      console.error('Eval error:', error);
      res.status(500).json({ error: error.message || 'Internal evaluation error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
