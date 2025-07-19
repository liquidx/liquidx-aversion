<script lang="ts">
	import ThreeInputField from '$lib/components/ThreeInputField.svelte';
	import { onMount } from 'svelte';

	let displayText = $state('abcd');

	onMount(() => {
		const handleKeyPress = (event: KeyboardEvent) => {
			if (event.key.length === 1) {
				displayText += event.key;
			} else if (event.key === 'Backspace') {
				displayText = displayText.slice(0, -1);
			}
		};

		window.addEventListener('keydown', handleKeyPress);

		return () => {
			window.removeEventListener('keydown', handleKeyPress);
		};
	});
</script>

<div class="scene-container">
	<ThreeInputField text={displayText} />
</div>

<style>
	.scene-container {
		position: relative;
		overflow: hidden;
	}
</style>
