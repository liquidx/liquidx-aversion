import { GEMINI_API_KEY } from '$env/static/private';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateText } from '$lib/gemini.server.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { url } = body;

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// Construct the prompt.
		const prompt = `Imagine you have no internet connection, but you have the cached version of any web page on the internet.
    
    Output what you think might be at the following URL at ${url} as HTML.
    
    Only output the HTML and CSS of the page with no images. 
    Do not add any explanation to the result.
    The result should be able to be rendered in a web browser.
    Do not add any backticks or HTML head tags.`;
		const options = {
			model: 'gemini-2.5-flash-lite-preview-06-17',
			temperature: 0.1
		};
		const result = await generateText(genAI, prompt, options);

		return json({ result });
	} catch (error) {
		console.error('Error in browse API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
