<script lang="ts">
	import ThreeScene from '$lib/components/ThreeScene.svelte';
	import { onMount } from 'svelte';

	let displayText = $state('1');

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

<svelte:head>
	<title>Three.js Demo - A Version One</title>
</svelte:head>

<div class="scene-container">
	<ThreeScene text={displayText} />
</div>

<style>
	.scene-container {
		position: relative;
		overflow: hidden;
	}
</style>
