document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Navbar Scroll Effect & Mobile Menu ---
    const navbar = document.querySelector('.navbar');
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    const allNavLinks = document.querySelectorAll('.nav-link, #nav-contact');
    
    // Navbar background on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = mobileToggle.querySelector('i');
        if(navLinks.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });

    // Close mobile menu when a link is clicked
    allNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = mobileToggle.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        });
    });

    // --- 2. Scroll Animation (Intersection Observer) ---
    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Stop observing once element is visible
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        observer.observe(section);
    });

    // --- 3. Typing Effect in Hero Section ---
    const subtitleElement = document.querySelector('.hero-subtitle');
    const phrases = [
        "Industrial Automation Software Engineer",
        "C# & SQL Server Developer",
        "PC / PLC / Robot Programmer",
        "Problem Solver"
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingDelay = 100;

    function typeEffect() {
        const currentPhrase = phrases[phraseIndex];
        
        if (isDeleting) {
            // Remove chars
            subtitleElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typingDelay = 50;
        } else {
            // Add chars
            subtitleElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typingDelay = 100;
        }

        // If word is complete
        if (!isDeleting && charIndex === currentPhrase.length) {
            isDeleting = true;
            typingDelay = 2000; // Pause at end of phrase
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typingDelay = 500; // Pause before typing next phrase
        }

        setTimeout(typeEffect, typingDelay);
    }

    // Start typing effect after a short delay
    setTimeout(() => {
        if(subtitleElement) {
            subtitleElement.textContent = ""; // Clear initial text
            typeEffect();
        }
    }, 1000);

    // --- 4. 3D Background Animation (Three.js) ---
    function init3DBackground() {
        const canvas = document.getElementById('bg-canvas');
        // Ensure Three.js is loaded
        if (!canvas || typeof THREE === 'undefined') return;

        const scene = new THREE.Scene();
        // Setup camera
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Group to hold our 3D core
        const coreGroup = new THREE.Group();
        scene.add(coreGroup);

        // 1. Icosahedron (Tech Core)
        const coreGeometry = new THREE.IcosahedronGeometry(2, 1);
        
        // Wireframe mesh
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9, // accent-blue
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        const wireframeMesh = new THREE.Mesh(coreGeometry, wireframeMaterial);
        coreGroup.add(wireframeMesh);
        
        // Points at vertices
        const pointsMaterial = new THREE.PointsMaterial({
            size: 0.08,
            color: 0x06b6d4, // accent-cyan
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });
        const pointsMesh = new THREE.Points(coreGeometry, pointsMaterial);
        coreGroup.add(pointsMesh);

        // 2. Outer Orbit Rings
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6, // accent-purple
            transparent: true,
            opacity: 0.15,
            wireframe: true
        });

        const ringGeometry1 = new THREE.TorusGeometry(3.5, 0.01, 16, 100);
        const ringMesh1 = new THREE.Mesh(ringGeometry1, ringMaterial);
        ringMesh1.rotation.x = Math.PI / 2;
        coreGroup.add(ringMesh1);
        
        const ringGeometry2 = new THREE.TorusGeometry(4.5, 0.01, 16, 100);
        const ringMesh2 = new THREE.Mesh(ringGeometry2, ringMaterial);
        ringMesh2.rotation.y = Math.PI / 2;
        coreGroup.add(ringMesh2);

        // 3. Floating Data Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 400;
        const posArray = new Float32Array(particlesCount * 3);
        
        for(let i = 0; i < particlesCount * 3; i++) {
            // Spread particles over a large volume
            posArray[i] = (Math.random() - 0.5) * 25;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMat = new THREE.PointsMaterial({
            size: 0.03,
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMat);
        scene.add(particlesMesh);

        // Layout positioning logic for Desktop vs Mobile
        function updateLayout() {
            if (window.innerWidth > 900) {
                // Place it slightly right of center on desktop to balance text
                coreGroup.position.x = 3.5;
                coreGroup.position.y = 0;
                camera.position.z = 8;
            } else {
                // Center and float up on mobile
                coreGroup.position.x = 0;
                coreGroup.position.y = 2.5; 
                camera.position.z = 10;
            }
        }
        updateLayout();

        // Mouse interaction
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;

        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - windowHalfX) * 0.001;
            mouseY = (event.clientY - windowHalfY) * 0.001;
        });

        // Loop
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            // Rotate core and rings
            coreGroup.rotation.y += 0.002;
            coreGroup.rotation.x += 0.001;
            
            ringMesh1.rotation.z -= 0.003;
            ringMesh2.rotation.z += 0.002;

            // Rotate particles slowly
            particlesMesh.rotation.y = elapsedTime * 0.015;

            // Smoothly interpolate towards mouse target
            targetX = mouseX * 1.5;
            targetY = mouseY * 1.5;
            
            coreGroup.rotation.y += 0.05 * (targetX - coreGroup.rotation.y);
            coreGroup.rotation.x += 0.05 * (targetY - coreGroup.rotation.x);
            
            renderer.render(scene, camera);
        }
        
        animate();

        // Resize handler
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateLayout();
        });
    }

    // Start 3D Background
    init3DBackground();
});
