<script lang="ts">
	import BrowserFrame from '$lib/components/BrowserFrame.svelte';
	import { text } from '@sveltejs/kit';

	interface HistoryEntry {
		url: string;
		content: string;
	}

	let htmlBody = $state('');
	let isLoading = $state(false);
	let history = $state<HistoryEntry[]>([]);
	let currentHistoryIndex = $state(-1);
	let currentUrl = $state('');

	const handleUrlChange = async (event: CustomEvent<{ url: string; text?: string }>) => {
		console.log('URL changed to:', event.detail.url);
		isLoading = true;

		try {
			// Make a request to the browse API
			const response = await fetch('/api/browse', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ url: event.detail.url, text: event.detail.text })
			});

			if (response.ok) {
				const data = await response.json();
				console.log('API response:', data);

				// Filter out backticks, HTML markdown code blocks, and doctype tags
				let cleanedResult = data.result
					.replace(/```html\n?/g, '')
					.replace(/```\n?/g, '')
					.replace(/<!DOCTYPE[^>]*>/gi, '')
					.trim();

				htmlBody = cleanedResult;

				// Add to history if this is a new navigation (not back/forward)
				if (currentHistoryIndex === -1 || currentHistoryIndex === history.length - 1) {
					// Remove any entries after current index (if user went back and then navigated)
					history = history.slice(0, currentHistoryIndex + 1);
					// Add new entry
					history = [...history, { url: event.detail.url, content: cleanedResult }];
					currentHistoryIndex = history.length - 1;
					currentUrl = event.detail.url; // Update current URL
				}
			} else {
				console.error('Error fetching API:', response.statusText);
			}
		} catch (error) {
			console.error('Network error:', error);
		} finally {
			isLoading = false;
		}
	};

	const handleLinkClick = async (event: CustomEvent<{ url: string; text: string }>) => {
		console.log('Link clicked:', event.detail.text, 'URL:', event.detail.url);
		// Trigger the same URL change handler
		handleUrlChange(
			new CustomEvent('urlchange', { detail: { url: event.detail.url, text: event.detail.text } })
		);
	};

	const handleBack = () => {
		if (currentHistoryIndex > 0) {
			currentHistoryIndex--;
			const entry = history[currentHistoryIndex];
			htmlBody = entry.content;
			currentUrl = entry.url; // Update location bar
		}
	};

	const handleForward = () => {
		if (currentHistoryIndex < history.length - 1) {
			currentHistoryIndex++;
			const entry = history[currentHistoryIndex];
			htmlBody = entry.content;
			currentUrl = entry.url; // Update location bar
		}
	};

	const handleReload = () => {
		// Reload the current URL by making a new API request
		if (currentUrl) {
			handleUrlChange(new CustomEvent('urlchange', { detail: { url: currentUrl } }));
		}
	};

	const canGoBack = $derived(currentHistoryIndex > 0);
	const canGoForward = $derived(currentHistoryIndex < history.length - 1);
</script>

<BrowserFrame
	onurlchange={handleUrlChange}
	onlinkclick={handleLinkClick}
	onback={handleBack}
	onforward={handleForward}
	onreload={handleReload}
	contents={htmlBody}
	loading={isLoading}
	{canGoBack}
	{canGoForward}
	currentUrlProp={currentUrl}
/>
