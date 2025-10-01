import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: { period: string; renewalRate: number; churnRate: number; netRetention: number }[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h3 className="text-lg font-semibold mb-4">Trend Over Time</h3>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <XAxis dataKey="period" />
          <YAxis unit="%" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="renewalRate" stroke="#16a34a" name="Renewal %" />
          <Line type="monotone" dataKey="churnRate" stroke="#dc2626" name="Churn %" />
          <Line type="monotone" dataKey="netRetention" stroke="#2563eb" name="Net Retention %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
