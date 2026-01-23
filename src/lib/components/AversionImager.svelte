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
  let bgRemovalMode = $state<'color' | 'corners'>('corners');
  let bgColor = $state('#ffffff');
  let bgTolerance = $state(30);

  // Scale settings
  let scaleMode = $state<'percentage' | 'dimensions' | 'physical'>('percentage');
  let scalePercentage = $state(100);
  let targetWidth = $state(0);
  let targetHeight = $state(0);
  let maintainAspectRatio = $state(true);
  let physicalHeightCm = $state(10);
  const pixelsPerCm = 8;

  // Pad settings
  let padWidth = $state(400);
  let padHeight = $state(1600);

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
        statusMessage = `Loaded: ${img.width} × ${img.height} pixels`;

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
    return new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
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
          (src.width - 1) * 4, // top-right
          (src.height - 1) * src.width * 4, // bottom-left
          ((src.height - 1) * src.width + src.width - 1) * 4 // bottom-right
        ];

        let rSum = 0, gSum = 0, bSum = 0;
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

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const diff = Math.sqrt(
          Math.pow(r - targetR, 2) +
          Math.pow(g - targetG, 2) +
          Math.pow(b - targetB, 2)
        );

        if (diff <= tolerance) {
          data[i + 3] = 0; // Set alpha to 0
          removed++;
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
      newWidth = Math.round(imageState.processed.width * scalePercentage / 100);
      newHeight = Math.round(imageState.processed.height * scalePercentage / 100);
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

<div class="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
  <div class="max-w-6xl mx-auto">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Imager</h1>
      <p class="text-gray-400">Image manipulation tool for background removal, trimming, and scaling</p>
    </header>

    {#if !imageLoaded}
      <!-- Upload Area -->
      <div
        class="border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer {isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}"
        role="button"
        tabindex="0"
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        onclick={() => fileInput.click()}
        onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
      >
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-lg text-gray-300 mb-2">Drop an image here or click to select</p>
        <p class="text-sm text-gray-500">Supports PNG, JPG, GIF, WebP</p>
      </div>
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        class="hidden"
        onchange={handleFileSelect}
      />
    {:else}
      <!-- Main Editor -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Tools Panel -->
        <div class="lg:col-span-1 space-y-4">
          <!-- Status -->
          {#if statusMessage}
            <div class="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
              {statusMessage}
            </div>
          {/if}

          <!-- Actions -->
          <div class="bg-gray-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-400 mb-3">Actions</h3>
            <div class="flex flex-wrap gap-2">
              <button
                class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
                onclick={undo}
                disabled={historyIndex <= 0 || isProcessing}
              >
                Undo
              </button>
              <button
                class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
                onclick={redo}
                disabled={historyIndex >= history.length - 1 || isProcessing}
              >
                Redo
              </button>
              <button
                class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
                onclick={resetToOriginal}
                disabled={isProcessing}
              >
                Reset
              </button>
              <button
                class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                onclick={saveImage}
                disabled={isProcessing}
              >
                Save PNG
              </button>
              <button
                class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                onclick={() => { imageLoaded = false; statusMessage = ''; }}
              >
                New Image
              </button>
            </div>
          </div>

          <!-- Tools -->
          <div class="bg-gray-800 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-medium text-gray-400">Tools</h3>

            <!-- Remove Background -->
            <div class="border-t border-gray-700 pt-4">
              <h4 class="font-medium mb-3">Remove Background</h4>
              <div class="space-y-3">
                <div>
                  <label for="bg-removal-mode" class="block text-xs text-gray-400 mb-1">Detection Mode</label>
                  <select
                    id="bg-removal-mode"
                    class="w-full bg-gray-700 rounded px-3 py-1.5 text-sm"
                    bind:value={bgRemovalMode}
                  >
                    <option value="corners">Auto-detect from corners</option>
                    <option value="color">Specific color</option>
                  </select>
                </div>
                {#if bgRemovalMode === 'color'}
                  <div class="flex gap-2">
                    <input
                      id="bg-color"
                      type="color"
                      class="w-10 h-8 rounded cursor-pointer"
                      bind:value={bgColor}
                    />
                    <input
                      type="text"
                      class="flex-1 bg-gray-700 rounded px-2 py-1 text-sm font-mono"
                      bind:value={bgColor}
                    />
                  </div>
                {/if}
                <div>
                  <label for="bg-tolerance" class="block text-xs text-gray-400 mb-1">Tolerance: {bgTolerance}</label>
                  <input
                    id="bg-tolerance"
                    type="range"
                    min="0"
                    max="100"
                    class="w-full"
                    bind:value={bgTolerance}
                  />
                </div>
                <button
                  class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  onclick={removeBackground}
                  disabled={isProcessing}
                >
                  Remove Background
                </button>
              </div>
            </div>

            <!-- Auto Trim -->
            <div class="border-t border-gray-700 pt-4">
              <h4 class="font-medium mb-3">Auto Trim</h4>
              <p class="text-xs text-gray-400 mb-3">Crop to non-transparent pixels only.</p>
              <button
                class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors disabled:opacity-50"
                onclick={autoTrim}
                disabled={isProcessing}
              >
                Trim Image
              </button>
            </div>

            <!-- Scale -->
            <div class="border-t border-gray-700 pt-4">
              <h4 class="font-medium mb-3">Scale</h4>
              <div class="space-y-3">
                <div>
                  <label for="scale-mode" class="block text-xs text-gray-400 mb-1">Mode</label>
                  <select
                    id="scale-mode"
                    class="w-full bg-gray-700 rounded px-3 py-1.5 text-sm"
                    bind:value={scaleMode}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="dimensions">Dimensions (px)</option>
                    <option value="physical">Physical (cm)</option>
                  </select>
                </div>
                {#if scaleMode === 'percentage'}
                  <div>
                    <label for="scale-percentage" class="block text-xs text-gray-400 mb-1">Scale: {scalePercentage}%</label>
                    <input
                      id="scale-percentage"
                      type="range"
                      min="1"
                      max="400"
                      class="w-full"
                      bind:value={scalePercentage}
                    />
                    <div class="flex flex-wrap gap-1 mt-2">
                      {#each [25, 50, 75, 100, 150, 200] as preset}
                        <button
                          class="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                          onclick={() => scalePercentage = preset}
                        >
                          {preset}%
                        </button>
                      {/each}
                    </div>
                  </div>
                {:else if scaleMode === 'physical'}
                  <div>
                    <p class="text-xs text-gray-400 mb-2">1 cm = {pixelsPerCm} px</p>
                    <label for="physical-height" class="block text-xs text-gray-400 mb-1">Height: {physicalHeightCm} cm ({physicalHeightCm * pixelsPerCm} px)</label>
                    <input
                      id="physical-height"
                      type="number"
                      min="1"
                      step="0.5"
                      class="w-full bg-gray-700 rounded px-3 py-1.5 text-sm"
                      bind:value={physicalHeightCm}
                    />
                    <div class="flex flex-wrap gap-1 mt-2">
                      {#each [5, 10, 15, 20, 25, 30] as preset}
                        <button
                          class="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                          onclick={() => physicalHeightCm = preset}
                        >
                          {preset}cm
                        </button>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div>
                    <label class="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      <input type="checkbox" bind:checked={maintainAspectRatio} />
                      Maintain aspect ratio
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label for="target-width" class="block text-xs text-gray-400 mb-1">Width</label>
                        <input
                          id="target-width"
                          type="number"
                          min="1"
                          class="w-full bg-gray-700 rounded px-2 py-1.5 text-sm"
                          value={targetWidth}
                          oninput={(e) => updateTargetWidth(parseInt((e.target as HTMLInputElement).value) || 1)}
                        />
                      </div>
                      <div>
                        <label for="target-height" class="block text-xs text-gray-400 mb-1">Height</label>
                        <input
                          id="target-height"
                          type="number"
                          min="1"
                          class="w-full bg-gray-700 rounded px-2 py-1.5 text-sm"
                          value={targetHeight}
                          oninput={(e) => updateTargetHeight(parseInt((e.target as HTMLInputElement).value) || 1)}
                        />
                      </div>
                    </div>
                  </div>
                {/if}
                <button
                  class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  onclick={applyScale}
                  disabled={isProcessing}
                >
                  Apply Scale
                </button>
              </div>
            </div>

            <!-- Pad Image -->
            <div class="border-t border-gray-700 pt-4">
              <h4 class="font-medium mb-3">Pad Image</h4>
              <div class="space-y-3">
                <p class="text-xs text-gray-400">Center horizontally, align to bottom.</p>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="pad-width" class="block text-xs text-gray-400 mb-1">Width</label>
                    <input
                      id="pad-width"
                      type="number"
                      min="1"
                      class="w-full bg-gray-700 rounded px-2 py-1.5 text-sm"
                      bind:value={padWidth}
                    />
                  </div>
                  <div>
                    <label for="pad-height" class="block text-xs text-gray-400 mb-1">Height</label>
                    <input
                      id="pad-height"
                      type="number"
                      min="1"
                      class="w-full bg-gray-700 rounded px-2 py-1.5 text-sm"
                      bind:value={padHeight}
                    />
                  </div>
                </div>
                <button
                  class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  onclick={padImage}
                  disabled={isProcessing}
                >
                  Pad Image
                </button>
              </div>
            </div>
          </div>

          <!-- Image Info -->
          <div class="bg-gray-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-400 mb-2">Current Dimensions</h3>
            <p class="text-lg font-mono">{imageState.width} × {imageState.height}</p>
          </div>
        </div>

        <!-- Preview Area -->
        <div class="lg:col-span-2">
          <div class="bg-gray-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-400 mb-3">Preview</h3>
            <div class="relative overflow-auto max-h-[70vh] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzMzIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiLz48cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] rounded">
              <canvas
                bind:this={previewCanvas}
                class="max-w-full h-auto"
              ></canvas>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Hidden source canvas -->
    <canvas bind:this={sourceCanvas} class="hidden"></canvas>
  </div>
</div>
