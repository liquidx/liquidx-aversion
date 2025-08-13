<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		icon: Component;
		iconSize?: number;
		onclick?: () => void;
		selected?: boolean;
		title?: string;
		size?: 'sm' | 'md';
	}

	let {
		icon: Icon,
		iconSize = 14,
		onclick,
		selected = false,
		title = '',
		size = 'sm'
	}: Props = $props();

	const baseClass = 'flex items-center justify-center rounded-md transition-colors';

	const sizeClasses = {
		sm: 'h-8 w-8',
		md: 'h-10 w-10'
	};

	const buttonClass = $derived(
		`${baseClass} ${sizeClasses[size]} ${
			selected ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-600 hover:text-white'
		}`
	);
</script>

<button {onclick} {title} class={buttonClass}>
	<Icon size={iconSize} />
</button>
