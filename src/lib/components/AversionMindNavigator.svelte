<script lang="ts">
	import BrowserFrame from '$lib/components/BrowserFrame.svelte';

	let htmlBody = '';

	const handleUrlChange = async (event: CustomEvent<{ url: string }>) => {
		console.log('URL changed to:', event.detail.url);
		// Make a request to the browse API
		const response = await fetch('/api/browse', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ url: event.detail.url })
		});

		if (response.ok) {
			const data = await response.json();
			console.log('API response:', data);

			// Filter out backticks, HTML markdown code blocks, and doctype tags
			let cleanedResult = data.result
				.replace(/```html\n?/g, '')
				.replace(/```\n?/g, '')
				.replace(/<!DOCTYPE[^>]*>/gi, '')
				.replace(/<html[^>]*>/gi, '')
				.replace(/<\/html>/gi, '')
				.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
				.replace(/<body[^>]*>/gi, '')
				.replace(/<\/body>/gi, '')
				.trim();

			htmlBody = cleanedResult;
		} else {
			console.error('Error fetching API:', response.statusText);
		}
	};
</script>

<BrowserFrame onurlchange={handleUrlChange} contents={htmlBody} />
