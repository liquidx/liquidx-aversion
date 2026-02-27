<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let particles: THREE.Points;
	let animationId: number;

	interface Props {
		width?: number;
		height?: number;
	}

	let { width = 800, height = 600 }: Props = $props();

	onMount(() => {
		// Initialize Three.js scene
		initScene();

		// Start animation loop
		animate();

		// Cleanup on component destroy
		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
			if (renderer) {
				renderer.dispose();
			}
		};
	});

	function initScene() {
		// Create scene
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x000000);

		// Create camera
		camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
		camera.position.z = 5;

		// Create renderer
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true
		});
		renderer.setSize(width, height);
		renderer.setPixelRatio(window.devicePixelRatio);

		// Create particle system (matrix-like effect)
		createParticles();
	}

	function createParticles() {
		const particlesGeometry = new THREE.BufferGeometry();
		const particleCount = 1000;

		const positions = new Float32Array(particleCount * 3);
		const colors = new Float32Array(particleCount * 3);

		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;

			// Random positions
			positions[i3] = (Math.random() - 0.5) * 20;
			positions[i3 + 1] = (Math.random() - 0.5) * 20;
			positions[i3 + 2] = (Math.random() - 0.5) * 20;

			// Green matrix-like colors
			colors[i3] = 0.0; // Red
			colors[i3 + 1] = Math.random() * 0.5 + 0.5; // Green
			colors[i3 + 2] = 0.0; // Blue
		}

		particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const particlesMaterial = new THREE.PointsMaterial({
			size: 0.05,
			vertexColors: true,
			blending: THREE.AdditiveBlending,
			transparent: true,
			opacity: 0.8
		});

		particles = new THREE.Points(particlesGeometry, particlesMaterial);
		scene.add(particles);
	}

	function animate() {
		animationId = requestAnimationFrame(animate);

		// Rotate particles slowly
		if (particles) {
			particles.rotation.y += 0.002;
			particles.rotation.x += 0.001;
		}

		// Render the scene
		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<div class="terminal-bg">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.terminal-bg {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: -1;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
