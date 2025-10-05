import type { ChangeEvent } from "react";
import type { Inputs } from "../lib/types";

export const MetricCard: React.FC<{ title: string; value: React.ReactNode; subtitle?: string; icon?: React.ComponentType<any>; }> = ({ title, value, subtitle, icon: Icon }) => (
  <div className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-700">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-indigo-300">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {Icon && <div className="bg-indigo-700/20 p-2 rounded-md"><Icon className="w-6 h-6 text-indigo-300" /></div>}
    </div>
  </div>
);

export const ProgressBar: React.FC<{ label: string; value: number; max?: number; compact?: boolean }> = ({ label, value, max = 70, compact }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={`${compact ? 'text-xs' : ''}`}>
      <div className="flex justify-between mb-1">
        <span className="text-gray-300 font-medium">{label}</span>
        <span className="text-gray-400 font-mono">{value}{compact ? ' hrs' : ''}</span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
        <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};


export const Card: React.FC<{ title: string; icon?: React.ComponentType<any>; children: React.ReactNode; className?: string; }> = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-gray-800 p-6 rounded-xl shadow-md border ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-indigo-300 flex items-center">
        {Icon && <Icon className="w-5 h-5 mr-3 text-indigo-300" />}
        {title}
      </h2>
    </div>
    {children}
  </div>
);

export const InputGroup: React.FC<{ label: string; name: keyof Inputs; value: string | number; onChange: (e: ChangeEvent<HTMLInputElement>) => void; placeholder: string; icon: React.ComponentType<any>; type?: string; min?: number; max?: number; children?: React.ReactNode }> = ({ label, name, value, onChange, placeholder, icon: Icon, type = 'text', min = 0, max = 100 }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type={type}
        name={String(name)}
        id={String(name)}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="block w-full rounded-lg border-0 py-2 pl-10 pr-4 bg-gray-900 text-white placeholder-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition duration-150"
      />
    </div>
  </div>
);
