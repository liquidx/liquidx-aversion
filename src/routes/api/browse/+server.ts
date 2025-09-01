import { GEMINI_API_KEY } from '$env/static/private';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateText } from '$lib/gemini.server.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { url, text } = body;

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		let textContext = '';
		if (text) {
			textContext =
				'The link text that was clicked was ' +
				text +
				'. Use this as context to determine what may be on that page.';
		}

		// Construct the prompt.
		const prompt = `Imagine you have no internet connection, but you have the cached version of any web page on the internet.
    
    Output what you think might be at the following URL at ${url} as HTML.  ${textContext}
    
    Only output everything that should be within the <html> tag including the <style> and <body> tags.
		If there are any images, they should be SVGs. Do not include any URLs to images in the output.
    Do not add any explanation to the result.
    The result should be able to be rendered in a web browser.
    Do not add any backticks.
		Generate CSS that corresponds to the era that this website would be relevant.
		`;
		const options = {
			model: 'gemini-2.5-flash-lite',
			temperature: 0.8
		};
		const result = await generateText(genAI, prompt, options);

		return json({ result });
	} catch (error) {
		console.error('Error in browse API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
