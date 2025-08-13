<script lang="ts">
	import ToggleIconButton from './ToggleIconButton.svelte';
	import { MapPin, Route } from '@lucide/svelte';

	interface Props {
		selectedMode: 'station' | 'line';
		onchange: (mode: 'station' | 'line') => void;
	}

	let { selectedMode, onchange }: Props = $props();

	const modes = [
		{ id: 'station' as const, icon: MapPin, title: 'Station Mode' },
		{ id: 'line' as const, icon: Route, title: 'Line Mode' }
	];
</script>

<div class="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 p-1">
	{#each modes as mode}
		<ToggleIconButton
			icon={mode.icon}
			iconSize={18}
			selected={selectedMode === mode.id}
			onclick={() => onchange(mode.id)}
			title={mode.title}
		/>
	{/each}
</div>
