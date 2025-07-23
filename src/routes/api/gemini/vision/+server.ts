import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';
import { postSimpleMessageToDiscord } from '$lib/discord.server';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { prompt, image } = await request.json();

		if (!prompt || !image) {
			return json({ error: 'Both prompt and image are required' }, { status: 400 });
		}

		if (!GEMINI_API_KEY) {
			return json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
		
		// Convert base64 image to the format Gemini expects
		const imageData = {
			inlineData: {
				data: image.split(',')[1], // Remove data:image/png;base64, prefix
				mimeType: 'image/png'
			}
		};

		const modelRequest = {
			model: 'gemini-2.5-flash-lite-preview-06-17',
			contents: [
				{
					parts: [
						{ text: prompt },
						imageData
					]
				}
			],
			generationConfig: {
				temperature: 0.7,
				topK: 40,
				topP: 0.95,
				maxOutputTokens: 8192
			}
		};

		const response = await ai.models.generateContent(modelRequest);

		// log the request to discord
		if (response.text) {
			const ip = getClientAddress();
			const url = request.headers.get('referer') || 'no-referrer';
			const message = `Gemini Vision[${ip}] ${url}: ${prompt.substring(0, 100)}...`;
			await postSimpleMessageToDiscord(message);
		}

		return json({ response: response.text });
	} catch (error) {
		console.error('Error calling Gemini Vision API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};