import { json } from '@sveltejs/kit';
import { FAL_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { fal } from '@fal-ai/client';

export type FALSAMBox = [number, number, number, number];

export type FALSAMResponse = {
	image: {
		url: string;
		width: number;
		height: number;
	};
	masks: {
		url: string;
		width: number;
		height: number;
		content_type: string; // image/png
	}[];
	metadata: {
		index: number;
		box: FALSAMBox;
		score: number;
	}[];
	scores: any;
	boxes: FALSAMBox[];
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { image_url, prompt } = await request.json();

		if (!image_url) {
			return json({ error: 'image_url is required' }, { status: 400 });
		}

		if (!FAL_API_KEY) {
			return json({ error: 'FAL_API_KEY not configured' }, { status: 500 });
		}

		console.log(`Calling FAL SAM API for prompt: ${prompt || 'wheel'}`);

		fal.config({
			credentials: FAL_API_KEY
		});

		const result = await fal.subscribe('fal-ai/sam-3/image', {
			input: {
				image_url,
				prompt: prompt || 'snowboard',
				apply_mask: true,
				output_format: 'png',
				return_multiple_masks: true,
				max_masks: 20,
				include_boxes: true
			},
			logs: true,
			onQueueUpdate: (update) => {
				// if (update.status === 'IN_PROGRESS' && update.logs) {
				// 	update.logs.map((log) => log.message).forEach((msg) => console.log(msg));
				// }
			}
		});

		console.log('FAL SAM API success: masks=', result.data.masks.length);
		return json({ response: result.data as FALSAMResponse });
	} catch (error) {
		console.error('Error calling FAL SAM API:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
