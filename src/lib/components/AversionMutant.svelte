<script lang="ts">
	import { browser } from '$app/environment';
	import { callGemini } from '$lib/gemini';

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
	}

	let messages: ChatMessage[] = $state([
		{
			id: '1',
			role: 'assistant',
			content: 'Hello! I am an AI assistant. Ask me anything!',
			timestamp: new Date()
		}
	]);

	let currentMessage = $state('');
	let isLoading = $state(false);
	let inputElement: HTMLInputElement | undefined;

	// Auto-scroll to bottom when messages change
	$effect(() => {
		if (messages && browser) {
			setTimeout(() => {
				window.scrollTo({
					top: document.body.scrollHeight,
					behavior: 'smooth'
				});
			}, 0);
		}
	});

	function formatTime(timestamp: Date): string {
		return timestamp.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function sendMessage() {
		if (currentMessage.trim() && !isLoading) {
			const userMessage: ChatMessage = {
				id: Date.now().toString(),
				role: 'user',
				content: currentMessage.trim(),
				timestamp: new Date()
			};

			messages = [...messages, userMessage];
			const prompt = currentMessage.trim();
			currentMessage = '';

			// Refocus input
			setTimeout(() => inputElement?.focus(), 0);

			// Call Gemini API
			isLoading = true;
			try {
				const response = await callGemini(prompt);

				const assistantMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: response,
					timestamp: new Date()
				};

				messages = [...messages, assistantMessage];
			} catch (error) {
				console.error('Error calling Gemini:', error);
				const errorMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: 'Sorry, I encountered an error. Please try again.',
					timestamp: new Date()
				};
				messages = [...messages, errorMessage];
			} finally {
				isLoading = false;
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}
</script>

<!-- Main Chat Area -->
<div class="mb-16 p-4">
	<!-- Messages -->
	<div class="space-y-4">
		{#each messages as message}
			<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
						? 'bg-blue-600 text-white'
						: 'bg-gray-700 text-gray-100'}"
				>
					<div class="mb-1 text-xs opacity-60">
						{message.role === 'user' ? 'You' : 'AI'} · {formatTime(message.timestamp)}
					</div>
					<div class="text-sm whitespace-pre-wrap">{message.content}</div>
				</div>
			</div>
		{/each}

		{#if isLoading}
			<div class="flex justify-start">
				<div class="max-w-[80%] rounded-lg bg-gray-700 px-4 py-2 text-gray-100">
					<div class="text-sm">Thinking...</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Fixed Input Area at Bottom -->
<div class="fixed right-0 bottom-0 left-0 border-t border-gray-700 bg-gray-800 p-4">
	<div class="mx-auto flex max-w-4xl items-center space-x-2">
		<input
			bind:this={inputElement}
			type="text"
			bind:value={currentMessage}
			onkeydown={handleKeydown}
			disabled={isLoading}
			placeholder="Type your message and press Enter..."
			class="flex-1 rounded border border-gray-600 bg-gray-700 px-4 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
		/>
		<button
			onclick={sendMessage}
			disabled={isLoading || !currentMessage.trim()}
			class="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Send
		</button>
	</div>
</div>
