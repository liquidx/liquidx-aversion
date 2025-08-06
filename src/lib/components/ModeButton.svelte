<script lang="ts">
	interface Props {
		active: boolean;
		onclick: () => void;
		children: any;
	}

	let { active, onclick, children }: Props = $props();
</script>

<button
	class="inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-150 {active
		? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
		: 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}"
	{onclick}
>
	{@render children()}
</button>
