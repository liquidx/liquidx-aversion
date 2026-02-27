<script lang="ts">
	import { onMount, tick } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

	let container: HTMLDivElement;
	let frontFileInput: HTMLInputElement;
	let backFileInput: HTMLInputElement;

	let frontImageSrc = $state<string | null>(null);
	let backImageSrc = $state<string | null>(null);

	let frontTexture: THREE.Texture | null = null;
	let backTexture: THREE.Texture | null = null;

	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let controls: OrbitControls;
	let snowboardMesh = $state<THREE.Mesh | null>(null);

	const thickness = 0.0125;
	let isDragging = false;
	let autoRotateZ = $state(false);

	onMount(() => {
		initThree();
		return () => {
			renderer.dispose();
			scene.clear();
		};
	});

	function initThree() {
		scene = new THREE.Scene();
		scene.background = new THREE.Color('#111111');

		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
		camera.position.set(0, 0, 5);

		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		container.appendChild(renderer.domElement);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.rotateSpeed = 2.0;
		controls.addEventListener('change', requestRender);

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);

		const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
		dirLight.position.set(5, 5, 5);
		scene.add(dirLight);

		const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
		dirLight2.position.set(-5, -5, -5);
		scene.add(dirLight2);

		window.addEventListener('resize', onWindowResize);

		requestRender();
	}

	let renderRequested = false;

	function requestRender() {
		if (!renderRequested) {
			renderRequested = true;
			requestAnimationFrame(render);
		}
	}

	$effect(() => {
		if (autoRotateZ) {
			requestRender();
		}
	});

	function render() {
		renderRequested = false;

		if (autoRotateZ && snowboardMesh && !isDragging) {
			snowboardMesh.rotation.z += 0.01;
			requestRender();
		}

		renderer.render(scene, camera);
	}

	function onWindowResize() {
		if (!camera || !renderer) return;
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
		requestRender();
	}

	function handleFrontFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			const url = URL.createObjectURL(file);
			frontImageSrc = url;
			loadFrontTexture(url);
		}
	}

	function handleBackFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			const url = URL.createObjectURL(file);
			backImageSrc = url;
			loadBackTexture(url);
		}
	}

	function loadFrontTexture(url: string) {
		const loader = new THREE.TextureLoader();
		loader.load(url, (texture) => {
			texture.colorSpace = THREE.SRGBColorSpace;
			frontTexture = texture;
			updateSnowboard();
		});
	}

	function loadBackTexture(url: string) {
		const loader = new THREE.TextureLoader();
		loader.load(url, (texture) => {
			texture.colorSpace = THREE.SRGBColorSpace;
			backTexture = texture;
			updateSnowboard();
		});
	}

	function extractShapeFromImage(
		image: HTMLImageElement,
		boardWidth: number,
		boardHeight: number
	): THREE.Shape {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;

		const maxDim = 256;
		let w = image.width;
		let h = image.height;
		if (Math.max(w, h) > maxDim) {
			const scale = maxDim / Math.max(w, h);
			w = Math.floor(w * scale);
			h = Math.floor(h * scale);
		}
		canvas.width = w;
		canvas.height = h;
		ctx.drawImage(image, 0, 0, w, h);

		const imgData = ctx.getImageData(0, 0, w, h);
		const data = imgData.data;

		const leftEdge: { x: number; y: number }[] = [];
		const rightEdge: { x: number; y: number }[] = [];

		const alphaThreshold = 120; // Somewhat permissive to get a clean outline

		for (let y = 0; y < h; y++) {
			let firstX = -1;
			let lastX = -1;

			for (let x = 0; x < w; x++) {
				const idx = (y * w + x) * 4;
				if (data[idx + 3] > alphaThreshold) {
					if (firstX === -1) firstX = x;
					lastX = x;
				}
			}

			if (firstX !== -1) {
				const threeY = -(y / h - 0.5) * boardHeight;
				const threeXFirst = (firstX / w - 0.5) * boardWidth;
				const threeXLast = (lastX / w - 0.5) * boardWidth;

				leftEdge.push({ x: threeXFirst, y: threeY });
				rightEdge.push({ x: threeXLast, y: threeY });
			}
		}

		const contour = [...leftEdge, ...rightEdge.reverse()];

		const shape = new THREE.Shape();
		if (contour.length > 0) {
			shape.moveTo(contour[0].x, contour[0].y);
			for (let i = 1; i < contour.length; i++) {
				shape.lineTo(contour[i].x, contour[i].y);
			}
			shape.lineTo(contour[0].x, contour[0].y);
		}

		return shape;
	}

	function updateSnowboard() {
		if (!frontTexture) return;

		if (snowboardMesh) {
			scene.remove(snowboardMesh);
			if (Array.isArray(snowboardMesh.material)) {
				snowboardMesh.material.forEach((m) => m.dispose());
			} else {
				snowboardMesh.material.dispose();
			}
			snowboardMesh.geometry.dispose();
		}

		const aspect = frontTexture.image.width / frontTexture.image.height;
		const height = 2;
		const width = height * aspect;

		const shape = extractShapeFromImage(frontTexture.image, width, height);

		const extrudeSettings = {
			depth: thickness * 0.5,
			bevelEnabled: true,
			bevelThickness: thickness * 0.25,
			bevelSize: 0.002,
			bevelSegments: 4,
			curveSegments: 12
		};

		const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
		geometry.translate(0, 0, -thickness / 2);

		const posAttribute = geometry.attributes.position;
		const uvAttribute = geometry.attributes.uv;
		for (let i = 0; i < posAttribute.count; i++) {
			const x = posAttribute.getX(i);
			const y = posAttribute.getY(i);

			const u = x / width + 0.5;
			const v = y / height + 0.5;

			uvAttribute.setXY(i, u, v);
		}
		uvAttribute.needsUpdate = true;

		// ExtrudeGeometry generates 2 groups by default: [0] for front/back caps, [1] for sides
		const capGroup = geometry.groups[0];
		if (capGroup) {
			const halfCount = capGroup.count / 2;
			geometry.groups = [
				{ start: 0, count: halfCount, materialIndex: 0 }, // Front cap
				{ start: halfCount, count: halfCount, materialIndex: 1 }, // Back cap
				{ start: geometry.groups[1].start, count: geometry.groups[1].count, materialIndex: 2 } // Sides
			];
		}

		const sideMat = new THREE.MeshStandardMaterial({
			color: 0x333333,
			roughness: 0.7,
			metalness: 0.1
		});

		const frontMat = new THREE.MeshStandardMaterial({
			map: frontTexture,
			transparent: true,
			alphaTest: 0.5,
			roughness: 0.2,
			metalness: 0.1
		});

		const backMat = backTexture
			? new THREE.MeshStandardMaterial({
					map: backTexture,
					transparent: true,
					alphaTest: 0.5,
					roughness: 0.2,
					metalness: 0.1
				})
			: sideMat;

		const materials = [
			frontMat, // materialIndex: 0
			backMat, // materialIndex: 1
			sideMat // materialIndex: 2
		];

		snowboardMesh = new THREE.Mesh(geometry, materials);
		scene.add(snowboardMesh);
		requestRender();
	}
</script>

<div class="relative h-full w-full overflow-hidden bg-neutral-900">
	<!-- 3D Canvas Container -->
	<div bind:this={container} class="absolute inset-0"></div>

	<!-- UI Overlay -->
	<div
		class="absolute top-4 left-4 z-10 flex w-80 flex-col gap-4 rounded-xl border border-white/10 bg-black/60 p-6 shadow-2xl backdrop-blur-md"
	>
		<h1 class="mb-2 text-2xl font-bold tracking-tight text-white">Snowboard Spinner</h1>

		<div class="flex flex-col gap-2">
			<label class="text-sm font-medium text-neutral-300">Front Graphic (Transparent PNG)</label>
			<div
				class="group relative flex h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-neutral-600 transition-colors hover:border-neutral-400"
				onclick={() => frontFileInput.click()}
			>
				{#if frontImageSrc}
					<img src={frontImageSrc} alt="Front preview" class="h-full w-auto object-contain p-2" />
				{:else}
					<span class="text-xs text-neutral-400 transition-colors group-hover:text-neutral-300"
						>Select Front Image</span
					>
				{/if}
			</div>
			<input
				type="file"
				bind:this={frontFileInput}
				onchange={handleFrontFileSelect}
				accept="image/png"
				class="hidden"
			/>
		</div>

		<div class="flex flex-col gap-2">
			<label class="text-sm font-medium text-neutral-300">Back Graphic (Transparent PNG)</label>
			<div
				class="group relative flex h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-neutral-600 transition-colors hover:border-neutral-400"
				onclick={() => backFileInput.click()}
			>
				{#if backImageSrc}
					<img src={backImageSrc} alt="Back preview" class="h-full w-auto object-contain p-2" />
				{:else}
					<span class="text-xs text-neutral-400 transition-colors group-hover:text-neutral-300"
						>Select Back Image</span
					>
				{/if}
			</div>
			<input
				type="file"
				bind:this={backFileInput}
				onchange={handleBackFileSelect}
				accept="image/png"
				class="hidden"
			/>
		</div>

		{#if snowboardMesh}
			<label class="mt-2 flex cursor-pointer items-center gap-2">
				<input
					type="checkbox"
					bind:checked={autoRotateZ}
					class="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-neutral-300 focus:ring-neutral-500 focus:ring-offset-neutral-900"
				/>
				<span class="text-sm font-medium text-neutral-300">Auto-rotate (Z-axis)</span>
			</label>
			<p class="mt-2 text-xs text-neutral-400">Drag to rotate. Scroll to zoom.</p>
		{/if}
	</div>
</div>
