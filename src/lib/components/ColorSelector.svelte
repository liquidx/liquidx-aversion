<script lang="ts">
	interface Props {
		value: string;
		onchange: (color: string) => void;
		label?: string;
	}

	let { value, onchange, label }: Props = $props();

	// Tailwind color palette with actual hex values
	const colorOptions = [
		{ name: 'Red', hex: '#ef4444', class: 'bg-red-500' },
		{ name: 'Orange', hex: '#f97316', class: 'bg-orange-500' },
		{ name: 'Amber', hex: '#f59e0b', class: 'bg-amber-500' },
		{ name: 'Yellow', hex: '#eab308', class: 'bg-yellow-500' },
		{ name: 'Lime', hex: '#84cc16', class: 'bg-lime-500' },
		{ name: 'Green', hex: '#22c55e', class: 'bg-green-500' },
		{ name: 'Emerald', hex: '#10b981', class: 'bg-emerald-500' },
		{ name: 'Teal', hex: '#14b8a6', class: 'bg-teal-500' },
		{ name: 'Cyan', hex: '#06b6d4', class: 'bg-cyan-500' },
		{ name: 'Sky', hex: '#0ea5e9', class: 'bg-sky-500' },
		{ name: 'Blue', hex: '#3b82f6', class: 'bg-blue-500' },
		{ name: 'Indigo', hex: '#6366f1', class: 'bg-indigo-500' },
		{ name: 'Violet', hex: '#8b5cf6', class: 'bg-violet-500' },
		{ name: 'Purple', hex: '#a855f7', class: 'bg-purple-500' },
		{ name: 'Fuchsia', hex: '#d946ef', class: 'bg-fuchsia-500' },
		{ name: 'Pink', hex: '#ec4899', class: 'bg-pink-500' },
		{ name: 'Rose', hex: '#f43f5e', class: 'bg-rose-500' },
		{ name: 'Slate', hex: '#64748b', class: 'bg-slate-500' },
		{ name: 'Gray', hex: '#6b7280', class: 'bg-gray-500' },
		{ name: 'Zinc', hex: '#71717a', class: 'bg-zinc-500' },
		{ name: 'Neutral', hex: '#737373', class: 'bg-neutral-500' },
		{ name: 'Stone', hex: '#78716c', class: 'bg-stone-500' }
	];

	let showDropdown = $state(false);

	// Find the current color option or default to the first one
	let currentColor = $derived.by(() => {
		return (
			colorOptions.find((color) => color.hex.toLowerCase() === value.toLowerCase()) ||
			colorOptions[0]
		);
	});

	function selectColor(color: (typeof colorOptions)[0]) {
		onchange(color.hex);
		showDropdown = false;
	}

	function toggleDropdown() {
		showDropdown = !showDropdown;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.color-selector')) {
			showDropdown = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="color-selector relative flex items-center gap-2">
	{#if label}
		<label class="text-xs font-medium text-white">{label}</label>
	{/if}

	<button
		type="button"
		onclick={toggleDropdown}
		aria-label="Select color"
		class="flex h-10 w-12 items-center justify-center rounded-md border border-slate-600 bg-slate-700 transition-colors hover:bg-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
	>
		<div
			class="h-6 w-6 rounded-full border-2 border-slate-400"
			style="background-color: {currentColor.hex}"
		></div>
	</button>

	{#if showDropdown}
		<div class="absolute z-10 mt-1 w-48 rounded-md border border-slate-600 bg-slate-800 shadow-lg">
			<div class="grid grid-cols-6 gap-2 p-3">
				{#each colorOptions as color}
					<button
						type="button"
						onclick={() => selectColor(color)}
						title={color.name}
						aria-label="Select {color.name}"
						class="m-0.5 h-7 w-7 rounded-full transition-all hover:scale-110 {currentColor.hex ===
						color.hex
							? 'ring-2 ring-white'
							: ''} {color.class}"
					>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
