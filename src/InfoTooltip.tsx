import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  description: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ description }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-center">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
            e.stopPropagation(); // Prevent card's onClick from firing
            setShow(!show);
        }}
        className="text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        <Info size={16} />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-20" onClick={(e) => e.stopPropagation()}>
          {description}
        </div>
      )}
    </div>
  );
};