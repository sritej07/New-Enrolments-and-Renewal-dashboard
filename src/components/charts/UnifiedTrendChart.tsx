import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendData } from '../../types/UnifiedTypes';

interface UnifiedTrendChartProps {
  data: TrendData[];
}

export const UnifiedTrendChart: React.FC<UnifiedTrendChartProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Over Time</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis unit="%" />
          <Tooltip 
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="renewalRate" 
            stroke="#16a34a" 
            name="Renewal %" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="churnRate" 
            stroke="#dc2626" 
            name="Churn %" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="retentionRate" 
            stroke="#2563eb" 
            name="Retention %" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="netGrowthRate" 
            stroke="#ea580c" 
            name="Net Growth %" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};