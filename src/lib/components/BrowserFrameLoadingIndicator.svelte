<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	interface Props {
		loading?: boolean;
	}

	let { loading = false }: Props = $props();

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let lMesh: THREE.Group;
	let light: THREE.DirectionalLight;
	let animationId: number;

	onMount(() => {
		if (!canvas) return;

		// Set up Three.js scene
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
		renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		renderer.setSize(32, 32); // Small size for the indicator
		renderer.setClearColor(0x000000, 1); // Black background

		// Add lighting
		const ambientLight = new THREE.AmbientLight(0x404040, 0.9); // Brighter ambient light
		scene.add(ambientLight);

		// Dramatic directional light that will spin
		light = new THREE.DirectionalLight(0xffffff, 1.5);
		light.position.set(2, 2, 1);
		scene.add(light);

		// Create L geometry with proper material for lighting
		const lGroup = new THREE.Group();

		// Vertical part of L (along Z-axis)
		const verticalGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.8);
		const material = new THREE.MeshLambertMaterial({ color: 0x4169e1 }); // Royal blue with lighting response
		const verticalMesh = new THREE.Mesh(verticalGeometry, material);
		verticalMesh.position.set(0, 0, 0);

		// Horizontal part of L (along X-axis, at bottom)
		const horizontalGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.2);
		const horizontalMesh = new THREE.Mesh(horizontalGeometry, material);
		horizontalMesh.position.set(0.2, 0, -0.3);

		lGroup.add(verticalMesh);
		lGroup.add(horizontalMesh);

		scene.add(lGroup);
		lMesh = lGroup;

		// Position camera closer for better view of the L
		camera.position.set(0, -1.2, 0);
		camera.lookAt(0, 0, 0);

		// Start animation loop
		animate();
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		if (renderer) {
			renderer.dispose();
		}
	});

	function animate() {
		animationId = requestAnimationFrame(animate);

		if (loading && lMesh && light) {
			// Rotate L around Z-axis
			lMesh.rotation.z += 0.01;

			// Spin the light around the model for dramatic effect
			const time = Date.now() * 0.002;
			light.position.x = Math.cos(time) * 3;
			light.position.y = Math.sin(time) * 3;
			light.position.z = Math.sin(time * 0.7) * 2 + 1;
		}

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<canvas bind:this={canvas} class="h-8 w-8"></canvas>
