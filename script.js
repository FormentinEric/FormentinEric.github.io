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

    // --- 5. 3D Warehouse & Code Typing Animation ---
    function initWarehouseDemo() {
        const container = document.getElementById('warehouse-canvas-container');
        if (!container || typeof THREE === 'undefined') return;

        // 1. Setup Scene, Camera, Renderer
        const scene = new THREE.Scene();
        // Give it a subtle transparent/dark background matching the theme
        scene.background = new THREE.Color(0x0f172a);

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(12, 10, 12);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // 2. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        // 3. Environment (Floor & Shelves)
        const gridHelper = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
        scene.add(gridHelper);

        const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 });
        const shelfGeo = new THREE.BoxGeometry(1.5, 4, 6);
        
        const shelf1 = new THREE.Mesh(shelfGeo, shelfMaterial);
        shelf1.position.set(-4, 2, 0);
        scene.add(shelf1);

        const shelf2 = new THREE.Mesh(shelfGeo, shelfMaterial);
        shelf2.position.set(4, 2, 0);
        scene.add(shelf2);

        // 4. LGV (Automated Guided Vehicle) - Detailed Shape
        const lgv = new THREE.Group();
        
        const lgvBaseMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // dark grey base
        const lgvBodyMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b }); // amber / orange
        const lgvScannerMat = new THREE.MeshLambertMaterial({ color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.5 });
        
        // Base bumper
        const baseGeo = new THREE.BoxGeometry(1.3, 0.2, 1.9);
        const baseMesh = new THREE.Mesh(baseGeo, lgvBaseMat);
        baseMesh.position.y = -0.2;
        lgv.add(baseMesh);

        // Main chassis
        const chassisGeo = new THREE.BoxGeometry(1.1, 0.3, 1.7);
        const chassisMesh = new THREE.Mesh(chassisGeo, lgvBodyMat);
        chassisMesh.position.y = 0.05;
        lgv.add(chassisMesh);

        // Scanners at both ends
        const scannerGeo = new THREE.BoxGeometry(0.8, 0.15, 0.3);
        const scanner1 = new THREE.Mesh(scannerGeo, lgvScannerMat);
        scanner1.position.set(0, -0.05, 0.95);
        lgv.add(scanner1);
        
        const scanner2 = new THREE.Mesh(scannerGeo, lgvScannerMat);
        scanner2.position.set(0, -0.05, -0.95);
        lgv.add(scanner2);

        // Warning light mast
        const mastGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
        const mast = new THREE.Mesh(mastGeo, lgvBaseMat);
        mast.position.set(-0.4, 0.5, 0);
        lgv.add(mast);

        const lightGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(-0.4, 0.85, 0);
        lgv.add(light);

        lgv.position.set(0, 0.3, 6);
        scene.add(lgv);

        // Pallet
        const palletGeo = new THREE.BoxGeometry(1.0, 0.2, 1.0);
        const palletMat = new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }); // purple
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        scene.add(pallet); // starting somewhere

        // State Machine for LGV
        const states = [
            { target: new THREE.Vector3(0, 0.3, 6), action: 'idle' },
            { target: new THREE.Vector3(-2.8, 0.3, 6), action: 'move' },
            { target: new THREE.Vector3(-2.8, 0.3, 0), action: 'move' }, // near shelf1
            { target: new THREE.Vector3(-2.8, 0.3, 0), action: 'pickup' },
            { target: new THREE.Vector3(-2.8, 0.3, 6), action: 'move' },
            { target: new THREE.Vector3(2.8, 0.3, 6), action: 'move' },
            { target: new THREE.Vector3(2.8, 0.3, 0), action: 'move' }, // near shelf2
            { target: new THREE.Vector3(2.8, 0.3, 0), action: 'drop' },
            { target: new THREE.Vector3(2.8, 0.3, 6), action: 'move' },
            { target: new THREE.Vector3(0, 0.3, 6), action: 'move' }
        ];

        let currentStateIndex = 0;
        let hasPallet = false;

        // Ensure pallet is placed correctly at start (shelf 1)
        pallet.position.set(-2.8, 0.1, 0); 

        const clock = new THREE.Clock();
        const speed = 3.0;

        function animate3D() {
            requestAnimationFrame(animate3D);
            const delta = clock.getDelta();

            const state = states[currentStateIndex];
            
            if (state.action === 'move') {
                const direction = new THREE.Vector3().subVectors(state.target, lgv.position);
                const distance = direction.length();
                
                if (distance > 0.1) {
                    direction.normalize();
                    lgv.position.add(direction.multiplyScalar(speed * delta));
                    // Look in direction of movement
                    const lookAtTarget = lgv.position.clone().add(direction);
                    lgv.lookAt(lookAtTarget);
                } else {
                    currentStateIndex = (currentStateIndex + 1) % states.length;
                }
            } else if (state.action === 'pickup') {
                if (!lgv.userData.timer) lgv.userData.timer = 0;
                lgv.userData.timer += delta;
                if (lgv.userData.timer > 0.8) {
                    hasPallet = true;
                    lgv.userData.timer = 0;
                    currentStateIndex = (currentStateIndex + 1) % states.length;
                }
            } else if (state.action === 'drop') {
                if (!lgv.userData.timer) lgv.userData.timer = 0;
                lgv.userData.timer += delta;
                if (lgv.userData.timer > 0.8) {
                    hasPallet = false;
                    pallet.position.set(2.8, 0.1, 0); // drop location at shelf 2
                    lgv.userData.timer = 0;
                    currentStateIndex = (currentStateIndex + 1) % states.length;
                }
            } else {
                // idle
                if (!lgv.userData.timer) lgv.userData.timer = 0;
                lgv.userData.timer += delta;
                if (lgv.userData.timer > 1.0) {
                    // reset pallet to shelf1
                    pallet.position.set(-2.8, 0.1, 0);
                    lgv.userData.timer = 0;
                    currentStateIndex = (currentStateIndex + 1) % states.length;
                }
            }

            // Sync pallet position
            if (hasPallet) {
                pallet.position.copy(lgv.position);
                pallet.position.y += 0.3; // sit correctly on top of new chassis
            }

            renderer.render(scene, camera);
        }

        animate3D();

        // Handle resize
        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });

        // Code Typing Logic
        const codeElement = document.getElementById('code-typing-area');
        const codeLines = [
            "<span class='keyword'>public class</span> <span class='type'>LgvController</span> {",
            "    <span class='keyword'>public void</span> <span class='method'>RouteLgv</span>(<span class='type'>Lgv</span> lgv, <span class='type'>Position</span> target) {",
            "        <span class='type'>Console</span>.<span class='method'>WriteLine</span>(<span class='string'>$\"Routing LGV {lgv.Id} to {target}...\"</span>);",
            "        <span class='keyword'>while</span> (lgv.Position != target) {",
            "            <span class='type'>Path</span> path = <span class='type'>PathFinder</span>.<span class='method'>Calculate</span>(lgv.Position, target);",
            "            lgv.<span class='method'>Move</span>(path.NextStep);",
            "            ",
            "            <span class='keyword'>if</span> (<span class='method'>CheckCollision</span>(lgv)) {",
            "                lgv.<span class='method'>Stop</span>();",
            "                <span class='type'>Logger</span>.<span class='method'>Warn</span>(<span class='string'>\"Collision detected!\"</span>);",
            "                <span class='method'>RecalculateRoute</span>(lgv);",
            "            }",
            "            <span class='keyword'>await</span> <span class='type'>Task</span>.<span class='method'>Delay</span>(<span class='number'>100</span>);",
            "        }",
            "        ",
            "        <span class='type'>Console</span>.<span class='method'>WriteLine</span>(<span class='string'>\"Target reached. Initiating operation.\"</span>);",
            "        lgv.<span class='method'>ExecutePalletOperation</span>();",
            "    }",
            "}"
        ];
        
        let lineIndex = 0;
        let isTyping = false;

        function typeCode() {
            if (lineIndex < codeLines.length) {
                codeElement.innerHTML += codeLines[lineIndex] + "<br>";
                lineIndex++;
                
                // Auto-scroll to bottom
                const pcBody = document.querySelector('.pc-body');
                if (pcBody) pcBody.scrollTop = pcBody.scrollHeight;
                
                setTimeout(typeCode, 300 + Math.random() * 500);
            } else {
                // Restart code typing after pause
                setTimeout(() => {
                    codeElement.innerHTML = "";
                    lineIndex = 0;
                    typeCode();
                }, 8000);
            }
        }

        // Start when section is visible
        const obs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isTyping) {
                isTyping = true;
                setTimeout(typeCode, 500);
            }
        }, { threshold: 0.2 });
        obs.observe(container);
    }

    initWarehouseDemo();
});
