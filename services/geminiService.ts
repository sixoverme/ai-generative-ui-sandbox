import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { Message } from '../types';

/**
 * Extracts self-contained HTML apps and executable JavaScript from the AI's response text.
 * This function is designed to be robust against various response formats.
 *
 * @param text The raw text from the Gemini API response.
 * @returns An object with conversational text, extracted title, HTML, and script, if any.
 */
function extractResponseParts(text: string): { text: string; title: string | null; html: string | null; script: string | null } {
    let conversationalText = text;
    let title: string | null = null;
    let html: string | null = null;
    let script: string | null = null;

    // 1. Extract JavaScript code block (for interaction)
    const scriptRegex = /```javascript\s*([\s\S]*?)\s*```/;
    const scriptMatch = conversationalText.match(scriptRegex);
    if (scriptMatch && scriptMatch[1]) {
        script = scriptMatch[1].trim();
        conversationalText = conversationalText.replace(scriptMatch[0], '').trim();
    }

    // 2. Extract JSON block for the title
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = conversationalText.match(jsonRegex);
    if (jsonMatch && jsonMatch[1]) {
        try {
            const parsedJson = JSON.parse(jsonMatch[1]);
            if (parsedJson && parsedJson.title) {
                title = parsedJson.title;
            }
        } catch (e) {
            console.error("Failed to parse title JSON:", e);
        }
        conversationalText = conversationalText.replace(jsonMatch[0], '').trim();
    }

    // 3. Extract HTML content
    const htmlRegex = /```html\s*([\s\S]*?)\s*```/;
    const htmlMatch = conversationalText.match(htmlRegex);
    if (htmlMatch && htmlMatch[1]) {
        html = htmlMatch[1].trim();
        conversationalText = conversationalText.replace(htmlMatch[0], '').trim();
    }

    // 4. Set default text if needed
    if (!conversationalText && (html || script)) {
        conversationalText = 'I have performed the requested action in the sandbox.';
    }

    return { text: conversationalText, title, html, script };
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
): Promise<{ text: string; title: string | null; html: string | null; script: string | null; }> => {
    if (!apiKey) {
        throw new Error("API key is required to generate content.");
    }
    
    const contents: Content[] = history.map(msg => ({
        role: msg.role,
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

    } catch (error: any) { // Use 'any' to access error properties dynamically
        console.error("Gemini API Error:", error);
        if (error && error.code === 503 && error.message && error.message.includes("overloaded")) {
            throw new Error("The Gemini model is currently overloaded. Please try again in a few moments.");
        }
        throw new Error("Failed to get response from Gemini API. Check your model configuration and API key.");
    }
};