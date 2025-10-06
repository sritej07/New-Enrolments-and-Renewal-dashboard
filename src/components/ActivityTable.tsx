import React from 'react';
import { ActivityData } from '../types/Student';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ActivityTableProps {
  title: string;
  activities: ActivityData[];
  showDropRate?: boolean;
  onActivityClick?: (activity: string) => void;
}

export const ActivityTable: React.FC<ActivityTableProps> = ({
  title,
  activities,
  showDropRate = false,
  onActivityClick
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enrollments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Renewals
              </th>
              {showDropRate && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Students
                </th>
              )}
              {showDropRate && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Drop Rate
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activities.map((activity, index) => (
              <tr 
                key={activity.activity} 
                className={`hover:bg-gray-50 transition-colors ${onActivityClick ? 'cursor-pointer' : ''}`}
                onClick={() => onActivityClick?.(activity.activity)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {index + 1}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {activity.activity}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {activity.enrollments}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-900 mr-2">
                      {activity.renewals}
                    </span>
                    <div className="text-xs text-gray-500">
                      ({activity.enrollments > 0 ? Math.round((activity.renewals / activity.enrollments) * 100) : 0}%)
                    </div>
                  </div>
                </td>
                {showDropRate && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {activity.enrollments - Math.round((activity.dropRate / 100) * activity.enrollments)}
                  </td>
                )}
                {showDropRate && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium mr-2 ${
                        activity.dropRate > 30 ? 'text-red-600' : 
                        activity.dropRate > 15 ? 'text-orange-600' : 
                        'text-green-600'
                      }`}>
                        {activity.dropRate}%
                      </span>
                      {activity.dropRate > 20 ? (
                        <TrendingUp className="text-red-500" size={16} />
                      ) : (
                        <TrendingDown className="text-green-500" size={16} />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};