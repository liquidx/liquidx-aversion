export async function callGemini(prompt: string): Promise<string> {
	try {
		const response = await fetch('/api/gemini/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ prompt })
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || 'Failed to call Gemini API');
		}

		const data = await response.json();
		return data.response;
	} catch (error) {
		console.error('Error calling Gemini API:', error);
		throw error;
	}
}
