<script lang="ts">
	import { tick, onMount } from 'svelte';
	import type * as PDFJSType from 'pdfjs-dist';

	let pdfjsLib: typeof PDFJSType | null = null;

	onMount(async () => {
		pdfjsLib = await import('pdfjs-dist');
		// Setup PDF.js worker
		if (typeof window !== 'undefined' && 'Worker' in window) {
			pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
		}
	});

	interface ProcessedItem {
		id: string;
		imageData: string;
		name: string;
		status: 'pending_sam' | 'cropping' | 'pending_gemini' | 'complete' | 'error';
		error?: string;
		maskUrl?: string;
	}

	interface PageState {
		pageNumber: number;
		canvas: HTMLCanvasElement | null;
		base64: string;
		items: ProcessedItem[];
		status: 'rendering' | 'pending_sam' | 'processing_items' | 'complete' | 'error';
	}

	let isDragging = $state(false);
	let isFastMode = $state(false);
	let statusMessage = $state('Drop a PDF catalog here');
	let pages = $state<PageState[]>([]);
	let originalFilename = $state('');

	// References
	let fileInput: HTMLInputElement;

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
			loadPdf(files[0]);
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			loadPdf(target.files[0]);
		}
	}

	async function loadPdf(file: File) {
		if (file.type !== 'application/pdf') {
			statusMessage = 'Please select a PDF file';
			return;
		}

		originalFilename = file.name.replace(/\.[^/.]+$/, '');
		statusMessage = 'Loading PDF...';
		pages = [];

		try {
			if (!pdfjsLib) {
				statusMessage = 'PDF library not loaded yet.';
				return;
			}
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await pdfjsLib.getDocument({
				data: arrayBuffer,
				cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
				cMapPacked: true
			}).promise;

			statusMessage = `Processing ${pdf.numPages} pages...`;

			for (let i = 1; i <= pdf.numPages; i++) {
				pages.push({
					pageNumber: i,
					canvas: null,
					base64: '',
					items: [],
					status: 'rendering'
				});
			}

			// Render pages sequentially to avoid overwhelming memory
			for (let i = 1; i <= pdf.numPages; i++) {
				const page = await pdf.getPage(i);
				const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d')!;
				canvas.width = viewport.width;
				canvas.height = viewport.height;

				await page.render({ canvasContext: ctx, viewport } as any).promise;

				const base64 = canvas.toDataURL('image/jpeg', 0.9);

				const pageIndex = i - 1;
				pages[pageIndex].canvas = canvas;
				pages[pageIndex].base64 = base64;
				pages[pageIndex].status = 'pending_sam';

				if (isFastMode) {
					processPageWithSam(pageIndex);
				}
			}

			statusMessage = isFastMode ? 'Processing models...' : 'PDF loaded. Ready to process pages.';
		} catch (error) {
			console.error('Error loading PDF:', error);
			statusMessage = 'Error loading PDF';
		}
	}

	async function processPageWithSam(pageIndex: number) {
		const page = pages[pageIndex];
		if (!page || page.status !== 'pending_sam') return;

		page.status = 'processing_items';
		pages = [...pages]; // trigger reactivity

		try {
			const response = await fetch('/api/fal/sam', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					image_url: page.base64,
					prompt: 'snowboard'
				})
			});

			if (!response.ok) throw new Error('Failed to run SAM on page');

			const data = await response.json();
			const result = data.response;

			if (result && result.masks) {
				const newItems: ProcessedItem[] = [];
				for (let i = 0; i < result.masks.length; i++) {
					const mask = result.masks[i];
					if (mask && mask.url) {
						newItems.push({
							id: `p${page.pageNumber}_i${i}`,
							imageData: mask.url,
							name: '...',
							status: 'pending_gemini'
							// maskUrl: mask.url // Redundant now
						});
					}
				}
				page.items = newItems;
				page.status = 'complete';
				pages = [...pages];

				if (isFastMode) {
					for (let i = 0; i < newItems.length; i++) {
						processItemWithGemini(pageIndex, i);
					}
				}
			} else {
				page.status = 'complete';
			}
		} catch (error) {
			console.error('Error processing page', pageIndex, error);
			page.status = 'error';
		}
		pages = [...pages];
	}

	async function processItemWithGemini(pageIndex: number, itemIndex: number) {
		const page = pages[pageIndex];
		const item = page.items[itemIndex];
		if (!item || item.status !== 'pending_gemini') return;

		try {
			const prompt = `This is a cropped image of a snowboard from a catalog. Please act as a data extractor. Look at any text on or near the board. Identify the specific name or model of this snowboard. Only output the name/model, nothing else. If you cannot find a name, output "Unknown Model".`;

			const response = await fetch('/api/gemini/vision', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					images: [item.imageData, page.base64],
					prompt
				})
			});

			if (!response.ok) throw new Error('Failed to run Gemini on item');

			const data = await response.json();
			item.name = data.response.trim();
			item.status = 'complete';
		} catch (error) {
			console.error('Error processing item', item.id, error);
			item.name = 'Error';
			item.status = 'error';
		}
		pages = [...pages];
	}

	function downloadItem(item: ProcessedItem) {
		window.open(item.imageData, '_blank');
	}

	let allItems = $derived(pages.flatMap((p) => p.items));
</script>

<div class="flex h-full flex-col bg-zinc-950 text-white">
	<div class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
		<h1 class="text-xl leading-none font-bold text-green-400">AversionCataloger</h1>
		<div class="flex items-center gap-4 text-sm text-zinc-400">
			<label class="flex cursor-pointer items-center gap-2">
				<input type="checkbox" bind:checked={isFastMode} class="accent-green-500" />
				Fast Mode (Auto-Process)
			</label>
			<span>{statusMessage}</span>
		</div>
	</div>

	<!-- Main workspace -->
	<div class="flex flex-1 gap-6 overflow-auto p-6">
		<!-- Left: Controls & PDF Drop -->
		<div class="flex w-1/3 flex-col gap-6">
			<input
				type="file"
				accept="application/pdf"
				class="hidden"
				bind:this={fileInput}
				onchange={handleFileSelect}
			/>

			<button
				class="flex items-center justify-center rounded-xl border-2 border-dashed transition-colors {isDragging
					? 'border-green-500 bg-green-500/10'
					: 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500'} {pages.length
					? 'h-32'
					: 'h-64'}"
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				onclick={() => fileInput.click()}
			>
				<div class="pointer-events-none text-center">
					<p class="font-medium text-zinc-300">Drop catalog PDF here</p>
					<p class="mt-1 text-sm text-zinc-500">or click to upload</p>
				</div>
			</button>

			{#if pages.length > 0}
				<div class="flex flex-col gap-4 rounded-xl bg-zinc-900 p-4">
					<h2 class="font-bold text-zinc-300">Pages ({pages.length})</h2>
					<div class="flex flex-col gap-2 pr-2">
						{#each pages as page, i}
							<div
								class="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
							>
								<!-- Large image preview -->
								<div class="h-content relative w-full border-b border-zinc-800 bg-zinc-900">
									{#if page.base64}
										<img
											src={page.base64}
											alt="Page {page.pageNumber}"
											class="aspect-4/3 w-96 object-contain"
										/>
									{:else}
										<div class="flex aspect-[4/3] w-96 items-center justify-center">
											<span class="text-xs text-zinc-600">Rendering...</span>
										</div>
									{/if}
								</div>

								<!-- Action bar below the image -->
								<div class="flex items-center justify-between p-2">
									<span class="text-sm font-medium">Page {page.pageNumber}</span>
									<div class="flex items-center">
										{#if page.status === 'pending_sam'}
											<button
												class="rounded bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400 hover:bg-green-500/30"
												onclick={() => processPageWithSam(i)}
											>
												Process SAM
											</button>
										{:else if page.status === 'processing_items'}
											<span class="text-xs text-yellow-500">Processing...</span>
										{:else if page.status === 'complete'}
											<span class="text-xs text-green-500">Done ({page.items.length})</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Right: Extracted Images -->
		<div class="flex flex-1 flex-col gap-4">
			{#if allItems.length > 0}
				<div class="min-h-[500px] flex-1 rounded-xl bg-zinc-900 p-6">
					<h2 class="mb-4 flex items-center justify-between font-bold text-zinc-300">
						Extracted Snowboards ({allItems.length})
					</h2>
					<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
						{#each pages as page, pi}
							{#each page.items as item, ii}
								<div class="flex flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-3">
									<!-- Removed SAM Mask section -->

									<div
										class="mb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-zinc-500 uppercase"
									>
										<span>Extracted Item</span>
										<span>Pg {page.pageNumber}</span>
									</div>
									<div
										class="mb-3 flex h-48 items-center justify-center overflow-hidden rounded bg-zinc-900"
									>
										{#if item.imageData}
											<img
												src={item.imageData}
												alt="Extracted object"
												class="max-h-full max-w-full object-contain"
											/>
										{/if}
									</div>

									<div class="mt-auto flex flex-col gap-2 border-t border-zinc-800/50 pt-2">
										<p class="truncate text-sm font-bold" title={item.name}>{item.name}</p>
										<div class="mt-1 flex w-full gap-2">
											{#if item.status === 'pending_gemini'}
												<button
													class="flex-1 cursor-pointer rounded bg-purple-500 px-2 py-1.5 text-xs font-bold text-white shadow transition-colors hover:bg-purple-600"
													onclick={() => processItemWithGemini(pi, ii)}
												>
													Ask Gemini
												</button>
											{/if}
											<button
												class="flex-1 cursor-pointer rounded bg-zinc-800 px-2 py-1.5 text-xs font-bold text-zinc-300 shadow transition-colors hover:bg-zinc-700 hover:text-white"
												onclick={() => downloadItem(item)}
											>
												Download
											</button>
										</div>
									</div>
								</div>
							{/each}
						{/each}
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center rounded-xl bg-zinc-900 p-6">
					<p class="text-center text-zinc-500">
						<span class="mb-2 block text-2xl">🏂</span>
						Extracted snowboards will appear here
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
