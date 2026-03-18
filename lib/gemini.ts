import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Models prioritized by speed/cost to minimize rate limits as requested
// We include the user-requested models plus known working standard models as fallbacks.
const MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
];

interface GeneratorOptions {
    systemInstruction?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools?: any[]; // For Google Search tool etc.
    jsonMode?: boolean;
}

export async function generateContentWithFallback(
    prompt: string,
    options: GeneratorOptions & { validator?: (text: string) => boolean | Promise<boolean> } = {}
) {
    // We try models one by one from the prioritized list.
    const errors: any[] = [];
    
    const generateWithModel = async (modelName: string) => {
        console.log(`Trying Gemini model: ${modelName}...`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelConfig: any = {
            model: modelName,
        };

        if (options.systemInstruction) {
            modelConfig.systemInstruction = options.systemInstruction;
        }
        if (options.tools) {
            modelConfig.tools = options.tools;
        }

        const model = genAI.getGenerativeModel(modelConfig);

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        if (!text) {
            throw new Error(`Empty response from ${modelName}`);
        }

        // Custom Validation (e.g., check if it's valid JSON)
        if (options.validator) {
            const isValid = await options.validator(text);
            if (!isValid) {
                throw new Error(`Response from ${modelName} failed validation`);
            }
        }

        console.log(`Success with ${modelName}`);
        return text;
    };

    for (const model of MODELS) {
        try {
            return await generateWithModel(model);
        } catch (error: any) {
            console.warn(`Model ${model} failed:`, error.message);
            errors.push(error);
        }
    }

    throw new Error(`All Gemini models failed.\nErrors:\n${errors.map(e => (e as Error).message).join('\n')}`);
}

// Helper for JSON parsing with markdown cleanup
export async function generateJsonWithFallback(prompt: string, options: GeneratorOptions = {}) {
    // Validate that the output parses as JSON
    const text = await generateContentWithFallback(prompt, {
        ...options,
        validator: (t) => {
            try {
                const clean = t.replace(/```json|```/g, "").trim();
                JSON.parse(clean);
                return true;
            } catch {
                return false;
            }
        }
    });

    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText);
}
