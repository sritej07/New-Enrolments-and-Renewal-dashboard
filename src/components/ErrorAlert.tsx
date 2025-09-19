import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
      <div className="flex items-center">
        <AlertTriangle className="text-red-500 mr-3" size={24} />
        <div className="flex-1">
          <h3 className="text-lg font-medium text-red-800">Error Loading Data</h3>
          <p className="text-red-700 mt-1">{message}</p>
          <p className="text-sm text-red-600 mt-2">
            Using demo data for visualization. Please check your Google Sheets API configuration.
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};