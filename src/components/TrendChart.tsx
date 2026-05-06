import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { EvalResult } from '../services/evaluator';

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  results: EvalResult[];
}

interface TrendChartProps {
  history: HistoryEntry[];
}

export function TrendChart({ history }: TrendChartProps) {
  if (history.length < 2) {
    return null; // Not enough data for a trend line
  }

  // Find all unique metrics tested across history
  const allMetrics = new Set<string>();
  history.forEach(entry => {
    entry.results.forEach(r => {
      if (r.status === 'success') {
        allMetrics.add(r.metricName);
      }
    });
  });

  // Prepare data for recharts
  const data = history.map(entry => {
    const dataPoint: any = {
      name: entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    entry.results.forEach(r => {
      if (r.status === 'success') {
        dataPoint[r.metricName] = r.score;
      }
    });

    return dataPoint;
  });

  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#ef4444', // red
    '#06b6d4', // teal
  ];

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 lg:p-8">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-6">Historical Trends</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickMargin={12} />
            <YAxis domain={[0, 10]} stroke="#52525b" tick={{ fill: '#71717a' }} tickCount={6} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5', borderRadius: '12px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            
            {Array.from(allMetrics).map((metricName, index) => (
              <Line 
                key={metricName}
                type="monotone" 
                dataKey={metricName} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                dot={{ fill: '#18181b', stroke: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: colors[index % colors.length], stroke: '#18181b' }}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
