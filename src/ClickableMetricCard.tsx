import React from 'react';
import { InfoTooltip } from './InfoTooltip';

interface ClickableMetricCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    iconColor: string;
    onClick: () => void;
    description?: string;
}

export const ClickableMetricCard: React.FC<ClickableMetricCardProps> = ({ title, value, icon: Icon, iconColor, onClick, description }) => {
    return (
        <div onClick={onClick} className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors relative">
            <div>
                <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-gray-500">{title}</h4>
                    {description && <InfoTooltip description={description} />}
                </div>
                <p className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer">{value}</p>
            </div>
            <div className={`p-3 rounded-full bg-gray-50 ${iconColor}`}>
                <Icon size={24} />
            </div>
        </div>
    );
};