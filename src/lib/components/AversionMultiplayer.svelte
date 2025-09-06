<script lang="ts">
	import { browser } from '$app/environment';

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
		},
		{
			id: '3',
			username: 'gemini',
			isOnline: true,
			isBot: true,
			personality:
				'Google personified. Always trying to be helpful and be the first to answer something.'
		},
		{
			id: '4',
			username: 'mary',
			isOnline: true,
			isBot: true,
			personality: 'Speaks like Mary Oliver the poet, existential and thought provoking.'
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
		},
		{
			id: '3',
			username: 'alice',
			message: 'How are you?',
			timestamp: new Date(Date.now() - 180000)
		},
		{
			id: '4',
			username: 'bob',
			message: 'I am good, thanks!',
			timestamp: new Date(Date.now() - 120000)
		},
		{
			id: '5',
			username: 'mary',
			message: 'Good to see you.',
			timestamp: new Date(Date.now() - 60000)
		},
		{
			id: '6',
			username: 'gemini',
			message: 'how can i assist?',

			timestamp: new Date(Date.now() - 30000)
		}
	];

	let currentMessage = '';
	let currentUser = 'You';
	let isLoadingAI = false;
	let inputElement: HTMLInputElement | undefined;
	let showSettings = false;
	let tempInstructions = '';
	let editingParticipant: Participant | null = null;
	let tempPersonality = '';

	// Reactive variable for max bot conversation turns (double the number of bots)
	$: maxBotTurns = participants.filter((p) => p.isBot).length * 2;

	// Conversation instructions for the AI
	let conversationInstructions = `
Consider the list of participants and the following chat dialog and decide who will be the next person to respond. 
Some of the participants are bots (represented as Bots), and some are humans. In the participants list, they have a personality.
Return the name of who would be most likely to say the next thing and the text of the possible response.

# Next speaker guidance
- Try to defer to the human users as much as possible.
- Bots should not be trying to talk to each other unless asked by the Human.

# Message rules
- The message should be in the style of what the participant's personality specified in the participant list.
- The message should not have a question in it or solicit a response.`;

	// Auto-scroll page to bottom when messages change
	$: if (messages && browser) {
		setTimeout(() => {
			window.scrollTo({
				top: document.body.scrollHeight,
				behavior: 'smooth'
			});
		}, 0);
	}

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

	function areLastNMessagesFromBots(n: number = 4): boolean {
		if (messages.length < n) return false;

		const lastN = messages.slice(-n);
		return lastN.every((msg) => {
			const participant = participants.find((p) => p.username === msg.username);
			return participant?.isBot === true;
		});
	}

	function handleInviteCommand(message: string): boolean {
		const inviteMatch = message.match(/^\/invite\s+(\S+)\s+(.+)$/);
		if (!inviteMatch) return false;

		const [, username, personality] = inviteMatch;

		// Check if participant already exists
		if (participants.find((p) => p.username === username)) {
			const systemMessage: ChatMessage = {
				id: Date.now().toString(),
				username: 'System',
				message: `Participant "${username}" already exists in the chat.`,
				timestamp: new Date()
			};
			messages = [...messages, systemMessage];
			return true;
		}

		// Add new bot participant
		const newParticipant: Participant = {
			id: Date.now().toString(),
			username: username,
			isOnline: true,
			isBot: true,
			personality: personality.trim()
		};
		participants = [...participants, newParticipant];

		// Add system message about the new participant
		const systemMessage: ChatMessage = {
			id: Date.now().toString(),
			username: 'System',
			message: `${username} has joined the chat.`,
			timestamp: new Date()
		};
		messages = [...messages, systemMessage];

		return true;
	}

	async function getAIResponse() {
		if (isLoadingAI) return;

		// Stop generating AI responses if last N messages are all from bots (N = double the bot count)
		if (areLastNMessagesFromBots(maxBotTurns)) {
			console.log(`Last ${maxBotTurns} messages are from bots, waiting for human input`);
			return;
		}

		isLoadingAI = true;
		try {
			const chatDialog = formatChatDialog();
			const participantDescriptions = formatParticipantDescriptions();

			console.log('Generating next conversation.');

			const response = await fetch('/api/multiplayer', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					chatDialog,
					participants: participantDescriptions,
					instructions: conversationInstructions
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get AI response');
			}

			const result = await response.json();

			// Check if nextUser is one of our AI participants
			const aiParticipant = participants.find((p) => p.isBot && p.username === result.nextUser);

			if (!aiParticipant) {
				console.log('Waiting for the user.');
			}

			if (aiParticipant && result.message) {
				const newMessage: ChatMessage = {
					id: Date.now().toString(),
					username: result.nextUser,
					message: result.message,
					timestamp: new Date()
				};
				messages = [...messages, newMessage];

				// Wait 1 second then try to generate the next message
				setTimeout(async () => {
					await getAIResponse();
				}, 1000);
			}
		} catch (error) {
			console.error('Error getting AI response:', error);
		} finally {
			isLoadingAI = false;
		}
	}

	async function sendMessage() {
		if (currentMessage.trim()) {
			const messageText = currentMessage.trim();

			// Check if it's an invite command
			if (handleInviteCommand(messageText)) {
				currentMessage = '';
				setTimeout(() => inputElement?.focus(), 0);
				return;
			}

			const newMessage: ChatMessage = {
				id: Date.now().toString(),
				username: currentUser,
				message: messageText,
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

	function openSettings() {
		tempInstructions = conversationInstructions;
		showSettings = true;
	}

	function saveSettings() {
		conversationInstructions = tempInstructions;
		showSettings = false;
	}

	function cancelSettings() {
		showSettings = false;
	}

	function editParticipant(participant: Participant) {
		editingParticipant = participant;
		tempPersonality = participant.personality;
	}

	function savePersonality() {
		if (editingParticipant) {
			const index = participants.findIndex(p => p.id === editingParticipant.id);
			if (index !== -1) {
				participants[index].personality = tempPersonality;
				participants = [...participants]; // Trigger reactivity
			}
		}
		editingParticipant = null;
	}

	function cancelPersonalityEdit() {
		editingParticipant = null;
	}
</script>

<!-- Fixed Participants Sidebar -->
<div
	class="h-content fixed top-16 right-4 z-10 flex w-40 flex-col border-r border-gray-700 bg-gray-800"
>
	<div class="flex-1 overflow-y-auto py-3">
		{#each participants as participant}
			<div 
				class="flex items-center px-3 py-1 hover:bg-gray-700 cursor-pointer relative"
				on:click={() => editParticipant(participant)}
				role="button"
				tabindex="0"
				on:keydown={(e) => e.key === 'Enter' && editParticipant(participant)}
			>
				<div
					class="mr-2 h-2 w-2 rounded-full {participant.isOnline ? 'bg-green-500' : 'bg-gray-500'}"
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

	<!-- Settings Button -->
	<div class="border-t border-gray-700 p-2">
		<button
			on:click={openSettings}
			class="w-full rounded bg-gray-700 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
		>
			⚙️ Settings
		</button>
	</div>
</div>

<!-- Main Chat Area (expandable) -->
<div class="mr-40 mb-12">
	<!-- Messages Area -->
	<div class="space-y-1 p-3 font-mono text-xs">
		{#each messages as message}
			<div class="text-gray-300">
				<span class="text-gray-500">[{formatTime(message.timestamp)}]</span>
				<span class="font-semibold text-blue-400">&lt;{message.username}&gt;</span>
				<span class="text-gray-100">{message.message}</span>
			</div>
		{/each}
	</div>
</div>

<!-- Settings Modal -->
{#if showSettings}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black text-xs">
		<div class="flex max-h-[500px] w-[600px] flex-col overflow-hidden rounded-lg bg-gray-800 p-6">
			<h2 class="mb-4 text-sm font-bold text-white">Conversation Instructions</h2>

			<div class="flex-1 overflow-hidden">
				<textarea
					bind:value={tempInstructions}
					placeholder="Enter conversation instructions..."
					class="h-80 w-full resize-none rounded border border-gray-600 bg-gray-700 p-3 text-xs text-white focus:border-blue-500 focus:outline-none"
				></textarea>
			</div>

			<div class="mt-4 flex justify-end space-x-2">
				<button
					on:click={cancelSettings}
					class="rounded bg-gray-600 px-4 py-2 text-xs text-white hover:bg-gray-500"
				>
					Cancel
				</button>
				<button
					on:click={saveSettings}
					class="rounded bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-500"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Personality Edit Popover -->
{#if editingParticipant}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-gray-800 rounded-lg p-4 w-96 flex flex-col">
			<h3 class="text-sm font-bold text-white mb-3">
				Edit Personality - {editingParticipant.username}
			</h3>
			
			<textarea
				bind:value={tempPersonality}
				placeholder="Enter personality description..."
				class="w-full h-24 bg-gray-700 text-white text-xs p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none resize-none mb-3"
			></textarea>
			
			<div class="flex justify-end space-x-2">
				<button
					on:click={cancelPersonalityEdit}
					class="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
				>
					Cancel
				</button>
				<button
					on:click={savePersonality}
					class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Fixed Input Area at Bottom -->
<div class="fixed right-0 bottom-0 left-0 border-t border-gray-700 bg-gray-800 p-3">
	<div class="flex items-center space-x-2">
		<span class="font-mono text-xs font-semibold text-blue-400">&lt;{currentUser}&gt;</span>
		<input
			bind:this={inputElement}
			type="text"
			bind:value={currentMessage}
			on:keydown={handleKeydown}
			placeholder="Type your message and press Enter (also use /invite <name> <personality> to add other participants)"
			class="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
		/>
	</div>
</div>
