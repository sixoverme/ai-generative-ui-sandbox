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
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>('customPrompts', [{ id: '1', name: 'Default', content: 
    "You are an expert AI assistant and developer. Your primary role is to build and interact with a virtual desktop environment for the user.\n\n" +
    "### Rules\n\n" +
    "1.  **App Creation**: When asked to create an app, respond *only* with a single, self-contained HTML structure.\n" +
    "    *   The root element must be a `div` with a unique `id`.\n" +
    "    *   The app's HTML and CSS (via Tailwind classes) must be self-contained.\n" +
    "    *   Any necessary JavaScript for the app to function must be in a single `<script>` tag.\n" +
    "    *   **CRITICAL**: The final line of your app's `<script>` tag MUST dispatch a custom event to signal when it is ready. Example: `window.dispatchEvent(new CustomEvent('app-ready', { detail: { appId: 'your-app-id' } }));`\n\n" +
    "2.  **App Interaction**: When asked to interact with an app, respond *only* with a JavaScript code block.\n" +
    "    *   **MANDATORY**: The very first line of your script MUST be a comment specifying the target app's ID. Example: `// Target App: your-app-id`\n" +
    "    *   **IMPORTANT**: If you do not provide the target app ID, the system will attempt to run your script on the most recently used application. This may lead to unexpected behavior.\n" +
    "    *   You can assume the app's DOM elements are available when your script runs.\n\n" +
    "3.  **Conversational Responses**: Do not engage in conversational chit-chat. Respond only with the requested HTML or JavaScript code. Any additional explanatory text should be included as comments within the code itself.\n\n" +
    "### Examples\n\n" +
    "**Creation Example (Pixel Art Editor):**\n" +
    "```html\n" +
    "<div id=\"pixel-art-editor\">\n" +
    "  <div id=\"pixel-grid\"></div>\n" +
    "  <script>\n" +
    "    function createPixelGrid() {\n" +
    "      const grid = document.getElementById('pixel-grid');\n" +
    "      for (let i = 0; i < 1024; i++) {\n" +
    "        const pixel = document.createElement('div');\n" +
    "        pixel.className = 'pixel';\n" +
    "        grid.appendChild(pixel);\n" +
    "      }\n" +
    "    }\n" +
    "    createPixelGrid();\n" +
    "    window.dispatchEvent(new CustomEvent('app-ready', { detail: { appId: 'pixel-art-editor' } }));\n" +
    "  </script>\n" +
    "</div>\n" +
    "```\n\n" +
    "**Interaction Example (Coloring a pixel):**\n" +
    "```javascript\n" +
    "// Target App: pixel-art-editor\n" +
    "const pixel = document.querySelector('#pixel-art-editor #pixel-grid .pixel:nth-child(42)');\n" +
    "if (pixel) {\n" +
    "  pixel.style.backgroundColor = 'red';\n" +
    "  console.log('Successfully colored pixel red.');\n" +
    "} else {\n" +
    "  console.error('Could not find pixel #42.');\n" +
    "}\n" +
    "```\n" +
    "After the script block, you may add a short confirmation message."
  }]);
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

  // Effect to handle messages from the sandbox iframe
  useEffect(() => {
    const handleSandboxMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'INTERACTION_FAILED') {
        setIsLoading(false);
        setChatHistory(prev => [
          ...prev,
          {
            role: 'system_error',
            content: `System Correction: Your previous script failed because it did not follow the required format. \n\nReason: ${payload.reason}\n\nPlease try the action again, making sure your script starts with the comment 
// Target App: <app-id>
.`
          }
        ]);
      }
    };

    window.addEventListener('message', handleSandboxMessage);
    return () => {
      window.removeEventListener('message', handleSandboxMessage);
    };
  }, [setChatHistory, setIsLoading]);

  const handleSendMessage = useCallback(async (message: string, systemPrompt?: string) => {
    if (!apiKey || verificationState !== 'verified') {
        setIsSettingsOpen(true);
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
      setChatHistory(prev => [...prev, { role: 'error', content: errorMessage }]);
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