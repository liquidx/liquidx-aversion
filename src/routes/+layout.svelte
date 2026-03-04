<script lang="ts">
	import '../app.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();
	injectAnalytics({ mode: dev ? 'development' : 'production' });
</script>

<div class="p-4">
	<div class="p-4 font-bold text-amber-700">
		<a class="hover:underline" href="/">a version one</a>
	</div>

	{@render children()}
</div>
