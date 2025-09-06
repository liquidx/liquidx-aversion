<script lang="ts">
	import DemoItem from '$lib/components/DemoItem.svelte';

	const demos = [
		{
			title: 'multiplayer',
			description:
				'Exploration of multiplayer AI interaction using an LLM. Inspired by the multiplayer posts by Matt Webb.',
			path: '/of/multiplayer',
			yearMonth: '2025-09'
		},
		{
			title: 'navigator',
			description:
				'Exploration of a conceptual browser for an LLM. Look into what the LLM knows through a browser interface rather than chat. ',
			path: '/of/navigator',
			yearMonth: '2025-09'
		},
		{
			title: 'metro',
			description:
				'Vibe-coded metro map editor. Observing that this current crop of models do not design UX very well. A lot of work is needed to make the UX usable.',
			path: '/of/metro',
			yearMonth: '2025-08'
		},
		{
			title: 'codepoet',
			description:
				'Exploration of how code could be translated into poems and then back to code. Could you prompt an LLM through poetry to generate code? Could code be represented as poetry?',
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
</script>

<div class="p-4 text-xs">
	a running set of demos built by <a class="underline" href="https://liquidx.net/">@liquidx</a> using
	AI
</div>

<ul class="relative max-w-96 p-4 pl-12">
	<!-- Vertical line -->
	<div class="absolute top-0 bottom-0 left-5 w-0.5 bg-neutral-700"></div>

	{#each demos as demo}
		<DemoItem
			title={demo.title}
			description={demo.description}
			path={demo.path}
			yearMonth={demo.yearMonth}
		/>
	{/each}
</ul>
