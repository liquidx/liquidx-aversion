<script lang="ts">
	interface Props {
		loading?: boolean;
	}

	let { loading = false }: Props = $props();
</script>

<div class="flex items-center justify-center w-8 h-8 ml-2">
	<div class="relative w-6 h-6">
		<!-- Pixel art globe using CSS -->
		<div class="absolute inset-0 {loading ? 'animate-spin' : ''}" style="animation-duration: 2s;">
			<!-- Globe outline -->
			<div class="absolute inset-0 rounded-full border-2 border-blue-600 bg-blue-100"></div>
			
			<!-- Continents (simplified pixel art style) -->
			<div class="absolute top-1 left-1 w-1 h-1 bg-green-600 rounded-sm"></div>
			<div class="absolute top-1 right-1 w-1 h-1 bg-green-600 rounded-sm"></div>
			<div class="absolute top-2 left-2 w-2 h-1 bg-green-600 rounded-sm"></div>
			<div class="absolute bottom-2 left-1 w-1 h-1 bg-green-600 rounded-sm"></div>
			<div class="absolute bottom-1 right-2 w-1 h-1 bg-green-600 rounded-sm"></div>
			
			<!-- Grid lines for globe effect -->
			<div class="absolute top-0 left-1/2 w-px h-full bg-blue-400 opacity-50"></div>
			<div class="absolute left-0 top-1/2 w-full h-px bg-blue-400 opacity-50"></div>
		</div>
		
		<!-- Optional loading dots -->
		{#if loading}
			<div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
				<div class="flex space-x-px">
					<div class="w-px h-px bg-blue-600 animate-pulse"></div>
					<div class="w-px h-px bg-blue-600 animate-pulse" style="animation-delay: 0.2s;"></div>
					<div class="w-px h-px bg-blue-600 animate-pulse" style="animation-delay: 0.4s;"></div>
				</div>
			</div>
		{/if}
	</div>
</div>