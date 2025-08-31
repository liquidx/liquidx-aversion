<script lang="ts">
	import BrowserFrameButton from './BrowserFrameButton.svelte';
	import BrowserFrameWindowButton from './BrowserFrameWindowButton.svelte';

	let currentUrl = $state('http://llmavigator.liquidx.net/');

	interface Props {
		contents?: string;
		onurlchange?: (event: CustomEvent<{ url: string }>) => void;
	}

	let {
		contents = `<h1>Welcome to LLMavigator</h1>
		<p>Your journey through the vast seas of Large Language Models begins here.</p>
	`,
		onurlchange
	}: Props = $props();

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			onurlchange?.(new CustomEvent('urlchange', { detail: { url: currentUrl } }));
		}
	}
</script>

<svelte:head>
	<title>Mosaic Netscape 0.9</title>
</svelte:head>

<div
	class="font-oldbrowser mx-auto mt-8 w-[800px] border-2 border-t-white border-r-gray-600 border-b-gray-600 border-l-white bg-gray-300 text-xs text-gray-600 shadow-lg"
>
	<div
		class="flex items-center justify-between bg-gradient-to-r from-blue-800 to-blue-400 px-2 py-1 font-bold text-white select-none"
	>
		<div>Mosaic Netscape 0.9</div>
		<div class="flex">
			<BrowserFrameWindowButton type="minimize" />
			<BrowserFrameWindowButton type="maximize" />
			<BrowserFrameWindowButton type="close" />
		</div>
	</div>

	<div class="flex p-0.5 select-none">
		<span class="mr-0.5 px-1.5 py-0.5"><u>F</u>ile</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>E</u>dit</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>V</u>iew</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>G</u>o</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>B</u>ookmarks</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>O</u>ptions</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>D</u>irectory</span>
		<span class="mr-0.5 px-1.5 py-0.5"><u>H</u>elp</span>
	</div>

	<div class="flex border-t border-b border-t-white border-b-gray-500 p-1">
		<BrowserFrameButton>Back</BrowserFrameButton>
		<BrowserFrameButton>Forward</BrowserFrameButton>
		<BrowserFrameButton>Home</BrowserFrameButton>
		<BrowserFrameButton>Reload</BrowserFrameButton>
		<BrowserFrameButton>Images</BrowserFrameButton>
		<BrowserFrameButton>Open</BrowserFrameButton>
		<BrowserFrameButton>Print</BrowserFrameButton>
		<BrowserFrameButton>Find</BrowserFrameButton>
		<BrowserFrameButton variant="stop">Stop</BrowserFrameButton>
	</div>

	<div class="flex items-center p-1">
		<label for="location-input" class="mr-2 font-bold">Location:</label>
		<input
			id="location-input"
			type="text"
			class="font-inherit flex-grow border-2 border-t-gray-600 border-r-gray-100 border-b-gray-100 border-l-gray-600 bg-white px-0.5 py-0.5 text-inherit"
			bind:value={currentUrl}
			onkeydown={handleKeyDown}
		/>
	</div>

	<div
		class=" content-area m-1 h-96 overflow-y-auto border-2 border-t-gray-500 border-r-white border-b-white border-l-gray-500 bg-white p-2.5"
	>
		{@html contents}
	</div>

	<div class="flex border-t border-t-white">
		<p
			class="m-0.5 flex-grow border border-t-gray-500 border-l-gray-500 px-1 py-0.5 whitespace-nowrap select-none"
		>
			Done
		</p>
		<p
			class="m-0.5 w-48 border border-t-gray-500 border-l-gray-500 px-1 py-0.5 whitespace-nowrap select-none"
		></p>
		<p
			class="m-0.5 w-5 border border-t-gray-500 border-l-gray-500 px-1 py-0.5 text-center whitespace-nowrap select-none"
		>
			🔒
		</p>
	</div>
</div>

<style>
	/* Content area styling for dynamic HTML - scoped to this component */
	.content-area :global(h1) {
		font-size: 24px;
		margin-top: 0;
	}

	.content-area :global(a) {
		color: #0000ff;
	}
</style>
