import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GenerateTextOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

export async function generateText(
	genAI: GoogleGenerativeAI,
	prompt: string,
	options: GenerateTextOptions = {}
): Promise<string> {
	const {
		model = 'gemini-2.5-flash-lite-preview-06-17',
		temperature = 0.1,
		maxTokens = 10000
	} = options;

	try {
		const generativeModel = genAI.getGenerativeModel({
			model,
			generationConfig: {
				temperature,
				maxOutputTokens: maxTokens
			}
		});

		const result = await generativeModel.generateContent(prompt);
		const response = await result.response;
		return response.text();
	} catch (error) {
		console.error('Error generating text with Gemini:', error);
		throw error;
	}
}
