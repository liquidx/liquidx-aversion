<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="p-4">
	<div class="p-4 font-bold text-amber-700">
		<a class="hover:underline" href="/">a version one</a>
	</div>

	{@render children()}
</div>
