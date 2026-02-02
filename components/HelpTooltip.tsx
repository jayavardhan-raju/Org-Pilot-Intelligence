import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  text: string;
  className?: string;
  size?: number;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, className = "", size = 16 }) => {
  return (
    <div className={`group relative inline-flex items-center justify-center ${className}`}>
      <HelpCircle 
        size={size} 
        className="text-slate-400 hover:text-blue-500 cursor-help transition-colors" 
        aria-label="Help information"
      />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 text-center leading-relaxed">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
};
