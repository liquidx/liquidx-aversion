<script lang="ts">
	interface Props {
		active: boolean;
		onclick: () => void;
		children: any;
	}

	let { active, onclick, children }: Props = $props();
</script>

<button 
	class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 border {active ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}"
	{onclick}
>
	{@render children()}
</button>