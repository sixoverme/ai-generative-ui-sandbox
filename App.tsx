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

**CREATION**: When asked to "create", "build", or "make" an app, tool, or game, respond ONLY with a single, self-contained HTML structure. The HTML must use TailwindCSS and include necessary JS in <script> tags.

The root element must be a div with the following attributes:
- class="ai-app-window"
- A unique id attribute (e.g., id="pixel-art-editor")
- Style attribute for initial position and size (e.g., style="position: absolute; top: 100px; left: 150px; width: 400px; height: 300px;")

The window structure must be as follows:
1.  **Main Container**: The \`ai-app-window\` div. It should be a flex container with a column layout.
2.  **Header**: A draggable \`div\` with \`class="ai-app-header"\`. It should be a flex container with items aligned to the center.
    -   **Title**: A \`span\` with \`class="app-title-text"\` for the application title.
    -   **Window Controls**: A container \`div\` with \`class="window-controls"\` for the buttons.
        -   **Minimize Button**: A \`button\` with \`class="btn-min"\`.
        -   **Maximize Button**: A \`button\` with \`class="btn-max"\`.
        -   **Close Button**: A \`button\` with \`class="btn-close"\`.
3.  **Content**: A \`div\` with \`class="ai-app-content"\` where the main application interface will reside.
4.  **Resizers**: Eight \`div\` elements for resizing the window, with classes like \`resizer resizer-tl\`, \`resizer resizer-t\`, etc.

**INTERACTION**: To interact with an existing app (e.g., play a game, add a customer), respond with a JavaScript code block enclosed in \`\`\`javascript ... \`\`\`. This script will be executed inside the sandbox. Use document.getElementById() and other DOM methods to manipulate the apps you created. After the script, you can add a short confirmation message.` }]);
  const [chatHistory, setChatHistory] = useLocalStorage<Message[]>('chatHistory', []);
  const [iframeContent, setIframeContent] = useLocalStorage('iframeContent', '');
  const [isLoading, setIsLoading] = useState(false);

  // State for API key verification and model loading
  const [availableModels, setAvailableModels] = useLocalStorage<string[]>('availableModels', []);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationState, setVerificationState] = useLocalStorage<VerificationState>('verificationState', 'unverified');


  // Transient state for messaging the iframe
  const [newAppHtml, setNewAppHtml] = useState<string | null>(null);
  const [scriptToRun, setScriptToRun] = useState<string | null>(null);
  const [clearSandbox, setClearSandbox] = useState<boolean>(false);

  useEffect(() => {
    if (!apiKey) {
      setIsSettingsOpen(true);
    }
  }, [apiKey]);

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

      if (response.html) {
          setIframeContent(prev => prev + response.html);
          setNewAppHtml(response.html);
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
              setIframeContent('');
              setClearSandbox(true);
          }}
        />
        <Sandbox 
            initialContent={iframeContent}
            newAppHtml={newAppHtml}
            onAppAdded={() => setNewAppHtml(null)}
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
