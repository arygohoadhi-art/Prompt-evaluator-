import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar, Cell } from 'recharts';
import { EvalResult } from '../services/evaluator';

interface ScoreChartProps {
  results: EvalResult[];
}

export function ScoreChart({ results }: ScoreChartProps) {
  const data = results
    .filter((r) => r.status === 'success')
    .map((r) => ({
      name: r.metricName,
      subject: r.metricName, // For radar
      score: r.score,
      fullMark: 5,
    }));

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 lg:p-8">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">Score Overview</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {data.length > 2 ? (
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 500 }} />
              <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#52525b' }} tickCount={6} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                fill="#8b5cf6"
                fillOpacity={0.25}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5', borderRadius: '12px' }}
                itemStyle={{ color: '#c084fc', fontWeight: 600 }}
              />
            </RadarChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickMargin={12} />
              <YAxis domain={[0, 5]} stroke="#52525b" tick={{ fill: '#71717a' }} tickCount={6} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5', borderRadius: '12px' }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="score" fill="#c084fc" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.score >= 4 ? '#10b981' : entry.score >= 3 ? '#f59e0b' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
