import React from 'react';
import { CalendarDays, Filter } from 'lucide-react';

interface FilterPanelProps {
  selectedPeriod: 'quarter' | 'year' | 'custom';
  customMonths: number;
  onPeriodChange: (period: 'quarter' | 'year' | 'custom') => void;
  onCustomMonthsChange: (months: number) => void;
  onRefresh: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedPeriod,
  customMonths,
  onPeriodChange,
  onCustomMonthsChange,
  onRefresh
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="text-gray-500" size={20} />
            <span className="text-sm font-medium text-gray-700">Time Period:</span>
          </div>
          
          <div className="flex space-x-2">
            {[
              { value: 'quarter', label: 'Last Quarter' },
              { value: 'year', label: 'Last Year' },
              { value: 'custom', label: 'Custom' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onPeriodChange(value as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="60"
                value={customMonths}
                onChange={(e) => onCustomMonthsChange(parseInt(e.target.value) || 6)}
                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-sm text-gray-600">months</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center text-sm text-gray-500">
            <CalendarDays size={16} className="mr-1" />
            Last updated: {new Date().toLocaleString()}
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};