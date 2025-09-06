<script lang="ts">
	interface Props {
		title: string;
		description: string;
		path: string;
		yearMonth: string;
	}

	let { title, description, path, yearMonth }: Props = $props();
</script>

<li class="relative py-4 first:pt-4 last:pb-4">
	<div
		class="absolute -left-9 mt-1 h-5 w-5 rounded-full border-4 border-neutral-900 bg-neutral-600"
	></div>
	<div class="flex items-center gap-3">
		<a class="hover:underline" href={path}>{title}</a>
	</div>
	{#if description}
		<p class="mt-2 text-xs text-neutral-500">{description}</p>
	{/if}
	<div class="my-4 text-xs text-neutral-600">{yearMonth}</div>
</li>
