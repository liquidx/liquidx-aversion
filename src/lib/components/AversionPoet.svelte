<script lang="ts">
	let inputText = '';
	let outputPoem = '';
	let isConverting = false;

	async function convertToPoem() {
		if (!inputText.trim()) return;

		const prompt = `Read the follow code and write a poem that describes what the code does: ${inputText}`;

		isConverting = true;
		try {
			const response = await fetch('/api/gemini/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ prompt: prompt })
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			console.log(data);
			outputPoem = data.response || 'No poem generated';
		} catch (error) {
			console.error('Error generating poem:', error);
			outputPoem = 'Error generating poem. Please try again.';
		} finally {
			isConverting = false;
		}
	}
</script>

<div class="aversion-poet-container">
	<div class="text-boxes-container">
		<!-- Input Text Box -->
		<div class="text-box-wrapper">
			<h3 class="text-box-title">Input Code</h3>
			<textarea
				bind:value={inputText}
				placeholder="Paste your code here..."
				class="text-box input-box"
				rows="20"
			></textarea>
		</div>

		<!-- Convert Button -->
		<div class="convert-button-wrapper">
			<button
				on:click={convertToPoem}
				disabled={!inputText.trim() || isConverting}
				class="convert-button"
			>
				{#if isConverting}
					<span class="loading-spinner"></span>
					Converting...
				{:else}
					Convert to Poem
				{/if}
			</button>
		</div>

		<!-- Output Text Box -->
		<div class="text-box-wrapper">
			<h3 class="text-box-title">Generated Poem</h3>
			<textarea
				bind:value={outputPoem}
				placeholder="Your poem will appear here..."
				class="text-box output-box"
				rows="20"
				readonly
			></textarea>
		</div>
	</div>
</div>

<style>
	.aversion-poet-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.text-boxes-container {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 2rem;
		align-items: start;
	}

	.text-box-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.text-box-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151;
		margin: 0;
	}

	.text-box {
		width: 100%;
		min-height: 400px;
		padding: 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 0.5rem;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
		resize: vertical;
		transition: border-color 0.2s ease;
	}

	.text-box:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.input-box {
		background-color: #f9fafb;
	}

	.output-box {
		background-color: #fefefe;
		color: #1f2937;
	}

	.convert-button-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 400px;
	}

	.convert-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		min-width: 160px;
		justify-content: center;
	}

	.convert-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 12px -1px rgba(0, 0, 0, 0.15);
	}

	.convert-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.convert-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.loading-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.text-boxes-container {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.convert-button-wrapper {
			min-height: auto;
			order: 2;
		}

		.text-box {
			min-height: 300px;
		}

		.aversion-poet-container {
			padding: 1rem;
		}
	}
</style>
