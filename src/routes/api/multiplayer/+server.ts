import { GEMINI_API_KEY } from '$env/static/private';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateText } from '$lib/gemini.server.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { chatDialog } = body;

		if (!chatDialog) {
			return json({ error: 'Chat dialog is required' }, { status: 400 });
		}

		// Construct the prompt.
		const prompt = `Consider the following chat dialog and decide who will be the next person to respond. Return the name of who would be most likely to say the next thing and the text of the possible response from that person.

Return your response as a JSON object with exactly these two keys:
- "nextUser": the username of who should respond next
- "message": the text of their response

Chat dialog:
${chatDialog}`;

		const options = {
			model: 'gemini-2.5-flash-lite', // gemini-2.5-flash is too slow
			temperature: 0.8
		};
		const result = await generateText(genAI, prompt, options);

		try {
			// Clean up the response by removing markdown code blocks
			let cleanedResult = result.trim();
			
			// Remove ```json at the beginning and ``` at the end
			if (cleanedResult.startsWith('```json')) {
				cleanedResult = cleanedResult.replace(/^```json\s*/, '');
			}
			if (cleanedResult.startsWith('```')) {
				cleanedResult = cleanedResult.replace(/^```\s*/, '');
			}
			if (cleanedResult.endsWith('```')) {
				cleanedResult = cleanedResult.replace(/\s*```$/, '');
			}

			// Parse the JSON response from the AI
			const parsedResult = JSON.parse(cleanedResult);
			return json(parsedResult);
		} catch (parseError) {
			// If JSON parsing fails, return an error
			console.log(parseError);
			console.error('Failed to parse AI response as JSON:', result);
			return json({ error: 'Invalid response format from AI' }, { status: 500 });
		}
	} catch (error) {
		console.error('Error in multiplayer API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
