
import React from 'react';
import { GearIcon, SparklesIcon } from './icons/Icons';

interface HeaderProps {
  onSettingsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  return (
    <header className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 shadow-md flex-shrink-0">
      <div className="flex items-center space-x-3">
        <SparklesIcon className="w-6 h-6 text-indigo-400" />
        <h1 className="text-xl font-bold text-gray-100">AI Studio Sandbox</h1>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          aria-label="Settings"
        >
          <GearIcon className="w-6 h-6 text-gray-300" />
        </button>
      </div>
    </header>
  );
};
