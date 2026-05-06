import { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceDot } from 'recharts';
import { EvalResult } from '../services/evaluator';
import { Filter, Settings2, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  results: EvalResult[];
}

interface TrendChartProps {
  history: HistoryEntry[];
}

type TimeRange = 'all' | 'last5' | 'last10';
type Smoothing = 'monotone' | 'linear' | 'step';

export function TrendChart({ history }: TrendChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [smoothing, setSmoothing] = useState<Smoothing>('monotone');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [showControls, setShowControls] = useState(false);
  const [changeThreshold] = useState(2); // Score change > 2 is "significant"

  const allMetrics = useMemo(() => {
    const metrics = new Set<string>();
    history.forEach(entry => {
      entry.results.forEach(r => {
        if (r.status === 'success') {
          metrics.add(r.metricName);
        }
      });
    });
    return Array.from(metrics);
  }, [history]);

  // Initialize selected metrics if empty
  useEffect(() => {
    if (selectedMetrics.length === 0 && allMetrics.length > 0) {
      setSelectedMetrics(allMetrics);
    }
  }, [allMetrics, selectedMetrics.length]);

  if (history.length < 2) {
    return null;
  }

  // Filter history by time range
  const filteredHistory = useMemo(() => {
    let result = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (timeRange === 'last5') return result.slice(-5);
    if (timeRange === 'last10') return result.slice(-10);
    return result;
  }, [history, timeRange]);

  // Prepare data for recharts
  const data = filteredHistory.map((entry) => {
    const dataPoint: any = {
      name: entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullTimestamp: entry.timestamp.toLocaleString(),
      raw: entry.results
    };
    
    entry.results.forEach(r => {
      if (r.status === 'success') {
        dataPoint[r.metricName] = r.score;
      }
    });

    return dataPoint;
  });

  // Calculate significant changes for highlighting
  const significantChanges = useMemo(() => {
    const changes: { metric: string; index: number; type: 'up' | 'down'; diff: number; value: number; time: string }[] = [];
    
    selectedMetrics.forEach(metric => {
      for (let i = 1; i < data.length; i++) {
        const prev = data[i-1][metric];
        const curr = data[i][metric];
        
        if (typeof prev === 'number' && typeof curr === 'number') {
          const diff = curr - prev;
          if (Math.abs(diff) >= changeThreshold) {
            changes.push({
              metric,
              index: i,
              type: diff > 0 ? 'up' : 'down',
              diff: Math.abs(diff),
              value: curr,
              time: data[i].name
            });
          }
        }
      }
    });
    return changes;
  }, [data, selectedMetrics, changeThreshold]);

  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#ef4444', // red
    '#06b6d4', // teal
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-zinc-300 font-medium">{entry.name}</span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: entry.color }}>{entry.value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center justify-between border-b border-zinc-800/30">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Historical Trends</h3>
          <p className="text-[10px] text-zinc-600 font-medium mt-0.5">Performance over time</p>
        </div>
        <button 
          onClick={() => setShowControls(!showControls)}
          className={`p-2 rounded-lg transition-all ${showControls ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'}`}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-zinc-950/50 border-b border-zinc-800/30"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Metric Filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-2 mb-3">
                  <Filter className="w-3 h-3" /> Filter Metrics
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allMetrics.map(metric => {
                    const isSelected = selectedMetrics.includes(metric);
                    return (
                      <button
                        key={metric}
                        onClick={() => setSelectedMetrics(prev => 
                          isSelected ? prev.filter(m => m !== metric) : [...prev, metric]
                        )}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-all ${
                          isSelected 
                            ? 'bg-zinc-100 text-zinc-900 border-zinc-100' 
                            : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        {metric}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Range */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-2 mb-3">
                  <Clock className="w-3 h-3" /> Time Range
                </label>
                <div className="flex gap-1.5">
                  {(['all', 'last5', 'last10'] as TimeRange[]).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`text-[10px] px-3 py-1 rounded-md border transition-all uppercase tracking-tighter font-semibold ${
                        timeRange === range 
                          ? 'bg-zinc-100 text-zinc-900 border-zinc-100' 
                          : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {range === 'all' ? 'All' : range === 'last5' ? 'Last 5' : 'Last 10'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Style */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3 h-3" /> Interpolation
                </label>
                <div className="flex gap-1.5">
                  {(['monotone', 'linear', 'step'] as Smoothing[]).map(style => (
                    <button
                      key={style}
                      onClick={() => setSmoothing(style)}
                      className={`text-[10px] px-3 py-1 rounded-md border transition-all uppercase tracking-tighter font-semibold ${
                        smoothing === style 
                          ? 'bg-zinc-100 text-zinc-900 border-zinc-100' 
                          : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#3f3f46" 
                tick={{ fill: '#71717a', fontSize: 10, fontWeight: 500 }} 
                tickMargin={12} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 10]} 
                stroke="#3f3f46" 
                tick={{ fill: '#71717a', fontSize: 10 }} 
                tickCount={6} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                align="right" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ 
                  fontSize: '10px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  fontWeight: 600,
                  opacity: 0.8
                }}
              />
              
              {selectedMetrics.map((metricName, index) => {
                const metricIndex = allMetrics.indexOf(metricName);
                const color = colors[Math.max(0, metricIndex) % colors.length];
                return (
                  <Line 
                    key={metricName}
                    type={smoothing} 
                    dataKey={metricName} 
                    stroke={color} 
                    strokeWidth={2}
                    dot={{ fill: '#09090b', stroke: color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: color, stroke: '#09090b', strokeWidth: 2 }}
                    connectNulls={true}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                );
              })}

              {/* Significant Change Markers */}
              {significantChanges.map((change, i) => {
                const metricIndex = allMetrics.indexOf(change.metric);
                const color = colors[Math.max(0, metricIndex) % colors.length];
                return (
                  <ReferenceDot
                    key={`change-${i}`}
                    x={change.time}
                    y={change.value}
                    r={8}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Change Insights */}
        {significantChanges.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Significant Shifts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {significantChanges.slice(-4).map((change, i) => {
                const metricIndex = allMetrics.indexOf(change.metric);
                const color = colors[Math.max(0, metricIndex) % colors.length];
                return (
                  <div key={i} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/30 p-2.5 rounded-lg">
                    <div className="flex-shrink-0">
                      {change.type === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-zinc-300 truncate">{change.metric}</span>
                        <span className={`text-[10px] font-mono font-bold ${change.type === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {change.type === 'up' ? '+' : '-'}{change.diff.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-[9px] text-zinc-500 font-medium">Recorded at {change.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
