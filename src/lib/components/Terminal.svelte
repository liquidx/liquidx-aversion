<script lang="ts">
	import { onMount, tick } from 'svelte';

	interface HistoryEntry {
		command: string;
		output: string[];
		timestamp?: number;
	}

	interface Props {
		history?: HistoryEntry[];
		prompt?: string;
		placeholder?: string;
		oncommand?: (command: string) => void;
	}

	let { history = [], prompt = '$', placeholder = '', oncommand }: Props = $props();

	let currentCommand = $state('');
	let inputElement: HTMLInputElement;
	let terminalElement: HTMLDivElement;
	let cursorVisible = $state(true);
	let inputFocused = $state(false);
	let cursorPosition = $state(0);
	let measureElement: HTMLSpanElement;

	// Blinking cursor effect
	onMount(() => {
		const interval = setInterval(() => {
			cursorVisible = !cursorVisible;
		}, 500);

		return () => clearInterval(interval);
	});

	// Auto-scroll to bottom when history updates
	$effect(() => {
		if (history.length > 0) {
			tick().then(() => {
				if (terminalElement) {
					terminalElement.scrollTop = terminalElement.scrollHeight;
				}
			});
		}
	});

	// Focus input when terminal is clicked or focused
	function focusInput() {
		inputElement?.focus();
	}

	// Handle input focus events
	function handleInputFocus() {
		inputFocused = true;
		updateCursorPosition();
	}

	function handleInputBlur() {
		inputFocused = false;
	}

	// Update cursor position based on input selection
	function updateCursorPosition() {
		if (inputElement) {
			cursorPosition = inputElement.selectionStart || 0;
		}
	}

	// Calculate cursor offset in pixels
	function getCursorOffset() {
		if (!measureElement) return 0;

		// Update the measuring element with text up to cursor position
		measureElement.textContent = currentCommand.slice(0, cursorPosition);

		// Return the width of the text
		return measureElement.offsetWidth;
	}

	// Handle input events to track cursor position
	function handleInput() {
		updateCursorPosition();
	}

	// Handle keyboard navigation for terminal container
	function handleTerminalKeydown(event: KeyboardEvent) {
		// Focus input on any key press when terminal container is focused
		if (event.key !== 'Tab') {
			focusInput();
		}
	}

	// Handle command submission
	function handleSubmit() {
		const safeCommand = currentCommand.trim();
		if (safeCommand) {
			// Call the callback prop if provided
			oncommand?.(safeCommand);

			currentCommand = '';
			cursorPosition = 0;

			// Force update the input element and refocus.
			tick().then(() => {
				if (inputElement) {
					inputElement.value = '';
					inputElement.focus();
				}
			});
		}
	}

	// Handle keydown events
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSubmit();
		} else {
			// Update cursor position after key events
			setTimeout(updateCursorPosition, 0);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={terminalElement}
	class="h-96 overflow-y-auto rounded border border-gray-700 bg-black p-4 font-mono text-sm text-green-400"
	onclick={focusInput}
	onkeydown={handleTerminalKeydown}
	role="application"
	tabindex="-1"
>
	<!-- History display -->
	{#each history as entry}
		<div class="mb-2">
			<!-- Command line -->
			<div class="flex items-center">
				<span class="mr-2 text-green-300">{prompt}</span>
				<span class="text-white">{entry.command}</span>
			</div>

			<!-- Output -->
			{#each entry.output as line}
				<div class="ml-4 text-gray-300">{line}</div>
			{/each}
		</div>
	{/each}

	<!-- Current input line -->
	<div class="flex items-center">
		<span class="mr-2 text-green-300">{prompt}</span>
		<div class="relative flex-1">
			<!-- Hidden text to measure cursor position -->
			<span
				bind:this={measureElement}
				class="pointer-events-none invisible absolute font-mono whitespace-pre text-white"
			></span>
			<input
				bind:this={inputElement}
				bind:value={currentCommand}
				onkeydown={handleKeydown}
				onfocus={handleInputFocus}
				onblur={handleInputBlur}
				oninput={handleInput}
				onselect={updateCursorPosition}
				onclick={updateCursorPosition}
				class="w-full border-none bg-transparent font-mono text-white caret-transparent outline-none"
				{placeholder}
				autocomplete="off"
				spellcheck="false"
			/>
			{#if cursorVisible && inputFocused}
				<span class="absolute top-0 h-5 w-0.5 bg-green-400" style="left: {getCursorOffset()}px;"
				></span>
			{/if}
		</div>
	</div>
</div>
