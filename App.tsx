import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { Sandbox } from './components/Sandbox';
import { SettingsModal } from './components/SettingsModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Message, Prompt } from './types';
import { parseAiResponse, getAvailableModels } from './services/geminiService';

type VerificationState = 'unverified' | 'verifying' | 'verified' | 'error';

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useLocalStorage('geminiApiKey', '');
  const [selectedModel, setSelectedModel] = useLocalStorage('selectedModel', 'gemini-1.5-flash');
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>('customPrompts', [{ id: '1', name: 'Default', content: `You are an expert AI assistant and developer. Your primary role is to build and interact with a virtual desktop environment for the user.

**CREATION**: When asked to "create", "build", or "make" an app, tool, or game, you must respond with a JSON object followed by the HTML content in a markdown block.

The JSON object must have a 'title' key.
Example:
\`\`\`json
{
  "title": "Pixel Art Editor"
}
\`\`\`

\`\`\`html
<div class="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4">
  <canvas id="pixel-canvas" class="border border-gray-600 cursor-crosshair"></canvas>
  <div class="mt-4 flex space-x-2">
    <input type="color" id="color-picker" value="#ffffff">
    <button id="clear-btn" class="px-4 py-2 bg-red-600 rounded">Clear</button>
  </div>
</div>
<script>
  // Your JavaScript logic here
</script>
\`\`\`

The HTML should be self-contained, use TailwindCSS classes for styling, and include any necessary JavaScript within a <script> tag. The HTML represents the *content* of an application window, not the window itself.

**INTERACTION**: To interact with an existing app (e.g., play a game, add a customer), respond ONLY with a JavaScript code block enclosed in \`\`\`javascript ... \`\`\`. This script will be executed inside the sandbox. Use document.getElementById() and other DOM methods to manipulate the apps you created. After the script, you can add a short confirmation message.` }]);
  const [chatHistory, setChatHistory] = useLocalStorage<Message[]>('chatHistory', []);
  const [apps, setApps] = useLocalStorage<{ title: string; html: string }[]>('apps', []);
  const [isLoading, setIsLoading] = useState(false);

  // State for API key verification and model loading
  const [availableModels, setAvailableModels] = useLocalStorage<string[]>('availableModels', []);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationState, setVerificationState] = useLocalStorage<VerificationState>('verificationState', 'unverified');

  // Transient state for messaging the iframe
  const [newApp, setNewApp] = useState<{ title: string; html: string } | null>(null);
  const [scriptToRun, setScriptToRun] = useState<string | null>(null);
  const [clearSandbox, setClearSandbox] = useState<boolean>(false);
  const [appsToRestore, setAppsToRestore] = useState<{ title: string; html: string }[]>([]);

  useEffect(() => {
    if (!apiKey) {
      setIsSettingsOpen(true);
    }
    // On initial load, set the apps to be restored from localStorage
    setAppsToRestore(apps);
  }, [apiKey, apps]);

  const handleVerifyApiKey = useCallback(async (keyToVerify: string) => {
    setIsVerifying(true);
    setVerificationState('verifying');
    try {
      const models = await getAvailableModels(keyToVerify);
      setAvailableModels(models);
      setVerificationState('verified');
      // If there's no selected model or the old one isn't in the new list, default to the first one
      if (!selectedModel || !models.includes(selectedModel)) {
        setSelectedModel(models[0] || '');
      }
    } catch (error) {
      console.error(error);
      setVerificationState('error');
      setAvailableModels([]);
    } finally {
      setIsVerifying(false);
    }
  }, [setAvailableModels, setVerificationState, selectedModel, setSelectedModel]);

  const handleSendMessage = useCallback(async (message: string, systemPrompt?: string) => {
    if (!apiKey || verificationState !== 'verified') {
        setIsSettingsOpen(true);
        // Optionally, add a message to the user
        setChatHistory(prev => [...prev, { role: 'model', content: 'Please set and verify your Gemini API key in the settings before sending a message.' }]);
        return;
    }

    const newMessage: Message = { role: 'user', content: message };
    const updatedHistory = [...chatHistory, newMessage];
    setChatHistory(updatedHistory);
    setIsLoading(true);

    try {
      const activePrompt = systemPrompt || prompts.find(p => p.name === 'Default')?.content || '';
      const response = await parseAiResponse(apiKey, selectedModel, updatedHistory, activePrompt);

      setChatHistory(prev => [...prev, { role: 'model', content: response.text }]);

      if (response.html && response.title) {
        const newAppPayload = { title: response.title, html: response.html };
        setApps(prevApps => [...prevApps, newAppPayload]);
        setNewApp(newAppPayload);
      }
      if (response.script) {
          setScriptToRun(response.script);
      }

    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setChatHistory(prev => [...prev, { role: 'model', content: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, verificationState, selectedModel, chatHistory, setChatHistory, prompts, setIframeContent]);


  return (
    <div className="flex flex-col h-screen font-sans bg-gray-900 text-gray-100">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex flex-1 overflow-hidden">
        <ChatPanel 
          history={chatHistory} 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
          prompts={prompts}
          clearChat={() => {
              setChatHistory([]);
              setApps([]); // Clear the apps from state and localStorage
              setClearSandbox(true);
          }}
        />
        <Sandbox
            appsToRestore={appsToRestore}
            newApp={newApp}
            onAppAdded={() => setNewApp(null)}
            scriptToRun={scriptToRun}
            onScriptRun={() => setScriptToRun(null)}
            clear={clearSandbox}
            onClear={() => setClearSandbox(false)}
        />
      </main>
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          prompts={prompts}
          onPromptsChange={setPrompts}
          models={availableModels}
          isVerifying={isVerifying}
          verificationState={verificationState}
          onVerify={handleVerifyApiKey}
        />
      )}
    </div>
  );
};

export default App;
