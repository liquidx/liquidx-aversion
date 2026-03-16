import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';

const ARGS = ['x', 'y', 'cell', 'size', 'dotSize', 'foreground', 'background', 'outlineColor', 'isHollow'];

function buildPrompt(description: string): string {
	return `Write JavaScript code that renders a single QR code pixel as an SVG shape.

The code runs as a function body. These variables are already in scope — do not declare them:
  x, y        — pixel column/row (integers, 0 to size-1)
  cell        — boolean: true = filled/dark pixel, false = empty/light pixel
  size        — QR grid dimension (e.g. 21 for a small code)
  dotSize     — fill factor 0.1 to 1.0 (user-controlled slider)
  foreground  — CSS hex color for filled pixels, e.g. "#000000"
  background  — CSS hex color for background
  outlineColor — CSS hex color for accent/outline
  isHollow    — boolean

SVG coordinate system: each pixel occupies a 1×1 unit square.
The pixel centre is at (x + 0.5, y + 0.5).

Requirements:
  - Return a string containing SVG element(s), e.g. <circle .../> or <polygon .../>
  - Return '' (empty string) to render nothing for a given pixel
  - Handle BOTH cell=true and cell=false
  - Use only Math functions, arithmetic, and template literals — no imports or require

Effect to render: ${description}

Respond with ONLY the code wrapped in <code> and </code> tags like this example (simple circles):

<code>
if (!cell) return '';
const r = dotSize * 0.5;
return \`<circle cx="\${x + 0.5}" cy="\${y + 0.5}" r="\${r}" fill="\${foreground}" />\`;
</code>

Important: write bare statements only inside the tags — no surrounding function() declaration.`;
}

/**
 * Extract the code from the model response.
 * Tries <code> tags first (what we asked for), then markdown fences,
 * then falls back to the raw text. All searches are non-anchored so
 * preamble text before the code block does not prevent extraction.
 */
function extractCode(raw: string): string {
	// 1. <code>...</code> tags
	const xmlMatch = raw.match(/<code>([\s\S]*?)<\/code>/i);
	if (xmlMatch) return xmlMatch[1].trim();

	// 2. Markdown fences (non-anchored — handles preamble text before the fence)
	const fenceMatch = raw.match(/```(?:javascript|js|ts|svg|html)?\n?([\s\S]*?)```/i);
	if (fenceMatch) return fenceMatch[1].trim();

	// 3. Raw response as last resort
	return raw.trim();
}

/** Try compiling the code as a new Function body; return the error string or null. */
function validateCode(code: string): string | null {
	try {
		new Function(...ARGS, code);
		return null;
	} catch (e) {
		return String(e);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { description } = await request.json();

		if (!description?.trim()) {
			return json({ error: 'Description is required' }, { status: 400 });
		}

		if (!GEMINI_API_KEY) {
			return json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
		}

		const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

		const response = await ai.models.generateContent({
			model: 'gemini-3-flash-preview',
			contents: buildPrompt(description.trim()),
			config: {
				temperature: 1.0
			}
		});

		const raw = response.text ?? '';
		const code = extractCode(raw);

		if (!code) {
			return json({ error: 'Model returned an empty response' }, { status: 500 });
		}

		const syntaxError = validateCode(code);
		if (syntaxError) {
			// Return the code anyway so the client can load it into the editor for inspection
			return json(
				{ error: `Syntax error in generated code — switch to Code mode to fix it. (${syntaxError})`, code },
				{ status: 422 }
			);
		}

		return json({ code });
	} catch (error) {
		console.error('Error generating QR renderer:', error);
		return json({ error: 'Failed to generate renderer' }, { status: 500 });
	}
};
