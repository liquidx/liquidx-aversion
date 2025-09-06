<script lang="ts">
	import DemoItem from '$lib/components/DemoItem.svelte';
	import { demos } from '$lib/demos.js';
</script>

<div class="p-4 text-xs">
	a running set of demos built by
	<a class="underline" href="https://liquidx.net/" target="_blank">@liquidx</a>
	using AI. (<a
		class="underline"
		href="https://github.com/liquidx/liquidx-aversion/"
		target="_blank">github</a
	>).
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
