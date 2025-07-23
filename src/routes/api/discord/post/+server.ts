import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postSimpleMessageToDiscord } from '$lib/discord.server';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content } = await request.json();

		if (!content) {
			return json({ error: 'Content is required' }, { status: 400 });
		}

		await postSimpleMessageToDiscord(content);

		return json({ success: true, message: 'Posted to Discord successfully' });
	} catch (error) {
		console.error('Error posting to Discord:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
