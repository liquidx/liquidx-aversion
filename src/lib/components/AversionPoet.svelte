<script lang="ts">
	import { fibonacci, threeJsCube } from '../code-snippets';

	let inputText = '';
	let outputPoem = '';
	let outputCode = '';
	let isLoading = false;
	let statusMessage = 'Convert';

	async function runConversion() {
		if (!inputText.trim() || isLoading) return;

		isLoading = true;
		outputPoem = '';
		outputCode = '';

		// Step 1: Convert to Poem
		statusMessage = 'Converting to Poem...';
		try {
			const poemPrompt = `Read the follow code and write a poem in the style of TS Eliot that describes what the code does. Only output the poem and nothing else: ${inputText}`;
			const poemResponse = await fetch('/api/gemini/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: poemPrompt })
			});

			if (!poemResponse.ok) {
				throw new Error(`HTTP error! status: ${poemResponse.status}`);
			}

			const poemData = await poemResponse.json();
			outputPoem = poemData.response || 'No poem generated.';

			if (outputPoem === 'No poem generated.') {
				throw new Error('Poem generation failed.');
			}
		} catch (error) {
			console.error('Error generating poem:', error);
			outputPoem = 'Error generating poem. Please try again.';
			isLoading = false;
			statusMessage = 'Convert';
			return;
		}

		// Step 2: Generate Code from Poem
		statusMessage = 'Generating Code...';
		try {
			const codePrompt = `Return the following poem and generate javascript code that does that this describes 
to the best of your ability. Output just the code with no comments, no html and no explanation. Output as just the javascript code as a single function.

${outputPoem}`;
			const codeResponse = await fetch('/api/gemini/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: codePrompt })
			});

			if (!codeResponse.ok) {
				throw new Error(`HTTP error! status: ${codeResponse.status}`);
			}

			const codeData = await codeResponse.json();
			outputCode = codeData.response || 'No code generated.';
		} catch (error) {
			console.error('Error generating code:', error);
			outputCode = 'Error generating code. Please try again.';
		} finally {
			isLoading = false;
			statusMessage = 'Convert';
		}
	}
</script>

<div class="max-w-3xl p-8 md:p-4">
	<div class="flex flex-col gap-8 md:gap-6">
		<!-- Input Text Box -->
		<div class="flex flex-col gap-2">
			<h3 class="m-0 font-semibold text-gray-700">Input Code</h3>
			<textarea
				bind:value={inputText}
				placeholder="Paste your code here..."
				class="min-h-[200px] w-full resize-y rounded-lg bg-gray-800 p-4 font-mono text-sm leading-relaxed text-white transition-colors focus:outline-none"
				rows="15"
			></textarea>
			<div class="mt-2 flex gap-2">
				<button
					on:click={() => (inputText = fibonacci)}
					class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
					>Fibonacci</button
				>
				<button
					on:click={() => (inputText = threeJsCube)}
					class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
					>Three.js Cube</button
				>
			</div>
		</div>

		<!-- Convert Button -->
		<div class="flex items-center justify-start py-4">
			<button
				on:click={runConversion}
				disabled={!inputText.trim() || isLoading}
				class="flex min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:not-disabled:translate-y-[-2px] hover:not-disabled:shadow-lg active:not-disabled:translate-y-0 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if isLoading}
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"
					></span>
					{statusMessage}
				{:else}
					Convert
				{/if}
			</button>
		</div>

		<!-- Generated Poem Text Box -->
		<div class="flex flex-col gap-2">
			<h3 class="m-0 font-semibold text-gray-700">Generated Poem</h3>
			<textarea
				bind:value={outputPoem}
				placeholder="Your poem will appear here..."
				class="min-h-[200px] w-full resize-y rounded-lg bg-gray-800 p-4 font-mono text-sm leading-relaxed text-white transition-colors focus:outline-none"
				rows="15"
				readonly
			></textarea>
		</div>

		<!-- Generated Code Text Box -->
		<div class="flex flex-col gap-2">
			<h3 class="m-0 font-semibold text-gray-700">Generated Code</h3>
			<textarea
				bind:value={outputCode}
				placeholder="Your code will appear here..."
				class="min-h-[200px] w-full resize-y rounded-lg bg-gray-800 p-4 font-mono text-sm leading-relaxed text-white transition-colors focus:outline-none"
				rows="15"
				readonly
			></textarea>
		</div>
	</div>
</div>
