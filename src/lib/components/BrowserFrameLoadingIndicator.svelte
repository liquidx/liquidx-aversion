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
	let topLight: THREE.DirectionalLight;
	let sphereLight: THREE.DirectionalLight;
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
		const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Reduced ambient light
		scene.add(ambientLight);

		// Static directional light from the side
		light = new THREE.DirectionalLight(0xffffff, 0.8);
		light.position.set(2, 2, 1);
		scene.add(light);

		// Additional directional light from the top
		topLight = new THREE.DirectionalLight(0xffffff, 1.0);
		topLight.position.set(0, 3, 2);
		scene.add(topLight);

		// Light specifically for illuminating the sphere from above
		sphereLight = new THREE.DirectionalLight(0xffffff, 0.5);
		sphereLight.position.set(0, 0, -1);
		sphereLight.target.position.set(0, 0, 1.5); // Point at sphere position
		scene.add(sphereLight);
		scene.add(sphereLight.target);

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
		horizontalMesh.position.set(0.2, 0, 0.3);

		lGroup.add(verticalMesh);
		lGroup.add(horizontalMesh);

		// Add large grey sphere underneath the L
		const sphereGeometry = new THREE.SphereGeometry(1.2, 16, 16);
		const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 }); // Grey color
		const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphereMesh.position.set(0, 0, 1.5); // Position below the L
		lGroup.add(sphereMesh);

		scene.add(lGroup);
		lMesh = lGroup;

		// Position camera to view L from an angle
		camera.position.set(0, 1.5, 0);
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

		if (lMesh) {
			if (loading) {
				// Rotate L around Z-axis while loading
				lMesh.rotation.z += 0.05;
			} else {
				// Animate to home position when not loading
				const targetRotation = 0;
				const rotationDiff = targetRotation - lMesh.rotation.z;
				lMesh.rotation.z += rotationDiff * 0.1; // Smooth animation to home
			}
		}

		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<canvas bind:this={canvas} class="h-8 w-8"></canvas>
