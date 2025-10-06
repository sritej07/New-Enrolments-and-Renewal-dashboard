import React from 'react';
import { Divide as LucideIcon } from 'lucide-react';

interface ClickableMetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  onClick: () => void;
}

export const ClickableMetricCard: React.FC<ClickableMetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'text-blue-600',
  onClick
}) => {
  const changeColorClass = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-500'
  }[changeType];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <button
            onClick={onClick}
            className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
          >
            {value}
          </button>
          {change && (
            <p className={`text-sm mt-2 ${changeColorClass}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full bg-gray-50 ${iconColor}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};