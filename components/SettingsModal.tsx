
import React, { useState, useEffect } from 'react';
import { Prompt } from '../types';
import { PlusIcon, SaveIcon, TrashIcon, CheckCircleIcon, XCircleIcon, SparklesIcon } from './icons/Icons';

type VerificationState = 'unverified' | 'verifying' | 'verified' | 'error';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  prompts: Prompt[];
  onPromptsChange: (prompts: Prompt[]) => void;
  onVerify: (apiKey: string) => Promise<void>;
  isVerifying: boolean;
  models: string[];
  verificationState: VerificationState;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, apiKey, onApiKeyChange, selectedModel, onModelChange, prompts, onPromptsChange, onVerify, isVerifying, models, verificationState
}) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localSelectedModel, setLocalSelectedModel] = useState(selectedModel);
  const [localPrompts, setLocalPrompts] = useState<Prompt[]>(prompts);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setLocalSelectedModel(selectedModel);
  }, [selectedModel]);

  const handleSave = () => {
    onApiKeyChange(localApiKey);
    onModelChange(localSelectedModel);
    onPromptsChange(localPrompts);
    onClose();
  };

  const handleVerify = async () => {
    await onVerify(localApiKey);
  };

  const handlePromptChange = (index: number, field: 'name' | 'content', value: string) => {
    const newPrompts = [...localPrompts];
    newPrompts[index] = { ...newPrompts[index], [field]: value };
    setLocalPrompts(newPrompts);
  };

  const addPrompt = () => {
    setLocalPrompts([...localPrompts, {id: Date.now().toString(), name: 'New Prompt', content: ''}]);
  };

  const removePrompt = (index: number) => {
    if (localPrompts.length > 1) {
        setLocalPrompts(localPrompts.filter((_, i) => i !== index));
    } else {
        alert("You cannot delete the last prompt.");
    }
  };


  if (!isOpen) return null;

  const getVerificationIcon = () => {
    switch (verificationState) {
      case 'verified':
        return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-400" />;
      case 'verifying':
        return <SparklesIcon className="w-5 h-5 text-yellow-400 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-gray-200 border border-gray-700">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        
        {/* API Key Section */}
        <div className="mb-6">
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-400 mb-1">Gemini API Key</label>
          <div className="flex items-center space-x-2">
            <input
              id="apiKey"
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button 
              onClick={handleVerify}
              disabled={isVerifying || !localApiKey}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md flex items-center justify-center w-48 disabled:bg-gray-500"
            >
              {isVerifying ? 'Verifying...' : 'Verify & Load Models'}
            </button>
            <div className="w-6 h-6 flex items-center justify-center">{getVerificationIcon()}</div>
          </div>
           {verificationState === 'error' && <p className="text-red-400 text-xs mt-1">Verification failed. Please check your API key and try again.</p>}
           {verificationState === 'verified' && <p className="text-green-400 text-xs mt-1">API Key verified successfully!</p>}
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label htmlFor="model" className="block text-sm font-medium text-gray-400 mb-1">AI Model</label>
          <select
            id="model"
            value={localSelectedModel}
            onChange={(e) => setLocalSelectedModel(e.target.value)}
            disabled={verificationState !== 'verified'}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
          >
            {verificationState === 'verified' ? (
              models.map(m => <option key={m} value={m}>{m}</option>)
            ) : (
              <option>Verify API key to load models</option>
            )}
          </select>
        </div>

        {/* Prompts Section */}
        <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Custom Prompts</h3>
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {localPrompts.map((prompt, index) => (
                    <div key={prompt.id} className="bg-gray-700 p-3 rounded-md">
                        <div className="flex justify-between items-center mb-2">
                            <input
                                type="text"
                                value={prompt.name}
                                onChange={(e) => handlePromptChange(index, 'name', e.target.value)}
                                className="bg-gray-600 font-semibold rounded p-1 w-1/3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                             <button onClick={() => removePrompt(index)} className="p-1 rounded-full hover:bg-gray-600">
                                <TrashIcon className="w-4 h-4 text-red-400"/>
                            </button>
                        </div>
                        <textarea
                            value={prompt.content}
                            onChange={(e) => handlePromptChange(index, 'content', e.target.value)}
                            rows={3}
                            className="w-full bg-gray-600 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                ))}
            </div>
             <button onClick={addPrompt} className="mt-2 flex items-center space-x-2 text-sm text-indigo-400 hover:text-indigo-300">
                <PlusIcon className="w-4 h-4"/>
                <span>Add Prompt</span>
            </button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">
            Cancel
          </button>
          <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-md flex items-center space-x-2">
            <SaveIcon className="w-5 h-5"/>
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
