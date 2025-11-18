
import React, { useState, useRef, useEffect } from 'react';
import { Message, Prompt } from '../types';
import { SendIcon, TrashIcon, SparklesIcon, UserIcon } from './icons/Icons';

interface ChatPanelProps {
  history: Message[];
  onSendMessage: (message: string, systemPrompt?: string) => void;
  isLoading: boolean;
  prompts: Prompt[];
  clearChat: () => void;
}

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isModel = message.role === 'model';
  return (
    <div className={`flex items-start gap-3 my-4 ${isModel ? '' : 'flex-row-reverse'}`}>
       <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isModel ? 'bg-indigo-500' : 'bg-gray-600'}`}>
        {isModel ? <SparklesIcon className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
      </div>
      <div className={`p-3 rounded-lg max-w-md ${isModel ? 'bg-gray-700' : 'bg-blue-600 text-white'}`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ history, onSendMessage, isLoading, prompts, clearChat }) => {
  const [input, setInput] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>(prompts[0]?.id || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
      onSendMessage(input, selectedPrompt?.content);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col w-full md:w-1/3 max-w-lg bg-gray-800 border-r border-gray-700">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Chat</h2>
        <button onClick={clearChat} className="p-2 rounded-md hover:bg-gray-700" aria-label="Clear chat">
            <TrashIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {history.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
         {isLoading && (
            <div className="flex items-start gap-3 my-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500">
                    <SparklesIcon className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div className="p-3 rounded-lg max-w-md bg-gray-700">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="bg-gray-700 rounded-lg p-2 flex flex-col">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full bg-transparent text-gray-200 placeholder-gray-400 focus:outline-none resize-none"
                rows={2}
                disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-2">
                <select 
                    value={selectedPromptId}
                    onChange={(e) => setSelectedPromptId(e.target.value)}
                    className="bg-gray-600 text-xs rounded p-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {prompts.map(prompt => (
                        <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                    ))}
                </select>
                <button 
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="p-2 rounded-full bg-indigo-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-indigo-500"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
