import { json } from '@sveltejs/kit';
import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';

const ARGS = ['x', 'y', 'cell', 'size', 'dotSize', 'foreground', 'background', 'outlineColor', 'isHollow'];

const SYSTEM_PROMPT = `You are an expert at writing creative SVG QR code pixel renderers.

Your task is to write a JavaScript **function body** (not a function declaration) that renders a single QR code pixel as an SVG string.

## Variables already in scope

| Variable       | Type    | Description |
|---------------|---------|-------------|
| \`x\`           | number  | Column index, 0-based (0 to size-1) |
| \`y\`           | number  | Row index, 0-based (0 to size-1) |
| \`cell\`        | boolean | \`true\` = filled/dark QR pixel, \`false\` = empty/light |
| \`size\`        | number  | Total QR grid dimension (e.g. 21 for a version-1 code) |
| \`dotSize\`     | number  | Fill factor 0.1–1.0 (user-controlled) |
| \`foreground\`  | string  | CSS hex color for filled pixels, e.g. \`"#000000"\` |
| \`background\`  | string  | CSS hex color for background |
| \`outlineColor\`| string  | CSS hex color for outline accents |
| \`isHollow\`    | boolean | Whether the user wants empty pixels drawn as outlines |

## SVG coordinate space

Each pixel occupies a 1×1 unit cell at SVG position (x, y). Centre is at (x+0.5, y+0.5).

## CRITICAL: Output format

You must output ONLY bare JavaScript statements — no function wrapper of any kind.

❌ WRONG — do NOT wrap in a function declaration:
\`\`\`
function render(x, y, cell) {
  if (!cell) return '';
  const r = dotSize * 0.5;
  return \`<circle cx="\${x+0.5}" cy="\${y+0.5}" r="\${r}" fill="\${foreground}" />\`;
}
\`\`\`

❌ WRONG — do NOT use an arrow function:
\`\`\`
(x, y, cell) => {
  if (!cell) return '';
  return \`<circle cx="\${x+0.5}" cy="\${y+0.5}" r="0.5" fill="\${foreground}" />\`;
}
\`\`\`

❌ WRONG — do NOT wrap in const/let/var assignment:
\`\`\`
const render = () => { ... };
\`\`\`

✅ CORRECT — bare statements only, ending with a return:
\`\`\`
if (!cell) return '';
const r = dotSize * 0.5;
return \`<circle cx="\${x+0.5}" cy="\${y+0.5}" r="\${r}" fill="\${foreground}" />\`;
\`\`\`

## Additional rules

- MUST handle both \`cell === true\` and \`cell === false\` (return \`''\` to render nothing for a case).
- Do NOT use \`import\`, \`export\`, \`require\`, or \`class\`.
- Use only \`Math\`, arithmetic, template literals, and string concatenation.
- No external libraries.
- Keep it concise (under 15 lines). Add a one-line comment at the top describing the effect.
- Output ONLY the raw JavaScript. No markdown fences, no explanation.`;

/** Strip markdown code fences that models sometimes add despite instructions. */
function stripCodeFences(text: string): string {
	return text
		.replace(/^```(?:javascript|js|ts|svg|html)?\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim();
}

/**
 * If the model wrapped the body in a function declaration or arrow function,
 * extract just the body between the outermost { }.
 *
 * IMPORTANT: we do NOT use lastIndexOf('}') because template literals inside
 * the code contain '}' characters (e.g. `${foreground}` ends with '}'), which
 * would cause lastIndexOf to find an inner brace and truncate the code.
 * Instead we require the wrapper to end with '}' as its very last character,
 * so the closing-brace position is simply trimmed.length - 1.
 */
function unwrapFunction(code: string): string {
	const trimmed = code.trim();

	const looksLikeWrapper =
		/^function[\s(]/.test(trimmed) ||                // function foo(...) { or function(...) {
		/^(?:const|let|var)\s+\w+\s*=/.test(trimmed) || // const fn = ...
		/^\([^)]*\)\s*=>/.test(trimmed) ||               // (...) => {
		/^\w[\w\s,]*\s*=>/.test(trimmed);                // x => { or x, y => {

	if (!looksLikeWrapper) return trimmed;

	// Strip a trailing semicolon so `const fn = () => { ... };` also works
	const withoutSemi = trimmed.endsWith(';') ? trimmed.slice(0, -1).trimEnd() : trimmed;

	// Only proceed if the wrapper closes cleanly with '}'
	// (valid code usually ends with a return statement ending in `;` or a string, not '}')
	if (!withoutSemi.endsWith('}')) return trimmed;

	const firstBrace = withoutSemi.indexOf('{');
	const lastBrace = withoutSemi.length - 1; // we know this is '}'
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		return withoutSemi.slice(firstBrace + 1, lastBrace).trim();
	}

	return trimmed;
}

/** Attempt to compile the code as a new Function body; return the error string or null. */
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

		const userPrompt = `Write a QR code pixel renderer for the following effect:\n\n${description.trim()}`;

		const response = await ai.models.generateContent({
			model: 'gemini-3-flash-preview',
			contents: userPrompt,
			config: {
				systemInstruction: SYSTEM_PROMPT,
				temperature: 0.9,
				maxOutputTokens: 1024
			}
		});

		const raw = response.text ?? '';
		let code = stripCodeFences(raw);
		code = unwrapFunction(code);

		if (!code) {
			return json({ error: 'Model returned an empty response' }, { status: 500 });
		}

		const syntaxError = validateCode(code);
		if (syntaxError) {
			// Return the code anyway so the client can show it to the user for inspection/editing
			return json(
				{ error: `Generated code has a syntax error — switch to Code mode to fix it. (${syntaxError})`, code },
				{ status: 422 }
			);
		}

		return json({ code });
	} catch (error) {
		console.error('Error generating QR renderer:', error);
		return json({ error: 'Failed to generate renderer' }, { status: 500 });
	}
};
