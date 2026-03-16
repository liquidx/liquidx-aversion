import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are an expert at writing creative SVG QR code pixel renderers.

Your task is to write a JavaScript function body that renders a single QR code pixel as SVG.

## Context

The function body runs inside \`new Function(...args, body)\` and has these variables in scope:

| Variable       | Type    | Description |
|---------------|---------|-------------|
| \`x\`           | number  | Column index, 0-based (0 to size-1) |
| \`y\`           | number  | Row index, 0-based (0 to size-1) |
| \`cell\`        | boolean | \`true\` = filled/dark QR pixel, \`false\` = empty/light |
| \`size\`        | number  | Total QR grid dimension (e.g. 21 for a version-1 code) |
| \`dotSize\`     | number  | Fill factor 0.1–1.0 (the user's dot size slider) |
| \`foreground\`  | string  | CSS hex color for filled pixels, e.g. \`"#000000"\` |
| \`background\`  | string  | CSS hex color for background, e.g. \`"#ffffff"\` |
| \`outlineColor\`| string  | CSS hex color for outline/hollow accents, e.g. \`"#cccccc"\` |
| \`isHollow\`    | boolean | Whether the user wants empty pixels drawn as outlines |

## SVG coordinate space

- Each pixel occupies a **1×1 unit cell** at SVG coordinates (\`x\`, \`y\`) to (\`x+1\`, \`y+1\`).
- The pixel **centre** is at (\`x + 0.5\`, \`y + 0.5\`).
- A full-sized circle filling the cell: \`<circle cx="\${x+0.5}" cy="\${y+0.5}" r="0.5" />\`
- A full-sized square filling the cell: \`<rect x="\${x}" y="\${y}" width="1" height="1" />\`

## Rules

1. Return a **string** containing one or more SVG element(s), or \`''\` to render nothing.
2. You MUST handle both \`cell === true\` and \`cell === false\` explicitly.
3. Do NOT use \`function\` declarations, class syntax, or top-level \`return\` — this is a function body only.
4. Do NOT use \`import\` or \`require\`.
5. Use only standard JavaScript (\`Math\`, template literals, arithmetic). No external libraries.
6. SVG attributes that are numbers should be computed inline; round to ≤4 decimal places.
7. Use \`transform="rotate(angle, cx, cy)"\` for SVG rotations.
8. Keep the code concise (under ~15 lines). Add a short comment at the top describing the effect.

## Output format

Respond with **ONLY** the raw JavaScript code. No markdown fences, no explanation, no prose.`;

function stripCodeFences(text: string): string {
	// Remove ```javascript ... ``` or ``` ... ``` wrappers if Gemini adds them anyway
	return text
		.replace(/^```(?:javascript|js|svg)?\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim();
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

		const userPrompt = `Write a QR code pixel renderer for the following effect:\n\n${description.trim()}`;

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: userPrompt,
			config: {
				systemInstruction: SYSTEM_PROMPT,
				temperature: 0.9,
				maxOutputTokens: 1024
			}
		});

		const raw = response.text ?? '';
		const code = stripCodeFences(raw);

		if (!code) {
			return json({ error: 'Model returned an empty response' }, { status: 500 });
		}

		return json({ code });
	} catch (error) {
		console.error('Error generating QR renderer:', error);
		return json({ error: 'Failed to generate renderer' }, { status: 500 });
	}
};
