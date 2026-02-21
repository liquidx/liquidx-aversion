export interface Demo {
	title: string;
	description: string; // HTML content
	path: string;
	yearMonth: string;
}

export const demos: Demo[] = [
	{
		title: 'cataloger',
		description: `A tool for extracting and cataloging snowboards from PDF files.
			
			<p>Simply drag and drop a PDF catalog. It parses the PDF, uses the 
			FAL.ai SAM-3 API to extract snowboards, and calls the Gemini API to 
			identify their names automatically.</p>`,
		path: '/of/cataloger',
		yearMonth: '2026-02'
	},
	{
		title: 'imager',
		description: `A powerful browser-based image manipulation tool.
			
			<p>Features include background removal using color or corner detection, 
			cropping, scaling, padding, rotating, and auto-trimming. 
			All processing happens locally in the browser.</p>`,
		path: '/of/imager',
		yearMonth: '2026-02'
	},
	{
		title: 'mutant',
		description: `A basic AI chat interface that evolves and mutates over time.

			<p>Starting as a simple chat UI, this demo explores how an AI conversation interface
			can transform and adapt based on user interactions.</p>
`,
		path: '/of/mutant',
		yearMonth: '2025-10'
	},
	{
		title: 'multiplayer',
		description: `Exploration of multiplayer AI interaction using an LLM.

			<p>Inspired by <a href="https://interconnected.org/home/2025/05/23/turntaking" class="underline">Matt Webb's Multiplayer AI posts</a>.
			Can an LLM figure out in a conversation with multiple bots and humans,
			when to respond and when to let the others speak.</p>
`,
		path: '/of/multiplayer',
		yearMonth: '2025-09'
	},
	{
		title: 'navigator',
		description: `Exploration of a conceptual browser for an LLM. Look into what the LLM knows through a browser interface rather than chat.
			
			<p>Inspired by discussions on how does one inspect what is inside an LLM, could you treat it like the internet? 
			If every bit of information inside the LLM could be referenced through a prompt, 
			then maybe that maybe you could browse the LLM if every prompt is a URL.</p>`,
		path: '/of/navigator',
		yearMonth: '2025-09'
	},
	{
		title: 'metro',
		description: `Vibe-coded metro map editor. 
			
			<p>Could you create a fairly complex UX through vibe-coding. After several days of continuous prompting, it seems that this current crop of LLMS 
			do not do well with UX patterns. It has a tendency to do the MVP of design, or even some designs borderline unusable, 
			like it was developed by an engineer. A lot of work is needed to make the design usable.</p>`,
		path: '/of/metro',
		yearMonth: '2025-08'
	},
	{
		title: 'codepoet',
		description: `Exploration of how code could be translated into poems and then back to code. 
			
			<p>Could you prompt an LLM through poetry to generate code? Could code be represented as poetry? 
			Turns out poetry itself has many styles too, 
			so we took a shortcut to find poets to emulate, and the results are quite beautiful.</p>`,
		path: '/of/codepoet',
		yearMonth: '2025-07'
	},
	{
		title: 'threetextfield',
		description: 'Exploration of a hyper fancy text box and what it would take to make it work.',
		path: '/of/number',
		yearMonth: '2025-07'
	},
	{
		title: 'terminal',
		description: 'A fake terminal interface that could be extensible.',
		path: '/of/terminal',
		yearMonth: '2025-07'
	}
];
