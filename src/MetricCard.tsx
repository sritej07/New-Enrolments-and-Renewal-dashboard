import React from 'react';
import { InfoTooltip } from './InfoTooltip';

interface MetricCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    iconColor: string;
    description?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, iconColor, description }) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between border border-gray-100 relative">
            <div>
                <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-gray-500">{title}</h4>
                    {description && <InfoTooltip description={description} />}
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
            <div className={`p-3 rounded-full bg-gray-50 ${iconColor}`}>
                <Icon size={24} />
            </div>
        </div>
    );
};