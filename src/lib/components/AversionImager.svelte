<script lang="ts">
	import { tick } from 'svelte';

	interface ImageState {
		original: ImageData | null;
		processed: ImageData | null;
		width: number;
		height: number;
	}

	// State
	let fileInput: HTMLInputElement;
	let sourceCanvas: HTMLCanvasElement;
	let previewCanvas: HTMLCanvasElement;
	let isDragging = $state(false);
	let imageLoaded = $state(false);
	let isProcessing = $state(false);
	let statusMessage = $state('');
	let originalFilename = $state('');

	let imageState: ImageState = $state({
		original: null,
		processed: null,
		width: 0,
		height: 0
	});

	// Background removal settings
	let bgRemovalMode = $state<'color' | 'corners' | 'contiguous'>('contiguous');
	let bgColor = $state('#ffffff');
	let bgTolerance = $state(10);

	// Scale settings
	let scaleMode = $state<'percentage' | 'dimensions' | 'physical'>('physical');
	let scalePercentage = $state(100);
	let targetWidth = $state(0);
	let targetHeight = $state(0);
	let maintainAspectRatio = $state(true);
	let physicalHeightCm = $state(10);
	const pixelsPerCm = 8;

	// Pad settings
	let padWidth = $state(400);
	let padHeight = $state(1600);

	// Everything tool settings
	let everythingHeightCm = $state(10);

	// Crop tool settings
	let cropMode = $state(false);
	let cropStart = $state<{ x: number; y: number } | null>(null);
	let cropEnd = $state<{ x: number; y: number } | null>(null);
	let isDraggingCrop = $state(false);

	// History for undo
	let history: ImageData[] = $state([]);
	let historyIndex = $state(-1);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			loadImage(files[0]);
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			loadImage(target.files[0]);
		}
	}

	function loadImage(file: File) {
		if (!file.type.startsWith('image/')) {
			statusMessage = 'Please select an image file';
			return;
		}

		// Store original filename without extension
		originalFilename = file.name.replace(/\.[^/.]+$/, '');

		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = async () => {
				imageState.width = img.width;
				imageState.height = img.height;
				targetWidth = img.width;
				targetHeight = img.height;

				// Draw to source canvas
				sourceCanvas.width = img.width;
				sourceCanvas.height = img.height;
				const ctx = sourceCanvas.getContext('2d')!;
				ctx.drawImage(img, 0, 0);
				imageState.original = ctx.getImageData(0, 0, img.width, img.height);
				imageState.processed = ctx.getImageData(0, 0, img.width, img.height);

				// Reset history
				history = [cloneImageData(imageState.original)];
				historyIndex = 0;

				// Set imageLoaded to show the preview canvas, then wait for DOM update
				imageLoaded = true;
				statusMessage = '';

				// Wait for DOM to update so previewCanvas exists
				await tick();

				// Copy to preview canvas
				previewCanvas.width = img.width;
				previewCanvas.height = img.height;
				const previewCtx = previewCanvas.getContext('2d')!;
				previewCtx.putImageData(imageState.original, 0, 0);
			};
			img.src = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function cloneImageData(imageData: ImageData): ImageData {
		return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
	}

	function pushToHistory(imageData: ImageData) {
		// Remove any future history if we're not at the end
		history = history.slice(0, historyIndex + 1);
		history.push(cloneImageData(imageData));
		historyIndex = history.length - 1;
	}

	function undo() {
		if (historyIndex > 0) {
			historyIndex--;
			const prevState = history[historyIndex];
			applyImageData(prevState);
		}
	}

	function redo() {
		if (historyIndex < history.length - 1) {
			historyIndex++;
			const nextState = history[historyIndex];
			applyImageData(nextState);
		}
	}

	function applyImageData(imageData: ImageData) {
		previewCanvas.width = imageData.width;
		previewCanvas.height = imageData.height;
		const ctx = previewCanvas.getContext('2d')!;
		ctx.putImageData(imageData, 0, 0);
		imageState.processed = cloneImageData(imageData);
		imageState.width = imageData.width;
		imageState.height = imageData.height;
		targetWidth = imageData.width;
		targetHeight = imageData.height;
	}

	function resetToOriginal() {
		if (imageState.original) {
			applyImageData(imageState.original);
			history = [cloneImageData(imageState.original)];
			historyIndex = 0;
			statusMessage = 'Reset to original';
		}
	}

	// Background removal
	function removeBackground() {
		if (!imageState.processed) return;

		isProcessing = true;
		statusMessage = 'Removing background...';

		requestAnimationFrame(() => {
			const src = cloneImageData(imageState.processed!);
			const data = src.data;
			const width = src.width;
			const height = src.height;

			let targetR: number, targetG: number, targetB: number;

			if (bgRemovalMode === 'color') {
				// Parse hex color
				const hex = bgColor.replace('#', '');
				targetR = parseInt(hex.substring(0, 2), 16);
				targetG = parseInt(hex.substring(2, 4), 16);
				targetB = parseInt(hex.substring(4, 6), 16);
			} else {
				// Sample corners to detect background color
				const corners = [
					0, // top-left
					(width - 1) * 4, // top-right
					(height - 1) * width * 4, // bottom-left
					((height - 1) * width + width - 1) * 4 // bottom-right
				];

				let rSum = 0,
					gSum = 0,
					bSum = 0;
				for (const idx of corners) {
					rSum += data[idx];
					gSum += data[idx + 1];
					bSum += data[idx + 2];
				}
				targetR = Math.round(rSum / 4);
				targetG = Math.round(gSum / 4);
				targetB = Math.round(bSum / 4);
			}

			const tolerance = bgTolerance;
			let removed = 0;

			// Helper to check if a pixel matches the target color
			const matchesTarget = (idx: number): boolean => {
				const r = data[idx];
				const g = data[idx + 1];
				const b = data[idx + 2];
				const diff = Math.sqrt(
					Math.pow(r - targetR, 2) + Math.pow(g - targetG, 2) + Math.pow(b - targetB, 2)
				);
				return diff <= tolerance;
			};

			if (bgRemovalMode === 'contiguous') {
				// Flood-fill from corners - only remove connected background pixels
				const visited = new Uint8Array(width * height);

				// Scanline flood-fill algorithm
				const floodFill = (startX: number, startY: number) => {
					const stack: Array<[number, number]> = [[startX, startY]];

					while (stack.length > 0) {
						const [x, y] = stack.pop()!;

						if (x < 0 || x >= width || y < 0 || y >= height) continue;

						const pixelIdx = y * width + x;
						if (visited[pixelIdx]) continue;

						const dataIdx = pixelIdx * 4;
						if (data[dataIdx + 3] === 0) continue; // Already transparent
						if (!matchesTarget(dataIdx)) continue;

						visited[pixelIdx] = 1;
						data[dataIdx + 3] = 0; // Set alpha to 0
						removed++;

						// Add neighboring pixels to stack
						stack.push([x + 1, y]);
						stack.push([x - 1, y]);
						stack.push([x, y + 1]);
						stack.push([x, y - 1]);
					}
				};

				// Start flood-fill from all four corners
				floodFill(0, 0);
				floodFill(width - 1, 0);
				floodFill(0, height - 1);
				floodFill(width - 1, height - 1);
			} else {
				// Original behavior: remove all matching pixels
				for (let i = 0; i < data.length; i += 4) {
					if (matchesTarget(i)) {
						data[i + 3] = 0; // Set alpha to 0
						removed++;
					}
				}
			}

			applyImageData(src);
			pushToHistory(src);
			isProcessing = false;
			statusMessage = `Removed ${removed.toLocaleString()} pixels`;
		});
	}

	// Auto trim
	function autoTrim() {
		if (!imageState.processed) return;

		isProcessing = true;
		statusMessage = 'Trimming...';

		requestAnimationFrame(() => {
			const src = imageState.processed!;
			const data = src.data;
			const width = src.width;
			const height = src.height;

			let minX = width;
			let minY = height;
			let maxX = 0;
			let maxY = 0;

			// Find bounding box of non-transparent pixels
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const idx = (y * width + x) * 4;
					const alpha = data[idx + 3];

					if (alpha > 0) {
						minX = Math.min(minX, x);
						minY = Math.min(minY, y);
						maxX = Math.max(maxX, x);
						maxY = Math.max(maxY, y);
					}
				}
			}

			if (minX >= maxX || minY >= maxY) {
				isProcessing = false;
				statusMessage = 'No visible pixels found';
				return;
			}

			const newWidth = maxX - minX + 1;
			const newHeight = maxY - minY + 1;

			// Create new trimmed image
			const trimmed = new ImageData(newWidth, newHeight);
			const trimmedData = trimmed.data;

			for (let y = 0; y < newHeight; y++) {
				for (let x = 0; x < newWidth; x++) {
					const srcIdx = ((y + minY) * width + (x + minX)) * 4;
					const dstIdx = (y * newWidth + x) * 4;
					trimmedData[dstIdx] = data[srcIdx];
					trimmedData[dstIdx + 1] = data[srcIdx + 1];
					trimmedData[dstIdx + 2] = data[srcIdx + 2];
					trimmedData[dstIdx + 3] = data[srcIdx + 3];
				}
			}

			applyImageData(trimmed);
			pushToHistory(trimmed);
			isProcessing = false;
			statusMessage = `Trimmed to ${newWidth} × ${newHeight} pixels`;
		});
	}

	// Scale
	function updateTargetWidth(newWidth: number) {
		targetWidth = newWidth;
		if (maintainAspectRatio && imageState.processed) {
			const ratio = imageState.processed.height / imageState.processed.width;
			targetHeight = Math.round(newWidth * ratio);
		}
	}

	function updateTargetHeight(newHeight: number) {
		targetHeight = newHeight;
		if (maintainAspectRatio && imageState.processed) {
			const ratio = imageState.processed.width / imageState.processed.height;
			targetWidth = Math.round(newHeight * ratio);
		}
	}

	function applyScale() {
		if (!imageState.processed) return;

		let newWidth: number, newHeight: number;

		if (scaleMode === 'percentage') {
			newWidth = Math.round((imageState.processed.width * scalePercentage) / 100);
			newHeight = Math.round((imageState.processed.height * scalePercentage) / 100);
		} else if (scaleMode === 'physical') {
			// Convert cm to pixels and scale proportionally based on height
			newHeight = Math.round(physicalHeightCm * pixelsPerCm);
			const ratio = imageState.processed.width / imageState.processed.height;
			newWidth = Math.round(newHeight * ratio);
		} else {
			newWidth = targetWidth;
			newHeight = targetHeight;
		}

		if (newWidth < 1 || newHeight < 1) {
			statusMessage = 'Invalid dimensions';
			return;
		}

		isProcessing = true;
		statusMessage = 'Scaling...';

		requestAnimationFrame(() => {
			// Use a temporary canvas for high-quality scaling
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = imageState.processed!.width;
			tempCanvas.height = imageState.processed!.height;
			const tempCtx = tempCanvas.getContext('2d')!;
			tempCtx.putImageData(imageState.processed!, 0, 0);

			// Create scaled canvas
			const scaledCanvas = document.createElement('canvas');
			scaledCanvas.width = newWidth;
			scaledCanvas.height = newHeight;
			const scaledCtx = scaledCanvas.getContext('2d')!;
			scaledCtx.imageSmoothingEnabled = true;
			scaledCtx.imageSmoothingQuality = 'high';
			scaledCtx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);

			const scaled = scaledCtx.getImageData(0, 0, newWidth, newHeight);
			applyImageData(scaled);
			pushToHistory(scaled);

			scalePercentage = 100;
			isProcessing = false;
			statusMessage = `Scaled to ${newWidth} × ${newHeight} pixels`;
		});
	}

	// Pad image
	function padImage() {
		if (!imageState.processed) return;

		const srcWidth = imageState.processed.width;
		const srcHeight = imageState.processed.height;

		// Check if image fits in container
		if (srcWidth > padWidth || srcHeight > padHeight) {
			statusMessage = `Image (${srcWidth}×${srcHeight}) is larger than container (${padWidth}×${padHeight})`;
			return;
		}

		isProcessing = true;
		statusMessage = 'Padding image...';

		requestAnimationFrame(() => {
			// Create new canvas with container dimensions
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = padWidth;
			tempCanvas.height = padHeight;
			const ctx = tempCanvas.getContext('2d')!;

			// Clear with transparent background
			ctx.clearRect(0, 0, padWidth, padHeight);

			// Put source image data on a temp canvas to draw from
			const srcCanvas = document.createElement('canvas');
			srcCanvas.width = srcWidth;
			srcCanvas.height = srcHeight;
			const srcCtx = srcCanvas.getContext('2d')!;
			srcCtx.putImageData(imageState.processed!, 0, 0);

			// Calculate position: horizontally centered, vertically bottom-aligned
			const x = Math.round((padWidth - srcWidth) / 2);
			const y = padHeight - srcHeight;

			// Draw the image
			ctx.drawImage(srcCanvas, x, y);

			const padded = ctx.getImageData(0, 0, padWidth, padHeight);
			applyImageData(padded);
			pushToHistory(padded);

			isProcessing = false;
			statusMessage = `Padded to ${padWidth} × ${padHeight} pixels`;
		});
	}

	// Crop tool functions
	function getCanvasCoordinates(e: MouseEvent): { x: number; y: number } {
		const canvas = previewCanvas;
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		// Calculate coordinates and clamp to image bounds
		const x = Math.round((e.clientX - rect.left) * scaleX);
		const y = Math.round((e.clientY - rect.top) * scaleY);
		return {
			x: Math.max(0, Math.min(canvas.width, x)),
			y: Math.max(0, Math.min(canvas.height, y))
		};
	}

	function handleCropMouseDown(e: MouseEvent) {
		if (!cropMode || !imageLoaded) return;
		const coords = getCanvasCoordinates(e);
		cropStart = coords;
		cropEnd = coords;
		isDraggingCrop = true;
		// Add document-level listeners to track mouse outside the element
		document.addEventListener('mousemove', handleDocumentMouseMove);
		document.addEventListener('mouseup', handleDocumentMouseUp);
	}

	function handleCropMouseMove(e: MouseEvent) {
		if (!isDraggingCrop || !cropMode) return;
		cropEnd = getCanvasCoordinates(e);
	}

	function handleDocumentMouseMove(e: MouseEvent) {
		if (!isDraggingCrop || !cropMode) return;
		cropEnd = getCanvasCoordinates(e);
	}

	function handleDocumentMouseUp() {
		if (isDraggingCrop) {
			isDraggingCrop = false;
		}
		// Clean up document listeners
		document.removeEventListener('mousemove', handleDocumentMouseMove);
		document.removeEventListener('mouseup', handleDocumentMouseUp);
	}

	function clearCropSelection() {
		cropStart = null;
		cropEnd = null;
	}

	function applyCrop() {
		if (!imageState.processed || !cropStart || !cropEnd) return;

		// Normalize coordinates (handle selection in any direction)
		const x1 = Math.max(0, Math.min(cropStart.x, cropEnd.x));
		const y1 = Math.max(0, Math.min(cropStart.y, cropEnd.y));
		const x2 = Math.min(imageState.processed.width, Math.max(cropStart.x, cropEnd.x));
		const y2 = Math.min(imageState.processed.height, Math.max(cropStart.y, cropEnd.y));

		const newWidth = x2 - x1;
		const newHeight = y2 - y1;

		if (newWidth < 1 || newHeight < 1) {
			statusMessage = 'Selection too small';
			return;
		}

		isProcessing = true;
		statusMessage = 'Cropping...';

		requestAnimationFrame(() => {
			const src = imageState.processed!;
			const cropped = new ImageData(newWidth, newHeight);
			const srcData = src.data;
			const dstData = cropped.data;

			for (let y = 0; y < newHeight; y++) {
				for (let x = 0; x < newWidth; x++) {
					const srcIdx = ((y + y1) * src.width + (x + x1)) * 4;
					const dstIdx = (y * newWidth + x) * 4;
					dstData[dstIdx] = srcData[srcIdx];
					dstData[dstIdx + 1] = srcData[srcIdx + 1];
					dstData[dstIdx + 2] = srcData[srcIdx + 2];
					dstData[dstIdx + 3] = srcData[srcIdx + 3];
				}
			}

			applyImageData(cropped);
			pushToHistory(cropped);

			cropMode = false;
			clearCropSelection();
			isProcessing = false;
			statusMessage = `Cropped to ${newWidth} × ${newHeight} pixels`;
		});
	}

	// Everything - apply all tools in sequence
	function applyEverything() {
		if (!imageState.processed) return;

		isProcessing = true;
		statusMessage = 'Applying all tools...';

		requestAnimationFrame(() => {
			let currentData = cloneImageData(imageState.processed!);

			// 1. Remove background (using corners detection)
			statusMessage = 'Removing background...';
			const bgData = currentData.data;
			const corners = [
				0,
				(currentData.width - 1) * 4,
				(currentData.height - 1) * currentData.width * 4,
				((currentData.height - 1) * currentData.width + currentData.width - 1) * 4
			];
			let rSum = 0,
				gSum = 0,
				bSum = 0;
			for (const idx of corners) {
				rSum += bgData[idx];
				gSum += bgData[idx + 1];
				bSum += bgData[idx + 2];
			}
			const targetR = Math.round(rSum / 4);
			const targetG = Math.round(gSum / 4);
			const targetB = Math.round(bSum / 4);

			for (let i = 0; i < bgData.length; i += 4) {
				const diff = Math.sqrt(
					Math.pow(bgData[i] - targetR, 2) +
						Math.pow(bgData[i + 1] - targetG, 2) +
						Math.pow(bgData[i + 2] - targetB, 2)
				);
				if (diff <= bgTolerance) {
					bgData[i + 3] = 0;
				}
			}

			// 2. Auto trim
			statusMessage = 'Trimming...';
			const trimData = currentData.data;
			const trimWidth = currentData.width;
			const trimHeight = currentData.height;
			let minX = trimWidth,
				minY = trimHeight,
				maxX = 0,
				maxY = 0;

			for (let y = 0; y < trimHeight; y++) {
				for (let x = 0; x < trimWidth; x++) {
					const idx = (y * trimWidth + x) * 4;
					if (trimData[idx + 3] > 0) {
						minX = Math.min(minX, x);
						minY = Math.min(minY, y);
						maxX = Math.max(maxX, x);
						maxY = Math.max(maxY, y);
					}
				}
			}

			if (minX >= maxX || minY >= maxY) {
				isProcessing = false;
				statusMessage = 'No visible pixels found after background removal';
				return;
			}

			const newTrimWidth = maxX - minX + 1;
			const newTrimHeight = maxY - minY + 1;
			const trimmed = new ImageData(newTrimWidth, newTrimHeight);
			const trimmedData = trimmed.data;

			for (let y = 0; y < newTrimHeight; y++) {
				for (let x = 0; x < newTrimWidth; x++) {
					const srcIdx = ((y + minY) * trimWidth + (x + minX)) * 4;
					const dstIdx = (y * newTrimWidth + x) * 4;
					trimmedData[dstIdx] = trimData[srcIdx];
					trimmedData[dstIdx + 1] = trimData[srcIdx + 1];
					trimmedData[dstIdx + 2] = trimData[srcIdx + 2];
					trimmedData[dstIdx + 3] = trimData[srcIdx + 3];
				}
			}
			currentData = trimmed;

			// 3. Scale (physical mode)
			statusMessage = 'Scaling...';
			const scaleTargetHeight = Math.round(everythingHeightCm * pixelsPerCm);
			const scaleRatio = currentData.width / currentData.height;
			const scaleTargetWidth = Math.round(scaleTargetHeight * scaleRatio);

			const scaleTempCanvas = document.createElement('canvas');
			scaleTempCanvas.width = currentData.width;
			scaleTempCanvas.height = currentData.height;
			const scaleTempCtx = scaleTempCanvas.getContext('2d')!;
			scaleTempCtx.putImageData(currentData, 0, 0);

			const scaledCanvas = document.createElement('canvas');
			scaledCanvas.width = scaleTargetWidth;
			scaledCanvas.height = scaleTargetHeight;
			const scaledCtx = scaledCanvas.getContext('2d')!;
			scaledCtx.imageSmoothingEnabled = true;
			scaledCtx.imageSmoothingQuality = 'high';
			scaledCtx.drawImage(scaleTempCanvas, 0, 0, scaleTargetWidth, scaleTargetHeight);
			currentData = scaledCtx.getImageData(0, 0, scaleTargetWidth, scaleTargetHeight);

			// 4. Pad image
			statusMessage = 'Padding...';
			const padSrcWidth = currentData.width;
			const padSrcHeight = currentData.height;

			if (padSrcWidth > padWidth || padSrcHeight > padHeight) {
				isProcessing = false;
				statusMessage = `Scaled image (${padSrcWidth}×${padSrcHeight}) is larger than container (${padWidth}×${padHeight})`;
				return;
			}

			const padCanvas = document.createElement('canvas');
			padCanvas.width = padWidth;
			padCanvas.height = padHeight;
			const padCtx = padCanvas.getContext('2d')!;
			padCtx.clearRect(0, 0, padWidth, padHeight);

			const padSrcCanvas = document.createElement('canvas');
			padSrcCanvas.width = padSrcWidth;
			padSrcCanvas.height = padSrcHeight;
			const padSrcCtx = padSrcCanvas.getContext('2d')!;
			padSrcCtx.putImageData(currentData, 0, 0);

			const padX = Math.round((padWidth - padSrcWidth) / 2);
			const padY = padHeight - padSrcHeight;
			padCtx.drawImage(padSrcCanvas, padX, padY);

			const finalData = padCtx.getImageData(0, 0, padWidth, padHeight);

			// Apply final result
			applyImageData(finalData);
			pushToHistory(finalData);

			// Save the image
			statusMessage = 'Saving...';
			const saveCanvas = document.createElement('canvas');
			saveCanvas.width = finalData.width;
			saveCanvas.height = finalData.height;
			const saveCtx = saveCanvas.getContext('2d')!;
			saveCtx.putImageData(finalData, 0, 0);

			const link = document.createElement('a');
			link.download = `${originalFilename || 'image'}.png`;
			link.href = saveCanvas.toDataURL('image/png');
			link.click();

			isProcessing = false;
			statusMessage = `Done! Saved ${padWidth}×${padHeight} image`;
		});
	}

	// Save
	function saveImage() {
		if (!imageState.processed) return;

		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = imageState.processed.width;
		tempCanvas.height = imageState.processed.height;
		const ctx = tempCanvas.getContext('2d')!;
		ctx.putImageData(imageState.processed, 0, 0);

		const link = document.createElement('a');
		link.download = `${originalFilename || 'image'}.png`;
		link.href = tempCanvas.toDataURL('image/png');
		link.click();
		statusMessage = 'Image saved';
	}
</script>

<div class="min-h-screen bg-gray-900 p-4 text-gray-100 md:p-8">
	<div class="mx-auto max-w-6xl">
		<header class="mb-8">
			<h1 class="mb-2 text-3xl font-bold text-white">Imager</h1>
			{#if imageLoaded && originalFilename}
				<p class="font-mono text-gray-300">{originalFilename}.png</p>
			{:else}
				<p class="text-gray-400">
					Image manipulation tool for background removal, trimming, and scaling
				</p>
			{/if}
		</header>

		<!-- Main Editor -->
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={handleFileSelect}
		/>
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Tools Panel -->
			<div class="order-2 space-y-4 lg:order-1 lg:col-span-1">
				<!-- Status -->
				{#if statusMessage}
					<div class="rounded-lg bg-gray-800 p-3 text-sm text-gray-300">
						{statusMessage}
					</div>
				{/if}

				<!-- Actions -->
				<div class="rounded-lg bg-gray-800 p-4">
					<h3 class="mb-3 text-sm font-medium text-gray-400">Actions</h3>
					<div class="flex flex-wrap gap-2">
						<button
							class="rounded bg-gray-700 px-3 py-1.5 text-sm transition-colors hover:bg-gray-600 disabled:opacity-50"
							onclick={() => fileInput.click()}
						>
							Load Image
						</button>
						<button
							class="rounded bg-gray-700 px-3 py-1.5 text-sm transition-colors hover:bg-gray-600 disabled:opacity-50"
							onclick={undo}
							disabled={!imageLoaded || historyIndex <= 0 || isProcessing}
						>
							Undo
						</button>
						<button
							class="rounded bg-gray-700 px-3 py-1.5 text-sm transition-colors hover:bg-gray-600 disabled:opacity-50"
							onclick={redo}
							disabled={!imageLoaded || historyIndex >= history.length - 1 || isProcessing}
						>
							Redo
						</button>
						<button
							class="rounded bg-gray-700 px-3 py-1.5 text-sm transition-colors hover:bg-gray-600 disabled:opacity-50"
							onclick={resetToOriginal}
							disabled={!imageLoaded || isProcessing}
						>
							Reset
						</button>
						<button
							class="rounded bg-blue-600 px-3 py-1.5 text-sm transition-colors hover:bg-blue-500 disabled:opacity-50"
							onclick={saveImage}
							disabled={!imageLoaded || isProcessing}
						>
							Save PNG
						</button>
					</div>
				</div>

				<div class="rounded-lg bg-gray-800 p-4">
					<div class="flex gap-4 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
						<!-- Everything -->
						<div class="w-64 flex-shrink-0 lg:w-auto">
							<div class="space-y-3">
								<button
									class="w-full rounded bg-green-600 py-1 text-xs font-medium transition-colors hover:bg-green-500 disabled:opacity-50"
									onclick={applyEverything}
									disabled={!imageLoaded || isProcessing}
								>
									Apply Everything & Save
								</button>
								<div>
									<label for="everything-height" class="mb-1 block text-xs text-gray-400"
										>Height: {everythingHeightCm} cm ({everythingHeightCm * pixelsPerCm} px)</label
									>
									<input
										id="everything-height"
										type="number"
										min="1"
										step="0.5"
										class="w-full rounded bg-gray-700 px-1 py-1 text-xs"
										bind:value={everythingHeightCm}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Tools -->
				<div class="rounded-lg bg-gray-800 p-4">
					<h3 class="mb-3 text-sm font-medium text-gray-400">Tools</h3>
					<div
						class="flex gap-4 overflow-x-auto pb-2 lg:flex-col lg:gap-2 lg:overflow-x-visible lg:pb-0"
					>
						<!-- Crop -->
						<div class="w-32 flex-shrink-0 lg:w-auto">
							<div class="space-y-3">
								{#if cropMode}
									<div class="flex gap-2">
										<button
											class="flex-1 rounded bg-blue-600 py-1.5 text-sm font-medium transition-colors hover:bg-blue-500 disabled:opacity-50"
											onclick={applyCrop}
											disabled={!cropStart || !cropEnd || isProcessing}
										>
											Apply Crop
										</button>
										<button
											class="flex-1 rounded bg-gray-600 py-1.5 text-sm font-medium transition-colors hover:bg-gray-500"
											onclick={() => {
												cropMode = false;
												clearCropSelection();
											}}
										>
											Cancel
										</button>
									</div>
									{#if cropStart && cropEnd}
										<p class="text-xs text-gray-400">
											Selection: {Math.abs(cropEnd.x - cropStart.x)} × {Math.abs(
												cropEnd.y - cropStart.y
											)} px
										</p>
									{/if}
								{:else}
									<button
										class="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
										onclick={() => {
											cropMode = true;
											clearCropSelection();
										}}
										disabled={!imageLoaded || isProcessing}
									>
										Crop
									</button>
								{/if}
							</div>
						</div>

						<!-- Remove Background -->
						<div class="w-32 flex-shrink-0 lg:w-auto">
							<div class="flex flex-col space-y-3 lg:flex-col-reverse">
								<button
									class="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
									onclick={removeBackground}
									disabled={!imageLoaded || isProcessing}
								>
									Remove BG
								</button>
								<div>
									<label for="bg-removal-mode" class="mb-1 block text-xs text-gray-400"
										>BG Color Select</label
									>
									<select
										id="bg-removal-mode"
										class="w-full rounded bg-gray-700 px-2 py-1 text-xs"
										bind:value={bgRemovalMode}
									>
										<option value="contiguous">Contiguous (flood fill)</option>
										<option value="corners">All matching pixels</option>
										<option value="color">Specific color</option>
									</select>
								</div>
								{#if bgRemovalMode === 'color'}
									<div class="flex gap-2">
										<input
											id="bg-color"
											type="color"
											class="h-8 w-10 cursor-pointer rounded"
											bind:value={bgColor}
										/>
										<input
											type="text"
											class="flex-1 rounded bg-gray-700 px-2 py-1 font-mono text-sm"
											bind:value={bgColor}
										/>
									</div>
								{/if}
								<div>
									<label for="bg-tolerance" class="mb-1 block text-xs text-gray-400"
										>Tolerance: {bgTolerance}</label
									>
									<input
										id="bg-tolerance"
										type="range"
										min="0"
										max="100"
										class="w-full"
										bind:value={bgTolerance}
									/>
								</div>
							</div>
						</div>

						<!-- Auto Trim -->
						<div class="w-32 flex-shrink-0 lg:w-auto">
							<button
								class="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
								onclick={autoTrim}
								disabled={!imageLoaded || isProcessing}
							>
								Trim Image
							</button>
						</div>

						<!-- Scale -->
						<div class="w-32 flex-shrink-0 lg:w-auto">
							<div class="flex flex-col lg:flex-col-reverse">
								<button
									class="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
									onclick={applyScale}
									disabled={!imageLoaded || isProcessing}
								>
									Apply Scale
								</button>
								<div class="controls py-3">
									<div>
										<label for="scale-mode" class="mb-1 block text-xs text-gray-400">Mode</label>
										<select
											id="scale-mode"
											class="w-full rounded bg-gray-700 px-2 py-1 text-xs"
											bind:value={scaleMode}
										>
											<option value="percentage">Percentage</option>
											<option value="dimensions">Dimensions (px)</option>
											<option value="physical">Physical (cm)</option>
										</select>
									</div>
									{#if scaleMode === 'percentage'}
										<div>
											<label for="scale-percentage" class="mb-1 block text-xs text-gray-400"
												>Scale: {scalePercentage}%</label
											>
											<input
												id="scale-percentage"
												type="range"
												min="1"
												max="400"
												class="w-full"
												bind:value={scalePercentage}
											/>
											<div class="mt-2 flex flex-wrap gap-1">
												{#each [25, 50, 75, 100, 150, 200] as preset}
													<button
														class="rounded bg-gray-700 px-2 py-0.5 text-xs hover:bg-gray-600"
														onclick={() => (scalePercentage = preset)}
													>
														{preset}%
													</button>
												{/each}
											</div>
										</div>
									{:else if scaleMode === 'physical'}
										<div>
											<p class="mb-2 text-xs text-gray-400">1 cm = {pixelsPerCm} px</p>
											<label for="physical-height" class="mb-1 block text-xs text-gray-400"
												>Height: {physicalHeightCm} cm ({physicalHeightCm * pixelsPerCm} px)</label
											>
											<input
												id="physical-height"
												type="number"
												min="1"
												step="0.5"
												class="w-full rounded bg-gray-700 px-1 py-1 text-xs"
												bind:value={physicalHeightCm}
											/>
										</div>
									{:else}
										<div>
											<label class="mb-2 flex items-center gap-2 text-xs text-gray-400">
												<input type="checkbox" bind:checked={maintainAspectRatio} />
												Maintain aspect ratio
											</label>
											<div class="grid grid-cols-2 gap-2">
												<div>
													<label for="target-width" class="mb-1 block text-xs text-gray-400"
														>Width</label
													>
													<input
														id="target-width"
														type="number"
														min="1"
														class="w-full rounded bg-gray-700 px-1 py-1 text-xs"
														value={targetWidth}
														oninput={(e) =>
															updateTargetWidth(
																parseInt((e.target as HTMLInputElement).value) || 1
															)}
													/>
												</div>
												<div>
													<label for="target-height" class="mb-1 block text-xs text-gray-400"
														>Height</label
													>
													<input
														id="target-height"
														type="number"
														min="1"
														class="w-full rounded bg-gray-700 px-1 py-1 text-xs"
														value={targetHeight}
														oninput={(e) =>
															updateTargetHeight(
																parseInt((e.target as HTMLInputElement).value) || 1
															)}
													/>
												</div>
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Pad Image -->
						<div class="w-32 flex-shrink-0 lg:w-auto">
							<div class="flex flex-col lg:flex-col-reverse">
								<button
									class="w-full rounded bg-blue-600 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
									onclick={padImage}
									disabled={!imageLoaded || isProcessing}
								>
									Pad Image
								</button>
								<div class="py-3">
									<div class="grid grid-cols-2 gap-2">
										<div>
											<label for="pad-width" class="mb-1 block text-xs text-gray-400">Width</label>
											<input
												id="pad-width"
												type="number"
												min="1"
												class="w-full rounded bg-gray-700 px-1 py-1 text-xs"
												bind:value={padWidth}
											/>
										</div>
										<div>
											<label for="pad-height" class="mb-1 block text-xs text-gray-400">Height</label
											>
											<input
												id="pad-height"
												type="number"
												min="1"
												class="w-full rounded bg-gray-700 px-1 py-1 text-xs"
												bind:value={padHeight}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Image Info -->
				<div class="rounded-lg bg-gray-800 p-4">
					<h3 class="mb-2 text-sm font-medium text-gray-400">Current Dimensions</h3>
					<p class="font-mono text-lg">{imageState.width} × {imageState.height}</p>
				</div>
			</div>

			<!-- Preview Area -->
			<div class="order-1 lg:order-2 lg:col-span-2">
				<div
					class="rounded-lg bg-gray-800 p-4 transition-colors {isDragging
						? 'ring-2 ring-blue-500'
						: ''}"
					role="region"
					aria-label="Image drop zone"
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
				>
					<h3 class="mb-3 text-sm font-medium text-gray-400">Preview</h3>
					<div
						class="relative rounded bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzMzIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiLz48cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] {imageLoaded
							? ''
							: 'flex min-h-[300px] items-center justify-center'}"
						role="button"
						tabindex="0"
						onclick={() => !imageLoaded && fileInput.click()}
						onkeydown={(e) => e.key === 'Enter' && !imageLoaded && fileInput.click()}
					>
						{#if imageLoaded}
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<div
								class="relative inline-block {cropMode ? 'cursor-crosshair' : ''}"
								onmousedown={handleCropMouseDown}
								onmousemove={handleCropMouseMove}
								role="application"
								aria-label="Image preview with crop selection"
							>
								<canvas bind:this={previewCanvas} class="block h-auto max-w-full"></canvas>
								{#if cropMode && cropStart && cropEnd && previewCanvas}
									{@const rect = previewCanvas.getBoundingClientRect()}
									{@const scaleX = rect.width / previewCanvas.width}
									{@const scaleY = rect.height / previewCanvas.height}
									{@const left = Math.min(cropStart.x, cropEnd.x) * scaleX}
									{@const top = Math.min(cropStart.y, cropEnd.y) * scaleY}
									{@const width = Math.abs(cropEnd.x - cropStart.x) * scaleX}
									{@const height = Math.abs(cropEnd.y - cropStart.y) * scaleY}
									<div
										class="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/20"
										style="left: {left}px; top: {top}px; width: {width}px; height: {height}px;"
									></div>
								{/if}
							</div>
						{:else}
							<div class="p-8 text-center text-gray-500">
								<svg
									class="mx-auto mb-4 h-16 w-16"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								<p class="mb-2 text-lg">Drop an image here</p>
								<p class="text-sm">or click to select</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Hidden source canvas -->
		<canvas bind:this={sourceCanvas} class="hidden"></canvas>
	</div>
</div>
