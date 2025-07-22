<script lang="ts">
	import { tick } from 'svelte';
	import {
		fibonacci,
		threeJsCube,
		binarySearch,
		recursiveFactorial,
		promiseChain,
		bubbleSort
	} from '../code-snippets';

	let inputText = '';
	let outputPoem = '';
	let outputCode = '';
	let isLoading = false;
	let statusMessage = 'Convert';
	let textareaElement: HTMLTextAreaElement;
	let codeTextareaElement: HTMLTextAreaElement;
	let selectedPoet = 'T.S. Eliot';

	const poetOptions = [
		{ value: 'T.S. Eliot', label: 'T.S. Eliot' },
		{ value: 'Mary Oliver', label: 'Mary Oliver' },
		{ value: 'Walt Whitman', label: 'Walt Whitman' }
	];

	function resetToStart() {
		currentState = 'input';
		outputPoem = '';
		outputCode = '';
		statusMessage = 'Convert';
	}

	// UI States: 'input' | 'poem' | 'code'
	let currentState: 'input' | 'poem' | 'code' = 'input';

	function autoResize(element?: HTMLTextAreaElement) {
		const targetElement = element || textareaElement;
		if (targetElement) {
			targetElement.style.height = 'auto';
			targetElement.style.height = targetElement.scrollHeight + 'px';
		}
	}

	function autoResizeCode() {
		autoResize(codeTextareaElement);
	}

	$: if (textareaElement && inputText !== undefined) {
		autoResize();
	}

	$: if (codeTextareaElement && outputCode && currentState === 'code') {
		setTimeout(autoResizeCode, 0);
	}

	async function generatePoem() {
		if (!inputText.trim() || isLoading) return;

		isLoading = true;
		outputPoem = '';

		statusMessage = 'Converting to Poem...';
		try {
			const poemPrompt = `Read the following code and write a poem in the style of ${selectedPoet} that describes what the code does. Only output the poem and nothing else: ${inputText}`;
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

			currentState = 'poem';
		} catch (error) {
			console.error('Error generating poem:', error);
			outputPoem = 'Error generating poem. Please try again.';
		} finally {
			isLoading = false;
			statusMessage = 'Generate Poem';
		}
	}

	async function generateCode() {
		if (!outputPoem.trim() || isLoading) return;

		isLoading = true;
		outputCode = '';

		statusMessage = 'Generating Code...';
		try {
			const codePrompt = `Read the following poem and generate javascript code that does that represents what this poem is describing 
to the best of your ability. 
Do not only output the poem to console or to the screen, use the meaning of the poem to determine what javascript code it is describing. 
Output just the code with no comments, no html and no explanation. 
Output valid javascript code as a single function with the function name "run". 
This code should be executable in the browser javascript interpreter.
Do not use any markdown, only output javascript code.

Here is the poem:

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

			currentState = 'code';
		} catch (error) {
			console.error('Error generating code:', error);
			outputCode = 'Error generating code. Please try again.';
		} finally {
			isLoading = false;
			statusMessage = 'Convert to Code';
		}
	}
</script>

<div class="max-w-3xl p-8 md:p-4">
	<div class="flex flex-col gap-8 text-sm md:gap-6">
		{#if currentState === 'input'}
			<!-- Poet Style Selector -->
			<div class="flex flex-col gap-2">
				<h3 class="m-0 font-semibold text-gray-700">Poet Style</h3>
				<select
					bind:value={selectedPoet}
					class="w-fit rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
				>
					{#each poetOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Input Text Box -->
			<div class="flex flex-col gap-2">
				<h3 class="m-0 font-semibold text-gray-700">Input Code</h3>
				<textarea
					bind:this={textareaElement}
					bind:value={inputText}
					on:input={() => autoResize()}
					placeholder="Paste your code here..."
					class="min-h-32 w-full resize-none overflow-hidden rounded-lg bg-gray-800 p-4 font-mono text-sm leading-relaxed text-gray-300 transition-colors focus:outline-none"
					rows="1"
				></textarea>
				<div class="mt-2 flex flex-wrap gap-2">
					<button
						on:click={() => {
							inputText = fibonacci;
							setTimeout(autoResize, 0);
						}}
						class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
						>Fibonacci</button
					>
					<button
						on:click={() => {
							inputText = binarySearch;
							setTimeout(autoResize, 0);
						}}
						class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
						>Binary Search</button
					>
					<button
						on:click={() => {
							inputText = recursiveFactorial;
							setTimeout(autoResize, 0);
						}}
						class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
						>Factorial</button
					>
					<button
						on:click={() => {
							inputText = promiseChain;
							setTimeout(autoResize, 0);
						}}
						class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
						>Promise Chain</button
					>
					<button
						on:click={() => {
							inputText = bubbleSort;
							setTimeout(autoResize, 0);
						}}
						class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
						>Bubble Sort</button
					>
					<button
						on:click={() => {
							inputText = threeJsCube;
							setTimeout(autoResize, 0);
						}}
						class="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
						>Three.js Cube</button
					>
				</div>
			</div>

			<!-- Generate Poem Button -->
			<div class="flex items-center justify-start py-4">
				<button
					on:click={generatePoem}
					disabled={!inputText.trim() || isLoading}
					class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:not-disabled:translate-y-[-2px] hover:not-disabled:shadow-lg active:not-disabled:translate-y-0 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if isLoading}
						<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"
						></span>
						{statusMessage}
					{:else}
						Generate Poem
					{/if}
				</button>
			</div>
		{/if}

		{#if currentState === 'poem'}
			<!-- Generated Poem Text Box -->
			<div class="flex flex-col gap-2">
				<pre
					class="w-full rounded-lg p-4 font-serif text-lg leading-relaxed whitespace-pre-wrap text-gray-300">{outputPoem}
				</pre>
				<pre
					class="w-full rounded-lg p-4 font-serif text-lg leading-relaxed whitespace-pre-wrap text-gray-300">- A.I. {selectedPoet}, 2025</pre>
			</div>

			<!-- Convert to Code Button -->
			<div class="flex items-center justify-start py-4">
				<button
					on:click={generateCode}
					disabled={!outputPoem.trim() || isLoading}
					class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-gradient-to-r from-green-500 to-blue-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:not-disabled:translate-y-[-2px] hover:not-disabled:shadow-lg active:not-disabled:translate-y-0 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if isLoading}
						<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"
						></span>
						{statusMessage}
					{:else}
						Convert to Code
					{/if}
				</button>
			</div>
		{/if}

		{#if currentState === 'code'}
			<!-- Generated Code Text Box -->
			<div class="flex flex-col gap-2">
				<h3 class="m-0 font-semibold text-gray-700">Generated Code</h3>
				<textarea
					bind:this={codeTextareaElement}
					bind:value={outputCode}
					placeholder="Your code will appear here..."
					class="min-h-32 w-full resize-none overflow-hidden rounded-lg bg-gray-800 p-4 font-mono text-sm leading-relaxed text-white transition-colors focus:outline-none"
					rows="1"
					readonly
				></textarea>
			</div>

			<!-- Start Over Button -->
			<div class="flex items-center justify-start py-4">
				<button
					on:click={resetToStart}
					class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-gradient-to-r from-gray-500 to-gray-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:translate-y-[-2px] hover:shadow-lg active:translate-y-0"
				>
					Start Over
				</button>
			</div>
		{/if}
	</div>
</div>
