import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { Message } from '../types';

/**
 * Extracts self-contained HTML apps and executable JavaScript from the AI's response text.
 * This function is designed to be robust against various response formats.
 *
 * @param text The raw text from the Gemini API response.
 * @returns An object with conversational text, extracted HTML, and extracted script, if any.
 */
function extractResponseParts(text: string): { text: string; html: string | null; script: string | null } {
    let conversationalText = text;
    let html: string | null = null;
    let script: string | null = null;

    // 1. Extract JavaScript code block
    const scriptRegex = /```javascript\s*([\s\S]*?)\s*```/;
    const scriptMatch = conversationalText.match(scriptRegex);
    if (scriptMatch && scriptMatch[1]) {
        script = scriptMatch[1].trim();
        conversationalText = conversationalText.replace(scriptMatch[0], '').trim();
    }

    // 2. Extract HTML content (app window)
    const htmlRegex = /(<div[^>]+class=(?:"[^"]*ai-app-window[^"]*"|'[^']*ai-app-window[^']*')[\s\S]*<\/div>)/;
    const markdownHtmlRegex = /(?:```|''')(?:html)?\s*([\s\S]*?<div[^>]+(?:class="[^"]*ai-app-window[^"]*"|class='[^']*ai-app-window[^']*')[\s\S]*?)\s*(?:```|''')/;
    
    let htmlMatch = conversationalText.match(markdownHtmlRegex);
    if (htmlMatch && htmlMatch[1]) {
        html = htmlMatch[1].trim();
        conversationalText = conversationalText.replace(htmlMatch[0], '').trim();
    } else {
        htmlMatch = conversationalText.match(htmlRegex);
        if (htmlMatch && htmlMatch[0]) {
            html = htmlMatch[0].trim();
            conversationalText = conversationalText.replace(htmlMatch[0], '').trim();
        }
    }

    // 3. Set default text if needed
    if (!conversationalText && (html || script)) {
        conversationalText = 'I have performed the requested action in the sandbox.';
    }


    return { text: conversationalText, html, script };
}

export const getAvailableModels = async (apiKey: string): Promise<string[]> => {
    if (!apiKey) {
        throw new Error("API key is required to fetch models.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.list();
        return result.pageInternal
            .filter(model => model.supportedActions && model.supportedActions.includes('generateContent'))
            .map(model => model.name.replace('models/', ''))
            .sort();
    } catch (error) {
        console.error("Gemini API Error (listing models):", error);
        throw new Error("Failed to fetch available models. Please ensure your API key is valid.");
    }
};

export const parseAiResponse = async (
    apiKey: string,
    model: string, 
    history: Message[], 
    systemInstruction: string
): Promise<{ text: string; html: string | null; script: string | null; }> => {
    if (!apiKey) {
        throw new Error("API key is required to generate content.");
    }
    
    const contents: Content[] = history
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(msg => ({
            role: msg.role as 'user' | 'model',
            parts: [{ text: msg.content }],
        }));

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        const rawText = response.text;
        return extractResponseParts(rawText);

    } catch (error: any) {
        console.error("Gemini API Error:", error);

        // Default error message
        let errorMessage = "An unexpected error occurred while contacting the Gemini API.";

        // Google AI SDK often wraps the real error in `e.cause`
        const cause = error.cause || error;
        const status = cause?.status || cause?.code;
        const message = cause?.message || error.message;

        switch (status) {
            case 'INVALID_ARGUMENT':
            case 400:
                errorMessage = "Invalid request. This may be due to an invalid API key or a malformed request. Please check your API key and model configuration.";
                break;
            case 'PERMISSION_DENIED':
            case 403:
                errorMessage = "Permission denied. This could be due to an incorrect API key, disabled billing for your project, or insufficient permissions. Please verify your API key and Google Cloud project settings.";
                break;
            case 'RESOURCE_EXHAUSTED':
            case 429:
                errorMessage = "Rate limit exceeded. You have sent too many requests in a given amount of time. Please wait a while before trying again.";
                break;
            case 'FAILED_PRECONDITION':
                 errorMessage = `API key not valid. Please pass a valid API key. ${message}`;
                 break;
            case 'INTERNAL':
            case 500:
                errorMessage = "An internal server error occurred on the Gemini API side. Please try again later.";
                break;
            case 'UNAVAILABLE':
            case 503:
                errorMessage = "The Gemini model is currently overloaded or unavailable. Please try again in a few moments.";
                break;
            default:
                if (message) {
                    errorMessage = `An error occurred: ${message}`;
                }
                break;
        }
        
        // Append more details if available
        if (cause && typeof cause === 'object') {
            const details = JSON.stringify(cause, null, 2);
            // Avoid duplicating the message if it's already in the errorMessage
            if (!errorMessage.includes(message)) {
                 errorMessage += `\nDetails: ${details}`;
            }
        }

        throw new Error(errorMessage);
    }
};