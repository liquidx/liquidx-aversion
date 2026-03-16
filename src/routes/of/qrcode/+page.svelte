<script lang="ts">
	import { encode } from 'uqr';
	import { Download, Link as LinkIcon, Type, Contact, Square, Circle, Box, Code, Sparkles, Loader } from '@lucide/svelte';

	const inputClass =
		'border border-neutral-300 dark:border-neutral-700 bg-transparent rounded-md px-3 py-2 w-full outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm';

	let textMode = $state<'url' | 'text' | 'vcard'>('url');

	let urlInput = $state('https://liquidx.net/');
	let textInput = $state('Hello, World!');
	let vcard = $state({
		firstName: 'John',
		lastName: 'Doe',
		org: 'Acme Corp',
		title: 'Engineer',
		tel: '+1234567890',
		email: 'john@example.com',
		url: 'https://example.com'
	});

	let dotStyle = $state<'square' | 'circle' | 'rounded' | 'code' | 'custom'>('square');
	let dotSize = $state(1.0);
	let dotRadius = $state(0.3);
	let isHollow = $state(false);

	const defaultCustomCode = `// Simple circles — one per filled pixel
if (!cell) return '';
const r = dotSize * 0.5;
return \`<circle cx="\${x + 0.5}" cy="\${y + 0.5}" r="\${r}" fill="\${foreground}" />\`;`;

	const examples: { name: string; code: string }[] = [
		{
			name: 'Circle',
			code: defaultCustomCode
		},
		{
			name: 'Ripple',
			code: `// Ripple: dot radius pulses with distance from centre
if (!cell) return '';
const dx = x - size / 2, dy = y - size / 2;
const dist = Math.sqrt(dx * dx + dy * dy);
const r = dotSize * 0.5 * (0.4 + 0.6 * Math.abs(Math.sin(dist * 0.55)));
return \`<circle cx="\${x + 0.5}" cy="\${y + 0.5}" r="\${r}" fill="\${foreground}" />\`;`
		},
		{
			name: 'Rainbow',
			code: `// Diagonal colour spectrum — hue sweeps across the grid
if (!cell) return '';
const hue = ((x + y) / (size * 2)) * 300 + 30;
return \`<circle cx="\${x + 0.5}" cy="\${y + 0.5}" r="\${dotSize * 0.5}" fill="hsl(\${hue.toFixed(0)}, 85%, 50%)" />\`;`
		},
		{
			name: 'Spiral',
			code: `// Tangential bars — each dot points perpendicular to the radius,
// creating a pinwheel / spinning look
if (!cell) return '';
const cx = x + 0.5, cy = y + 0.5;
const dx = x - size / 2 + 0.5, dy = y - size / 2 + 0.5;
const angle = Math.atan2(dy, dx) * 180 / Math.PI;
const w = dotSize * 0.28, h = dotSize * 0.85;
return \`<rect x="\${(cx - w / 2).toFixed(3)}" y="\${(cy - h / 2).toFixed(3)}" width="\${w.toFixed(3)}" height="\${h.toFixed(3)}" fill="\${foreground}" transform="rotate(\${(angle + 90).toFixed(1)},\${cx},\${cy})" />\`;`
		},
		{
			name: 'Crosses',
			code: `// Plus-sign shaped dots
if (!cell) return '';
const cx = x + 0.5, cy = y + 0.5;
const arm = dotSize * 0.85, bar = dotSize * 0.28;
return \`<rect x="\${cx - bar / 2}" y="\${cy - arm / 2}" width="\${bar}" height="\${arm}" fill="\${foreground}" />\`
     + \`<rect x="\${cx - arm / 2}" y="\${cy - bar / 2}" width="\${arm}" height="\${bar}" fill="\${foreground}" />\`;`
		},
		{
			name: 'Wave',
			code: `// Dots displaced by sinusoidal waves — organic, flowing look
if (!cell) return '';
const ox = Math.sin((y + x * 0.4) * 0.9) * 0.26;
const oy = Math.cos((x + y * 0.4) * 0.9) * 0.26;
return \`<circle cx="\${x + 0.5 + ox}" cy="\${y + 0.5 + oy}" r="\${dotSize * 0.42}" fill="\${foreground}" />\`;`
		},
		{
			name: 'Diamonds',
			code: `// 45° rotated squares — sharp diamond pixel grid
if (!cell) return '';
const cx = x + 0.5, cy = y + 0.5, s = dotSize * 0.72;
return \`<rect x="\${cx - s / 2}" y="\${cy - s / 2}" width="\${s}" height="\${s}" fill="\${foreground}" transform="rotate(45,\${cx},\${cy})" />\`;`
		},
		{
			name: 'Scatter',
			code: `// Stable pseudo-random scatter — dots jitter to organic positions
if (!cell) return '';
const h = (x * 2749 + y * 5381 + x * y * 127) % 997;
const ox = ((h % 29) / 29 - 0.5) * (1 - dotSize) * 0.9;
const oy = ((h % 31) / 31 - 0.5) * (1 - dotSize) * 0.9;
return \`<circle cx="\${x + 0.5 + ox}" cy="\${y + 0.5 + oy}" r="\${dotSize * 0.45}" fill="\${foreground}" />\`;`
		},
		{
			name: 'Rings',
			code: `// Concentric rings: filled dots in odd bands, outlines in even bands
const cx = x + 0.5, cy = y + 0.5;
const dx = x - size / 2, dy = y - size / 2;
const dist = Math.sqrt(dx * dx + dy * dy);
const band = Math.floor(dist / 3.5) % 2;
if (!cell) {
  if (!band) return '';
  return \`<circle cx="\${cx}" cy="\${cy}" r="\${dotSize * 0.38}" fill="none" stroke="\${outlineColor}" stroke-width="0.12" />\`;
}
const r = dotSize * 0.5 * (band ? 1.0 : 0.72);
return \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" fill="\${foreground}" />\`;`
		}
	];

	let customCode = $state(defaultCustomCode);

	// Compile the custom function whenever the code changes; error captured without side effects
	let customFnResult = $derived.by(() => {
		if (dotStyle !== 'code' && dotStyle !== 'custom') return { fn: null, error: '' };
		try {
			const fn = new Function(
				'x', 'y', 'cell', 'size', 'dotSize',
				'foreground', 'background', 'outlineColor', 'isHollow',
				customCode
			) as (
				x: number, y: number, cell: boolean, size: number, dotSize: number,
				foreground: string, background: string, outlineColor: string, isHollow: boolean
			) => string;
			return { fn, error: '' };
		} catch (e) {
			return { fn: null, error: String(e) };
		}
	});

	// Test-call the compiled function with a sample pixel to catch runtime errors early,
	// before the render loop silently swallows them per pixel.
	let customRuntimeError = $derived.by(() => {
		if (!customFnResult.fn) return '';
		try {
			customFnResult.fn(5, 5, true,  21, 1.0, '#000000', '#ffffff', '#cccccc', false);
			customFnResult.fn(5, 5, false, 21, 1.0, '#000000', '#ffffff', '#cccccc', false);
			return '';
		} catch (e) {
			return String(e);
		}
	});

	function callCustomFn(x: number, y: number, cell: boolean): string {
		if (!customFnResult.fn) return '';
		try {
			return customFnResult.fn(
				x, y, cell, qrData.size, dotSize,
				foreground, background, outlineColor, isHollow
			) || '';
		} catch {
			return '';
		}
	}

	let aiDescription = $state('');
	let aiGenerating = $state(false);
	let aiError = $state('');

	async function generateWithAI() {
		if (!aiDescription.trim() || aiGenerating) return;
		aiGenerating = true;
		aiError = '';
		try {
			const res = await fetch('/api/qrcode/generate-renderer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: aiDescription })
			});
			const data = await res.json();
			// Always load the code if the server returned it (even on 422 syntax errors),
			// so the user can inspect or switch to Code mode to fix it.
			if (data.code) customCode = data.code;
			if (data.error) {
				aiError = data.error;
			}
		} catch {
			aiError = 'Network error — could not reach the server';
		} finally {
			aiGenerating = false;
		}
	}

	let foreground = $state('#000000');
	let outlineColor = $state('#cccccc');
	let background = $state('#ffffff');
	let transparentBg = $state(false);

	let qrContent = $derived.by(() => {
		if (textMode === 'url') return urlInput || ' ';
		if (textMode === 'text') return textInput || ' ';
		if (textMode === 'vcard') {
			let lines = ['BEGIN:VCARD', 'VERSION:3.0'];
			lines.push(`N:${vcard.lastName || ''};${vcard.firstName || ''};;;`);
			lines.push(`FN:${vcard.firstName || ''} ${vcard.lastName || ''}`.trim());
			if (vcard.org) lines.push(`ORG:${vcard.org}`);
			if (vcard.title) lines.push(`TITLE:${vcard.title}`);
			if (vcard.tel) lines.push(`TEL;TYPE=WORK,VOICE:${vcard.tel}`);
			if (vcard.email) lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcard.email}`);
			if (vcard.url) lines.push(`URL:${vcard.url}`);
			lines.push('END:VCARD');
			return lines.join('\n');
		}
		return ' ';
	});

	let eccLevel = $state<'L' | 'M' | 'Q' | 'H'>('L');
	let qrData = $derived(encode(qrContent, { ecc: eccLevel }));

	let svgElement: SVGSVGElement;

	function downloadSvg() {
		if (!svgElement) return;
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svgElement);
		const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `qrcode-${Date.now()}.svg`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>QR Code Generator // a version one</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col items-start gap-8 p-4 font-mono md:flex-row md:p-8">
	<!-- Left Side: Controls -->
	<div class="flex w-full flex-col gap-6 md:w-1/2">
		<div class="flex flex-col gap-2">
			<h1 class="text-2xl font-bold tracking-tight">QR Code Generator</h1>
			<p class="text-sm opacity-60">Generate highly customizable SVG QR Codes.</p>
		</div>

		<!-- Type Selection -->
		<div class="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition-all {textMode ===
				'url'
					? 'bg-white text-neutral-900 shadow'
					: 'text-neutral-500 hover:text-neutral-700'}"
				onclick={() => (textMode = 'url')}
			>
				<LinkIcon size={16} /> URL
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition-all {textMode ===
				'text'
					? 'bg-white text-neutral-900 shadow'
					: 'text-neutral-500 hover:text-neutral-700'}"
				onclick={() => (textMode = 'text')}
			>
				<Type size={16} /> Text
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition-all {textMode ===
				'vcard'
					? 'bg-white text-neutral-900 shadow'
					: 'text-neutral-500 hover:text-neutral-700'}"
				onclick={() => (textMode = 'vcard')}
			>
				<Contact size={16} /> vCard
			</button>
		</div>

		<!-- Input Forms -->
		<div class="flex flex-col gap-4">
			{#if textMode === 'url'}
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="url"
						>Website URL</label
					>
					<input
						id="url"
						type="url"
						class={inputClass}
						bind:value={urlInput}
						placeholder="https://example.com"
					/>
				</div>
			{:else if textMode === 'text'}
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="text"
						>Plain Text</label
					>
					<textarea
						id="text"
						class="{inputClass} min-h-24 font-mono text-sm"
						bind:value={textInput}
						placeholder="Enter any text here..."
					></textarea>
				</div>
			{:else if textMode === 'vcard'}
				<div class="grid grid-cols-2 gap-4">
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="firstName"
							>First Name</label
						>
						<input id="firstName" class={inputClass} bind:value={vcard.firstName} />
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="lastName"
							>Last Name</label
						>
						<input id="lastName" class={inputClass} bind:value={vcard.lastName} />
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="tel"
							>Phone</label
						>
						<input id="tel" type="tel" class={inputClass} bind:value={vcard.tel} />
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="email"
							>Email</label
						>
						<input id="email" type="email" class={inputClass} bind:value={vcard.email} />
					</div>
					<div class="col-span-2 flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="org"
							>Company/Organization</label
						>
						<input id="org" class={inputClass} bind:value={vcard.org} />
					</div>
					<div class="col-span-2 flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="vc-url"
							>Website</label
						>
						<input id="vc-url" type="url" class={inputClass} bind:value={vcard.url} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Appearance Settings -->
		<hr class="my-2 border-neutral-200 shadow-sm dark:border-neutral-800" />

		<div class="flex flex-col gap-4">
			<h3 class="text-md font-bold">Encoding & Appearance</h3>

			<div class="flex flex-col gap-2">
				<div class="text-xs font-bold tracking-wider uppercase opacity-50">Error Correction</div>
				<div class="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
					{#each [{v: 'L', l: 'Low (7%)'}, {v: 'M', l: 'Medium (15%)'}, {v: 'Q', l: 'Quartile (25%)'}, {v: 'H', l: 'High (30%)'}] as ecc}
						<button
							class="flex-1 rounded-md py-1 text-xs outline-none transition-all {eccLevel === ecc.v ? 'bg-white text-neutral-900 shadow' : 'text-neutral-500 hover:text-neutral-700'}"
							onclick={() => (eccLevel = ecc.v as 'L' | 'M' | 'Q' | 'H')}
						>
							{ecc.l}
						</button>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-2 mt-2">
				<div class="text-xs font-bold tracking-wider uppercase opacity-50">Dot Style</div>
				<div class="flex gap-2">
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'square'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'square')}
					>
						<Square size={24} />
						<span class="text-xs">Square</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'rounded'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'rounded')}
					>
						<Box size={24} />
						<span class="text-xs">Rounded</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'circle'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'circle')}
					>
						<Circle size={24} />
						<span class="text-xs">Circle</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'custom'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'custom')}
					>
						<Sparkles size={24} />
						<span class="text-xs">Custom</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'code'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'code')}
					>
						<Code size={24} />
						<span class="text-xs">Code</span>
					</button>
				</div>
			</div>

			{#if dotStyle === 'custom'}
				{@const suggestions = ['hexagons', 'stars', 'triangles', 'dots that shrink toward the edges', 'neon glow rings', 'rotating bars']}
				<div class="flex flex-col gap-3">
					<div class="text-xs font-bold tracking-wider uppercase opacity-50">Describe Your Effect</div>
					<div class="flex flex-wrap gap-1.5">
						{#each suggestions as s}
							<button
								class="rounded-full border border-neutral-300 px-2.5 py-1 text-xs opacity-50 transition-all hover:opacity-100 dark:border-neutral-700 {aiDescription === s ? 'border-blue-400 opacity-100 text-blue-600 dark:text-blue-400' : ''}"
								onclick={() => (aiDescription = s)}
							>{s}</button>
						{/each}
					</div>
					<textarea
						class="{inputClass} min-h-20 text-sm leading-relaxed"
						placeholder="e.g. hexagons, or stars, or dots that fade to nothing at the edges"
						bind:value={aiDescription}
						disabled={aiGenerating}
					></textarea>
					<button
						class="flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
						onclick={generateWithAI}
						disabled={aiGenerating || !aiDescription.trim()}
					>
						{#if aiGenerating}
							<Loader size={16} class="animate-spin" />
							Generating…
						{:else}
							<Sparkles size={16} />
							Generate with AI
						{/if}
					</button>
					{#if aiError || customFnResult.error || customRuntimeError}
						<div class="flex flex-col gap-2 rounded-md bg-red-50 px-3 py-2.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
							<p>{aiError || customFnResult.error || customRuntimeError}</p>
							{#if !aiError}
								<button
									class="self-start rounded border border-red-300 px-2 py-1 text-xs font-medium transition-colors hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/40"
									onclick={() => (dotStyle = 'code')}
								>Open in Code mode to inspect &amp; fix →</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			{#if dotStyle === 'code'}
				<div class="flex flex-col gap-2">
					<div class="text-xs font-bold tracking-wider uppercase opacity-50">Pixel Renderer (JS)</div>
					<!-- Example presets -->
					<div class="flex flex-wrap gap-1">
						{#each examples as ex}
							<button
								class="rounded-full border px-2.5 py-1 text-xs transition-all {customCode === ex.code
									? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
									: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
								onclick={() => (customCode = ex.code)}
							>{ex.name}</button>
						{/each}
					</div>
					<!-- Code editor -->
					<textarea
						class="{inputClass} min-h-52 font-mono text-xs leading-relaxed"
						bind:value={customCode}
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
					></textarea>
					{#if customFnResult.error || customRuntimeError}
						<div class="rounded-md bg-red-50 px-3 py-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
							{customFnResult.error || customRuntimeError}
						</div>
					{/if}
					<p class="text-xs opacity-40">
						Variables: <code>x</code>, <code>y</code>, <code>cell</code>, <code>size</code>, <code>dotSize</code>, <code>foreground</code>, <code>background</code>, <code>outlineColor</code>, <code>isHollow</code>. Return an SVG element string.
					</p>
				</div>
			{/if}

			{#if dotStyle === 'rounded'}
				<div class="mt-2 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="dotRadius"
							>Corner Radius</label
						>
						<span class="font-mono text-xs opacity-70">{dotRadius.toFixed(2)}</span>
					</div>
					<input
						id="dotRadius"
						type="range"
						min="0"
						max="0.5"
						step="0.05"
						bind:value={dotRadius}
						class="w-full"
					/>
				</div>
			{/if}

			<div class="mt-2 flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="dotSize"
						>Dot Size</label
					>
					<span class="font-mono text-xs opacity-70">{dotSize.toFixed(2)}</span>
				</div>
				<input
					id="dotSize"
					type="range"
					min="0.1"
					max="1.0"
					step="0.05"
					bind:value={dotSize}
					class="w-full"
				/>
			</div>

			<div class="mt-2 flex flex-col gap-2">
				<label class="flex cursor-pointer items-center gap-2 text-sm">
					<input
						type="checkbox"
						bind:checked={isHollow}
						class="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
					/>
					<span class="font-medium">Draw Blank Pixels as Outlines</span>
				</label>
				{#if isHollow}
					<div class="flex items-center gap-2 pl-6">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="outlineColor">Outline Color</label>
						<input
							type="color"
							id="outlineColor"
							bind:value={outlineColor}
							class="h-6 w-6 shrink-0 cursor-pointer rounded"
						/>
						<input type="text" bind:value={outlineColor} class="{inputClass} flex-1 py-1 uppercase" />
					</div>
				{/if}
			</div>

			<hr class="my-2 border-neutral-200 shadow-sm dark:border-neutral-800" />

			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="foreground"
						>Foreground</label
					>
					<div class="flex items-center gap-2">
						<input
							type="color"
							id="foreground"
							bind:value={foreground}
							class="h-8 w-8 shrink-0 cursor-pointer rounded"
						/>
						<input type="text" bind:value={foreground} class="{inputClass} flex-1 uppercase" />
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="background"
						>Background</label
					>
					<div class="flex items-center gap-2">
						<input
							type="color"
							id="background"
							bind:value={background}
							disabled={transparentBg}
							class="h-8 w-8 shrink-0 cursor-pointer rounded disabled:opacity-30"
						/>
						<input
							type="text"
							bind:value={background}
							disabled={transparentBg}
							class="{inputClass} flex-1 uppercase disabled:opacity-30"
						/>
					</div>
					<label class="mt-1 flex cursor-pointer items-center gap-2 text-xs">
						<input type="checkbox" bind:checked={transparentBg} class="h-4 w-4" />
						Transparent
					</label>
				</div>
			</div>
		</div>
	</div>

	<!-- Right Side: Preview & Download -->
	<div
		class="flex w-full flex-col items-center justify-center gap-8 rounded-2xl bg-neutral-100 p-4 md:sticky md:top-8 md:w-1/2 md:p-12 dark:bg-neutral-800"
	>
		<div
			class="relative flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-xl bg-white/10 p-8 shadow-xl transition-all"
			style="background-color: {transparentBg ? 'transparent' : background}"
		>
			{#if transparentBg}
				<div
					class="absolute inset-0 z-0 opacity-10"
					style="background-image: linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;"
				></div>
			{/if}

			<svg
				bind:this={svgElement}
				viewBox="0 0 {qrData.size} {qrData.size}"
				xmlns="http://www.w3.org/2000/svg"
				class="relative z-10 h-full w-full"
			>
				{#if !transparentBg}
					<rect width={qrData.size} height={qrData.size} fill={background} />
				{/if}
				{#each qrData.data as row, y}
					{#each row as cell, x}
						{#if dotStyle === 'code' || dotStyle === 'custom'}
							{@html callCustomFn(x, y, cell)}
						{:else if cell}
							{#if dotStyle === 'square'}
								<rect
									x={x + (1 - dotSize) / 2}
									y={y + (1 - dotSize) / 2}
									width={dotSize}
									height={dotSize}
									fill={foreground}
								/>
							{:else if dotStyle === 'circle'}
								<circle cx={x + 0.5} cy={y + 0.5} r={dotSize * 0.5} fill={foreground} />
							{:else if dotStyle === 'rounded'}
								<rect
									x={x + (1 - dotSize) / 2}
									y={y + (1 - dotSize) / 2}
									width={dotSize}
									height={dotSize}
									rx={dotRadius}
									ry={dotRadius}
									fill={foreground}
								/>
							{/if}
						{:else if isHollow}
							{#if dotStyle === 'square'}
								<rect
									x={x + (1 - dotSize) / 2 + 0.05}
									y={y + (1 - dotSize) / 2 + 0.05}
									width={Math.max(0.1, dotSize - 0.1)}
									height={Math.max(0.1, dotSize - 0.1)}
									fill="none"
									stroke={outlineColor}
									stroke-width="0.1"
								/>
							{:else if dotStyle === 'circle'}
								<circle
									cx={x + 0.5}
									cy={y + 0.5}
									r={Math.max(0.05, dotSize * 0.5 - 0.05)}
									fill="none"
									stroke={outlineColor}
									stroke-width="0.1"
								/>
							{:else if dotStyle === 'rounded'}
								<rect
									x={x + (1 - dotSize) / 2 + 0.05}
									y={y + (1 - dotSize) / 2 + 0.05}
									width={Math.max(0.1, dotSize - 0.1)}
									height={Math.max(0.1, dotSize - 0.1)}
									rx={dotRadius}
									ry={dotRadius}
									fill="none"
									stroke={outlineColor}
									stroke-width="0.1"
								/>
							{/if}
						{/if}
					{/each}
				{/each}
			</svg>
		</div>

		<button
			onclick={downloadSvg}
			class="flex items-center gap-2 rounded-full bg-neutral-900 px-8 py-3 font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 dark:bg-neutral-100 dark:text-neutral-900"
		>
			<Download size={20} />
			Download SVG
		</button>
	</div>
</div>
