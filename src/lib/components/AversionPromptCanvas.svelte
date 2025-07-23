<script lang="ts">
	import { onMount } from 'svelte';

	interface CanvasImage {
		id: string;
		img: HTMLImageElement;
		x: number;
		y: number;
		width: number;
		height: number;
		isDragging: boolean;
	}

	interface CanvasText {
		id: string;
		text: string;
		x: number;
		y: number;
		isEditing: boolean;
		isDragging: boolean;
	}

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let canvasContainer: HTMLDivElement;

	let images: CanvasImage[] = [];
	let texts: CanvasText[] = [];

	let isDragOver = false;
	let dragOffset = { x: 0, y: 0 };
	let activeItem: CanvasImage | CanvasText | null = null;

	let editingText: CanvasText | null = null;
	let textInput: HTMLInputElement;

	// Generation state
	let generatedResponse = '';
	let isGenerating = false;
	let lastSnapshot = '';

	const CANVAS_WIDTH = 1000;
	const CANVAS_HEIGHT = 1000;
	const MAX_IMAGE_SIZE = 200;

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		canvas.width = CANVAS_WIDTH;
		canvas.height = CANVAS_HEIGHT;

		// Set up canvas styling
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.font = '24px Arial';

		render();
	});

	function render() {
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		// Draw background
		ctx.fillStyle = '#f8f9fa';
		ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		// Draw border
		ctx.strokeStyle = '#dee2e6';
		ctx.lineWidth = 2;
		ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		// Draw images
		images.forEach((img) => {
			ctx.drawImage(img.img, img.x, img.y, img.width, img.height);

			// Draw selection border if dragging
			if (img.isDragging) {
				ctx.strokeStyle = '#007bff';
				ctx.lineWidth = 2;
				ctx.strokeRect(img.x, img.y, img.width, img.height);
			}
		});

		// Draw texts
		texts.forEach((text) => {
			if (!text.isEditing) {
				ctx.fillStyle = '#212529';
				ctx.fillText(text.text || 'Click to edit...', text.x, text.y);

				// Draw selection border if dragging
				if (text.isDragging) {
					const metrics = ctx.measureText(text.text || 'Click to edit...');
					ctx.strokeStyle = '#007bff';
					ctx.lineWidth = 2;
					ctx.strokeRect(text.x - 2, text.y - 2, metrics.width + 4, 28);
				}
			}
		});
	}

	// Image drag and drop functionality
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.type.startsWith('image/')) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				// Calculate resize to fit within MAX_IMAGE_SIZE
				let { width, height } = img;
				const scale = Math.min(MAX_IMAGE_SIZE / width, MAX_IMAGE_SIZE / height);
				width *= scale;
				height *= scale;

				// Get drop position relative to canvas
				const rect = canvas.getBoundingClientRect();
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;

				const newImage: CanvasImage = {
					id: Date.now().toString(),
					img,
					x: Math.max(0, Math.min(x - width / 2, CANVAS_WIDTH - width)),
					y: Math.max(0, Math.min(y - height / 2, CANVAS_HEIGHT - height)),
					width,
					height,
					isDragging: false
				};

				images = [...images, newImage];
				render();
			};
			img.src = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	// Canvas click handling
	function handleCanvasClick(event: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		// Check if clicking on existing text
		for (const text of texts) {
			if (!text.isEditing) {
				const metrics = ctx.measureText(text.text || 'Click to edit...');
				if (x >= text.x && x <= text.x + metrics.width && y >= text.y && y <= text.y + 28) {
					startEditingText(text);
					return;
				}
			}
		}

		// Check if clicking on existing image
		for (const img of images) {
			if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
				// Don't create text on image
				return;
			}
		}

		// Create new text at click position
		const newText: CanvasText = {
			id: Date.now().toString(),
			text: '',
			x,
			y,
			isEditing: true,
			isDragging: false
		};

		texts = [...texts, newText];
		startEditingText(newText);
	}

	// Text editing functionality
	function startEditingText(text: CanvasText) {
		editingText = text;
		text.isEditing = true;

		// Position input over the text
		if (textInput) {
			textInput.style.left = `${text.x}px`;
			textInput.style.top = `${text.y}px`;
			textInput.value = text.text;
			textInput.style.display = 'block';
			textInput.focus();
		}

		render();
	}

	function finishEditingText() {
		if (editingText && textInput) {
			editingText.text = textInput.value;
			editingText.isEditing = false;

			// Remove empty texts
			if (!editingText.text.trim()) {
				texts = texts.filter((t) => t.id !== editingText!.id);
			}

			textInput.style.display = 'none';
			editingText = null;
			render();
		}
	}

	// Mouse dragging functionality
	function handleMouseDown(event: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		// Check for text
		for (const text of texts) {
			if (!text.isEditing) {
				const metrics = ctx.measureText(text.text || 'Click to edit...');
				if (x >= text.x && x <= text.x + metrics.width && y >= text.y && y <= text.y + 28) {
					activeItem = text;
					text.isDragging = true;
					dragOffset = { x: x - text.x, y: y - text.y };
					render();
					return;
				}
			}
		}

		// Check for images
		for (const img of images) {
			if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
				activeItem = img;
				img.isDragging = true;
				dragOffset = { x: x - img.x, y: y - img.y };
				render();
				return;
			}
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (!activeItem) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		if ('width' in activeItem) {
			// Image
			activeItem.x = Math.max(0, Math.min(x - dragOffset.x, CANVAS_WIDTH - activeItem.width));
			activeItem.y = Math.max(0, Math.min(y - dragOffset.y, CANVAS_HEIGHT - activeItem.height));
		} else {
			// Text
			activeItem.x = Math.max(0, Math.min(x - dragOffset.x, CANVAS_WIDTH - 100));
			activeItem.y = Math.max(0, Math.min(y - dragOffset.y, CANVAS_HEIGHT - 28));
		}

		render();
	}

	function handleMouseUp() {
		if (activeItem) {
			activeItem.isDragging = false;
			activeItem = null;
			render();
		}
	}

	// Keyboard handling
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && editingText) {
			finishEditingText();
		}
	}

	// Snapshot and generation functionality
	function takeSnapshot(): string {
		const dataURL = canvas.toDataURL('image/png');
		lastSnapshot = dataURL;
		return dataURL;
	}

	async function generateFromCanvas() {
		const snapshot = takeSnapshot();
		isGenerating = true;
		generatedResponse = '';

		try {
			const response = await fetch('/api/gemini/vision', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: 'Do what the image says.',
					image: snapshot
				})
			});

			const result = await response.json();

			if (response.ok) {
				generatedResponse = result.response;
			} else {
				generatedResponse = `Error: ${result.error}`;
			}
		} catch (error) {
			console.error('Error generating from canvas:', error);
			generatedResponse = 'Error occurred while generating response';
		} finally {
			isGenerating = false;
		}
	}

	function downloadSnapshot() {
		const snapshot = takeSnapshot();
		const link = document.createElement('a');
		link.download = `prompt-canvas-${new Date().toISOString().slice(0, 19)}.png`;
		link.href = snapshot;
		link.click();
	}
</script>

<svelte:window
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
	on:keydown={handleKeyDown}
/>

<div class="mx-auto max-w-4xl p-8">
	<h1 class="mb-6 text-3xl font-bold text-gray-800">Prompt Canvas</h1>

	<div class="mb-4 text-sm text-gray-600">
		<p>• Drag and drop images onto the canvas</p>
		<p>• Click anywhere to create editable text</p>
		<p>• Drag images and text to reposition them</p>
		<p>• Generate AI descriptions of your canvas</p>
	</div>

	<!-- Generate Button Above Canvas -->
	<div class="mb-4 flex justify-center">
		<button
			on:click={generateFromCanvas}
			disabled={isGenerating}
			class="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-3 font-semibold text-white transition-all hover:not-disabled:translate-y-[-1px] hover:not-disabled:shadow-lg disabled:transform-none disabled:cursor-not-allowed disabled:opacity-60"
		>
			{#if isGenerating}
				<span class="flex items-center justify-center gap-2">
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"
					></span>
					Generating...
				</span>
			{:else}
				Do it
			{/if}
		</button>
	</div>

	<!-- Canvas Section -->
	<div class="mb-4 flex justify-center">
		<div
			bind:this={canvasContainer}
			class="relative inline-block rounded-lg border-2 border-dashed border-gray-300"
			class:border-blue-400={isDragOver}
			class:bg-blue-50={isDragOver}
			role="application"
			aria-label="Canvas for drag and drop images and text editing"
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			on:drop={handleDrop}
		>
			<canvas
				bind:this={canvas}
				class="block cursor-crosshair"
				on:click={handleCanvasClick}
				on:mousedown={handleMouseDown}
			></canvas>

			<!-- Hidden text input for editing -->
			<input
				bind:this={textInput}
				type="text"
				class="absolute border border-gray-300 bg-white px-2 py-1 font-mono text-xl"
				style="display: none; z-index: 10;"
				on:blur={finishEditingText}
				placeholder="Enter text..."
			/>
		</div>
	</div>

	<!-- Canvas Controls -->
	<div class="mb-6 flex justify-center">
		<button
			on:click={downloadSnapshot}
			class="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
		>
			📸 Download Snapshot
		</button>
	</div>

	<!-- Response Display -->
	{#if generatedResponse}
		<div class="rounded-lg border border-gray-300 bg-white p-6">
			<h2 class="mb-4 text-xl font-semibold text-gray-800">AI Description:</h2>
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<pre class="text-sm whitespace-pre-wrap text-gray-800">{generatedResponse}</pre>
			</div>

			<!-- Last Snapshot Preview -->
			{#if lastSnapshot}
				<div class="mt-4">
					<h3 class="mb-2 text-lg font-medium text-gray-800">Analyzed Image:</h3>
					<img
						src={lastSnapshot}
						alt="Last canvas snapshot that was analyzed"
						class="h-auto max-w-full rounded-lg border border-gray-300"
						style="max-height: 200px;"
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>
