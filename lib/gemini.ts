import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Models prioritized by speed/cost to minimize rate limits as requested
// We include the user-requested models plus known working standard models as fallbacks.
const MODELS = [
    "gemini-2.5-flash",      // Latest stable flash
    "gemini-2.0-flash",      // Previous stable flash
    "gemini-flash-latest",   // Alias for latest flash
    "gemini-pro-latest",     // Fallback to Pro
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
    // Determine models to use. Running all 4 at once might hit rate limits faster,
    // so let's try top 3 fastest models concurrently.
    const CONCURRENT_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-flash-latest"
    ];

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

    try {
        // Run requests concurrently and return the fastest successful result
        const fastestResponse = await Promise.any(
            CONCURRENT_MODELS.map(model => generateWithModel(model))
        );
        return fastestResponse;
    } catch (aggregateError: any) {
        // If all instances in Promise.any fail, try the ultimate fallback sequentially 
        // just in case it was a temporary rate limit burst
        console.warn(`Concurrent models failed. Falling back to gemini-pro-latest. Errors:`, aggregateError.errors);

        try {
            return await generateWithModel("gemini-pro-latest");
        } catch (finalError: any) {
            throw new Error(`All Gemini models failed including fallback.\nErrors:\n${aggregateError.errors?.join('\n')}\nFinal fallback error: ${finalError.message}`);
        }
    }
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
