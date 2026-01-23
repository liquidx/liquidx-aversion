import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';
import { postSimpleMessageToDiscord } from '$lib/discord.server';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { prompt, model, generationConfig } = await request.json();

		if (!prompt) {
			return json({ error: 'Prompt is required' }, { status: 400 });
		}

		if (!GEMINI_API_KEY) {
			return json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

		// Use provided model or default to gemini-2.5-flash-lite
		const modelName = model || 'gemini-2.5-flash-lite';

		// Merge provided generationConfig with defaults
		const defaultConfig = {
			temperature: 0.7,
			topK: 40,
			topP: 0.95,
			maxOutputTokens: 8192
		};
		const finalConfig = { ...defaultConfig, ...generationConfig };

		const modelRequest = {
			model: modelName,
			contents: prompt,
			generationConfig: finalConfig
		};
		const response = await ai.models.generateContent(modelRequest);

		// log the request to discord
		if (response.text) {
			const ip = getClientAddress();
			const url = request.headers.get('referer') || 'no-referrer';
			const message = `Gemini[${modelName}][${ip}] ${url}`;
			await postSimpleMessageToDiscord(message);
		}

		return json({ response: response.text });
	} catch (error) {
		console.error('Error calling Gemini API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
