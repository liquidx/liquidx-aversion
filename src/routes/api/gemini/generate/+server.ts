import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { prompt } = await request.json();

		if (!prompt) {
			return json({ error: 'Prompt is required' }, { status: 400 });
		}

		if (!GEMINI_API_KEY) {
			return json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
		const modelRequest = {
			model: 'gemini-2.5-flash',
			contents: prompt,
			generationConfig: {
				temperature: 0.7,
				topK: 40,
				topP: 0.95,
				maxOutputTokens: 8192
			}
		};
		const response = await ai.models.generateContent(modelRequest);
		return json({ response: response.text });
	} catch (error) {
		console.error('Error calling Gemini API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
