<script lang="ts">
	import ToggleIconButton from './ToggleIconButton.svelte';
	import { 
		ArrowUp, 
		ArrowDown, 
		ArrowLeft, 
		ArrowRight,
		ArrowUpRight,
		ArrowUpLeft,
		ArrowDownLeft,
		ArrowDownRight
	} from '@lucide/svelte';

	interface Props {
		selectedAngle: number;
		onchange: (angle: number) => void;
	}

	let { selectedAngle, onchange }: Props = $props();

	const positions = [
		// Main directions
		{ icon: ArrowUp, angle: 90, title: 'Position label above (90°)' },
		{ icon: ArrowRight, angle: 0, title: 'Position label right (0°)' },
		{ icon: ArrowDown, angle: 270, title: 'Position label below (270°)' },
		{ icon: ArrowLeft, angle: 180, title: 'Position label left (180°)' },
		// Diagonal directions
		{ icon: ArrowUpRight, angle: 45, title: 'Position label top-right (45°)' },
		{ icon: ArrowUpLeft, angle: 135, title: 'Position label top-left (135°)' },
		{ icon: ArrowDownLeft, angle: 225, title: 'Position label bottom-left (225°)' },
		{ icon: ArrowDownRight, angle: 315, title: 'Position label bottom-right (315°)' }
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