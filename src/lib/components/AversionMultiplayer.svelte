<script lang="ts">
	interface ChatMessage {
		id: string;
		username: string;
		message: string;
		timestamp: Date;
	}

	interface Participant {
		id: string;
		username: string;
		isOnline: boolean;
		isBot: boolean;
		personality: string;
	}

	let participants: Participant[] = [
		{ id: '0', username: 'You', isOnline: true, isBot: false, personality: 'Human user' },
		{
			id: '1',
			username: 'alice',
			isOnline: true,
			isBot: true,
			personality: 'Friendly and enthusiastic, uses emojis and speaks like a Gen Z'
		},
		{
			id: '2',
			username: 'bob',
			isOnline: true,
			isBot: true,
			personality:
				'Thoughtful and analytical, prefers deeper conversations and sharing insights. Speaks as a millenial.'
		}
	];

	let messages: ChatMessage[] = [
		{
			id: '1',
			username: 'alice',
			message: 'Hey everyone!',
			timestamp: new Date(Date.now() - 300000)
		},
		{
			id: '2',
			username: 'bob',
			message: 'Hello alice!',
			timestamp: new Date(Date.now() - 240000)
		}
	];

	let currentMessage = '';
	let currentUser = 'You';
	let isLoadingAI = false;
	let inputElement: HTMLInputElement | undefined;

	function formatTime(timestamp: Date): string {
		return timestamp.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatChatDialog(): string {
		return messages
			.map((msg) => `[${formatTime(msg.timestamp)}] <${msg.username}> ${msg.message}`)
			.join('\n');
	}

	function formatParticipantDescriptions(): string {
		return participants
			.map((p) => `- ${p.username} (${p.isBot ? 'Bot' : 'Human'}): ${p.personality}`)
			.join('\n');
	}

	async function getAIResponse() {
		if (isLoadingAI) return;

		isLoadingAI = true;
		try {
			const chatDialog = formatChatDialog();
			const participantDescriptions = formatParticipantDescriptions();

			const response = await fetch('/api/multiplayer', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ chatDialog, participants: participantDescriptions })
			});

			if (!response.ok) {
				throw new Error('Failed to get AI response');
			}

			const result = await response.json();

			// Check if nextUser is one of our AI participants
			const aiParticipant = participants.find((p) => p.isBot && p.username === result.nextUser);

			if (aiParticipant && result.message) {
				const newMessage: ChatMessage = {
					id: Date.now().toString(),
					username: result.nextUser,
					message: result.message,
					timestamp: new Date()
				};
				messages = [...messages, newMessage];
			}
		} catch (error) {
			console.error('Error getting AI response:', error);
		} finally {
			isLoadingAI = false;
		}
	}

	async function sendMessage() {
		if (currentMessage.trim()) {
			const newMessage: ChatMessage = {
				id: Date.now().toString(),
				username: currentUser,
				message: currentMessage.trim(),
				timestamp: new Date()
			};
			messages = [...messages, newMessage];
			currentMessage = '';

			// Refocus the input element after sending message
			setTimeout(() => inputElement?.focus(), 0);

			// Automatically trigger AI response after user sends message
			await getAIResponse();
		}
	}

	async function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (currentMessage.trim()) {
				await sendMessage();
			} else {
				// If message is empty, trigger AI response
				await getAIResponse();
				// Refocus the input element after AI response
				setTimeout(() => inputElement?.focus(), 0);
			}
		}
	}
</script>

<div class="flex h-screen w-full rounded-md bg-gray-900">
	<!-- Participants Sidebar -->
	<div class="flex h-full w-40 flex-col rounded-md bg-gray-800">
		<div class="flex-1 overflow-y-auto pt-3">
			{#each participants as participant}
				<div class="flex items-center px-3 py-1 hover:bg-gray-700">
					<div
						class="mr-2 h-2 w-2 rounded-full {participant.isOnline
							? 'bg-green-500'
							: 'bg-gray-500'}"
					></div>
					<span class="text-xs text-white {participant.isOnline ? '' : 'opacity-60'}"
						>{participant.username}</span
					>
					{#if participant.isBot}
						<span class="ml-auto text-xs text-purple-400">AI</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Main Chat Area -->
	<div class="flex h-full flex-1 flex-col rounded-md">
		<!-- Messages Area -->
		<div class="flex-1 space-y-1 overflow-y-auto bg-gray-900 p-3 font-mono text-xs">
			{#each messages as message}
				<div class="text-gray-300">
					<span class="text-gray-500">[{formatTime(message.timestamp)}]</span>
					<span class="font-semibold text-blue-400">&lt;{message.username}&gt;</span>
					<span class="text-gray-100">{message.message}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Fixed Input Area at Bottom -->
<div class="fixed right-0 bottom-0 left-0 border-t border-gray-700 bg-gray-800 p-3">
	<div class="flex items-center space-x-2">
		<span class="font-mono text-xs font-semibold text-blue-400">&lt;{currentUser}&gt;</span>
		<input
			bind:this={inputElement}
			type="text"
			bind:value={currentMessage}
			on:keydown={handleKeydown}
			placeholder="Type your message and press Enter... (or press Enter on empty message for AI)"
			class="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
		/>
	</div>
</div>
