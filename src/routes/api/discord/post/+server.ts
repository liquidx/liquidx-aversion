import { json } from '@sveltejs/kit';
import { DISCORD_WEBHOOK_URL } from '$env/static/private';
import type { RequestHandler } from './$types';
import { postSimpleMessageToDiscord } from '$lib/discord';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content } = await request.json();

		if (!content) {
			return json({ error: 'Content is required' }, { status: 400 });
		}

		if (!DISCORD_WEBHOOK_URL) {
			return json({ error: 'DISCORD_WEBHOOK_URL not configured' }, { status: 500 });
		}

		await postSimpleMessageToDiscord(DISCORD_WEBHOOK_URL, content);

		return json({ success: true, message: 'Posted to Discord successfully' });
	} catch (error) {
		console.error('Error posting to Discord:', error);
		return json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
};