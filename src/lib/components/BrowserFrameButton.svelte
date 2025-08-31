<script lang="ts">
	interface Props {
		children: any;
		onclick?: () => void;
		variant?: 'normal' | 'stop';
	}

	let { children, onclick, variant = 'normal' }: Props = $props();

	const baseClasses =
		'text-gray-600 hover:bg-gray-300 border-2 border-t-gray-100 border-l-gray-100 border-r-gray-600 border-b-gray-600 px-2 py-1 mr-1 min-w-15 active:border-inset';
	const stopClasses = 'text-red-600 font-bold';
</script>

<button class="{baseClasses} {variant === 'stop' ? stopClasses : ''}" {onclick}>
	{@render children()}
</button>
