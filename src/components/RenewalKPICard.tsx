import React from 'react';
import { Video as LucideIcon } from 'lucide-react';

interface RenewalKPICardProps {
  title: string;
  percentage: number;
  count: number;
  total: number;
  icon: LucideIcon;
  iconColor: string;
  onClick: () => void;
  trend?: 'positive' | 'negative' | 'neutral';
}

export const RenewalKPICard: React.FC<RenewalKPICardProps> = ({
  title,
  percentage,
  count,
  total,
  icon: Icon,
  iconColor,
  onClick,
  trend = 'neutral'
}) => {
  const trendColorClass = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  }[trend];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={`p-2 rounded-full bg-gray-50 ${iconColor}`}>
          <Icon size={20} />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-bold ${trendColorClass}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        
        <button
          onClick={onClick}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
        >
          {count.toLocaleString()} of {total.toLocaleString()} students
        </button>
      </div>
    </div>
  );
};