<script lang="ts">
	import { createEventDispatcher } from 'svelte';

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

	interface Props {
		messages: ChatMessage[];
		participants: Participant[];
		currentUser: string;
		currentMessage: string;
		showSettings?: boolean;
		tempInstructions?: string;
		editingParticipant?: Participant | null;
		tempPersonality?: string;
	}

	let {
		messages,
		participants,
		currentUser,
		currentMessage = $bindable(),
		showSettings = false,
		tempInstructions = $bindable(''),
		editingParticipant = $bindable(null),
		tempPersonality = $bindable('')
	}: Props = $props();

	let inputElement: HTMLInputElement | undefined;

	const dispatch = createEventDispatcher<{
		sendMessage: void;
		getAIResponse: void;
		openSettings: void;
		saveSettings: void;
		cancelSettings: void;
		editParticipant: Participant;
		savePersonality: void;
		cancelPersonalityEdit: void;
	}>();

	function formatTime(timestamp: Date): string {
		return timestamp.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleSendMessage() {
		if (currentMessage.trim()) {
			dispatch('sendMessage');
			// Refocus the input element after sending message
			setTimeout(() => inputElement?.focus(), 0);
		}
	}

	async function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (currentMessage.trim()) {
				dispatch('sendMessage');
			} else {
				// If message is empty, trigger AI response
				dispatch('getAIResponse');
			}
			// Refocus the input element
			setTimeout(() => inputElement?.focus(), 0);
		}
	}

	function handleOpenSettings() {
		dispatch('openSettings');
	}

	function handleSaveSettings() {
		dispatch('saveSettings');
	}

	function handleCancelSettings() {
		dispatch('cancelSettings');
	}

	function handleEditParticipant(participant: Participant) {
		dispatch('editParticipant', participant);
	}

	function handleSavePersonality() {
		dispatch('savePersonality');
	}

	function handleCancelPersonalityEdit() {
		dispatch('cancelPersonalityEdit');
	}
</script>

<!-- Fixed Participants Sidebar -->
<div
	class="h-content fixed top-16 right-4 z-10 flex w-40 flex-col border-r border-gray-700 bg-gray-800"
>
	<div class="flex-1 overflow-y-auto py-3">
		{#each participants as participant}
			<div
				class="relative flex cursor-pointer items-center px-3 py-1 hover:bg-gray-700"
				onclick={() => handleEditParticipant(participant)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && handleEditParticipant(participant)}
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
			onclick={handleOpenSettings}
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
					onclick={handleCancelSettings}
					class="rounded bg-gray-600 px-4 py-2 text-xs text-white hover:bg-gray-500"
				>
					Cancel
				</button>
				<button
					onclick={handleSaveSettings}
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
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="flex w-96 flex-col rounded-lg bg-gray-800 p-4">
			<h3 class="mb-3 text-sm font-bold text-white">
				Edit Personality - {editingParticipant.username}
			</h3>

			<textarea
				bind:value={tempPersonality}
				placeholder="Enter personality description..."
				class="mb-3 h-24 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
			></textarea>

			<div class="flex justify-end space-x-2">
				<button
					onclick={handleCancelPersonalityEdit}
					class="rounded bg-gray-600 px-3 py-1 text-xs text-white hover:bg-gray-500"
				>
					Cancel
				</button>
				<button
					onclick={handleSavePersonality}
					class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
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
			onkeydown={handleKeydown}
			placeholder="Type your message and press Enter (also use /invite <name> <personality> to add other participants)"
			class="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
		/>
	</div>
</div>
