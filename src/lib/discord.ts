export interface DiscordEmbed {
	title?: string;
	description?: string;
	color?: number;
	fields?: Array<{
		name: string;
		value: string;
		inline?: boolean;
	}>;
	timestamp?: string;
	footer?: {
		text: string;
	};
}

export interface DiscordWebhookPayload {
	content?: string;
	embeds?: DiscordEmbed[];
}

/**
 * Posts a message to a Discord webhook
 */
export async function postToDiscordWebhook(
	webhookUrl: string,
	payload: DiscordWebhookPayload
): Promise<void> {
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Discord webhook error (${response.status}): ${errorText}`);
	}
}

/**
 * Posts a simple text message to Discord
 */
export async function postSimpleMessageToDiscord(
	webhookUrl: string,
	message: string
): Promise<void> {
	const payload: DiscordWebhookPayload = { content: message };
	await postToDiscordWebhook(webhookUrl, payload);
}
