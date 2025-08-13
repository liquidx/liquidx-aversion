<script lang="ts">
	import ToggleIconButton from './ToggleIconButton.svelte';
	import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from '@lucide/svelte';

	interface Props {
		selectedAngle: number;
		onchange: (angle: number) => void;
	}

	let { selectedAngle, onchange }: Props = $props();

	const positions = [
		{ icon: ArrowUp, angle: 90, title: 'Position label above (90°)' },
		{ icon: ArrowDown, angle: 270, title: 'Position label below (270°)' },
		{ icon: ArrowLeft, angle: 180, title: 'Position label left (180°)' },
		{ icon: ArrowRight, angle: 0, title: 'Position label right (0°)' }
	];
</script>

<div class="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 p-1">
	{#each positions as position}
		<ToggleIconButton
			icon={position.icon}
			onclick={() => onchange(position.angle)}
			selected={selectedAngle === position.angle}
			title={position.title}
		/>
	{/each}
</div>