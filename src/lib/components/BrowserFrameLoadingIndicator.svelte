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
	let homePosition = { x: 2, y: 2, z: 1 };

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

		// Directional light that will spin (less dramatic intensity)
		light = new THREE.DirectionalLight(0xffffff, 0.6);
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
		camera.position.set(0.8, 0.8, 1.2);
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

		if (lMesh && light) {
			if (loading) {
				// Rotate L around Z-axis while loading
				lMesh.rotation.z += 0.01;
				
				// Spin the light around the model (less dramatic)
				const time = Date.now() * 0.001;
				light.position.x = Math.cos(time) * 2.2;
				light.position.y = Math.sin(time) * 2.2;
				light.position.z = Math.sin(time * 0.5) * 1.2 + 1.8;
				light.intensity = 0.6;
			} else {
				// Animate to home position when not loading
				const targetRotation = 0;
				const rotationDiff = targetRotation - lMesh.rotation.z;
				lMesh.rotation.z += rotationDiff * 0.1; // Smooth animation to home
				
				// Move light to bright home position
				light.position.x += (homePosition.x - light.position.x) * 0.1;
				light.position.y += (homePosition.y - light.position.y) * 0.1;
				light.position.z += (homePosition.z - light.position.z) * 0.1;
				light.intensity = 1.2; // Bright lighting when idle
			}
		}

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<canvas bind:this={canvas} class="w-8 h-8"></canvas>