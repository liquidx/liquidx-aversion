import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';
import { postSimpleMessageToDiscord } from '$lib/discord.server';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { prompt, image, images: providedImages } = await request.json();

		const imagesToProcess = providedImages || (image ? [image] : []);

		if (!prompt || imagesToProcess.length === 0) {
			return json({ error: 'Both prompt and at least one image are required' }, { status: 400 });
		}

		if (!GEMINI_API_KEY) {
			return json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
		const imageParts: any[] = [];

		for (const imgUrlStr of imagesToProcess) {
			let inlineDataStr = '';
			let mimeType = 'image/png';

			if (imgUrlStr.startsWith('http')) {
				const res = await fetch(imgUrlStr);
				if (!res.ok) {
					return json({ error: `Failed to fetch image URL: ${res.statusText}` }, { status: 400 });
				}
				const arrayBuffer = await res.arrayBuffer();
				const bytes = new Uint8Array(arrayBuffer);
				let binary = '';
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				inlineDataStr = btoa(binary);
				mimeType = res.headers.get('content-type') || 'image/png';
			} else {
				inlineDataStr = imgUrlStr.split(',')[1]; // Remove data:image/...;base64, prefix
			}

			imageParts.push({
				inlineData: {
					data: inlineDataStr,
					mimeType
				}
			});
		}

		const modelRequest = {
			model: 'gemini-2.5-flash-lite-preview-06-17',
			contents: [
				{
					parts: [{ text: prompt }, ...imageParts]
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
