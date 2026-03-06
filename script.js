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

    // --- Shared Functions ---
    function createForklift(bodyColor) {
        const forklift = new THREE.Group();
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); 
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor }); 
        const forkMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
        
        const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 1.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 0.4, 0.2); 
        forklift.add(bodyMesh);

        const roofGeo = new THREE.BoxGeometry(1.0, 0.1, 1.0);
        const roofMesh = new THREE.Mesh(roofGeo, baseMat);
        roofMesh.position.set(0, 1.4, 0.3);
        forklift.add(roofMesh);
        
        const pillarGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        const p1 = new THREE.Mesh(pillarGeo, baseMat); p1.position.set(-0.45, 1.1, -0.15); forklift.add(p1);
        const p2 = new THREE.Mesh(pillarGeo, baseMat); p2.position.set(0.45, 1.1, -0.15); forklift.add(p2);
        const p3 = new THREE.Mesh(pillarGeo, baseMat); p3.position.set(-0.45, 1.1, 0.75); forklift.add(p3);
        const p4 = new THREE.Mesh(pillarGeo, baseMat); p4.position.set(0.45, 1.1, 0.75); forklift.add(p4);

        const mastGeo = new THREE.BoxGeometry(1.2, 1.8, 0.2);
        const mastMesh = new THREE.Mesh(mastGeo, baseMat);
        mastMesh.position.set(0, 0.9, 1.1);
        forklift.add(mastMesh);

        const forkGeo = new THREE.BoxGeometry(0.15, 0.05, 1.2);
        const fork1 = new THREE.Mesh(forkGeo, forkMat);
        fork1.position.set(-0.35, 0.05, 1.3); 
        forklift.add(fork1);
        
        const fork2 = new THREE.Mesh(forkGeo, forkMat);
        fork2.position.set(0.35, 0.05, 1.3);
        forklift.add(fork2);

        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
        light.position.set(0, 1.55, 0.3);
        forklift.add(light);

        return forklift;
    }

    function createForkliftSimulation(bodyColor) {
        const forklift = new THREE.Group();
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); 
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor }); 
        const forkMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
        
        const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 1.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 0.4, 0.2); 
        forklift.add(bodyMesh);

        const roofGeo = new THREE.BoxGeometry(1.0, 0.1, 1.0);
        const roofMesh = new THREE.Mesh(roofGeo, baseMat);
        roofMesh.position.set(0, 1.4, 0.3);
        forklift.add(roofMesh);
        
        const pillarGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        const p1 = new THREE.Mesh(pillarGeo, baseMat); p1.position.set(-0.45, 1.1, -0.15); forklift.add(p1);
        const p2 = new THREE.Mesh(pillarGeo, baseMat); p2.position.set(0.45, 1.1, -0.15); forklift.add(p2);
        const p3 = new THREE.Mesh(pillarGeo, baseMat); p3.position.set(-0.45, 1.1, 0.75); forklift.add(p3);
        const p4 = new THREE.Mesh(pillarGeo, baseMat); p4.position.set(0.45, 1.1, 0.75); forklift.add(p4);

        const mastGeo = new THREE.BoxGeometry(1.2, 1.8, 0.2);
        const mastMesh = new THREE.Mesh(mastGeo, baseMat);
        mastMesh.position.set(0, 0.9, -0.7);
        forklift.add(mastMesh);

        const forkGeo = new THREE.BoxGeometry(0.15, 0.05, 1.2);
        const fork1 = new THREE.Mesh(forkGeo, forkMat);
        fork1.position.set(-0.35, 0.05, -1.3); 
        forklift.add(fork1);
        
        const fork2 = new THREE.Mesh(forkGeo, forkMat);
        fork2.position.set(0.35, 0.05, -1.3);
        forklift.add(fork2);

        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
        light.position.set(0, 1.55, 0.3);
        forklift.add(light);

        return forklift;
    }

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

        // 4. LGV (Forklift)
        const lgv = createForklift(0xf59e0b); // orange body
        scene.add(lgv);

        // Pallet
        const palletGeo = new THREE.BoxGeometry(1.0, 0.2, 1.0);
        const palletMat = new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }); // purple
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        scene.add(pallet); // starting somewhere

        // State Machine for LGV
        const states = [
            { target: new THREE.Vector3(0, 0, 6), action: 'idle' },
            { target: new THREE.Vector3(-0.5, 0, 6), action: 'move' },
            { target: new THREE.Vector3(-0.5, 0, 0), action: 'move' },
            { target: new THREE.Vector3(-1.5, 0, 0), action: 'turn' }, // Face shelf 1
            { target: new THREE.Vector3(-1.5, 0, 0), action: 'move' }, // Drive forks under pallet
            { target: new THREE.Vector3(0.5, 0, 0), action: 'pickup' },
            { target: new THREE.Vector3(-0.5, 0, 0), action: 'move_back' }, // Back away from shelf
            { target: new THREE.Vector3(-0.5, 0, 6), action: 'move' }, // Back to corridor
            { target: new THREE.Vector3(0.5, 0, 6), action: 'move' }, // Move along corridor to next zone
            { target: new THREE.Vector3(0.5, 0, 0), action: 'move' }, // Approach shelf 2
            { target: new THREE.Vector3(5, 0, 0), action: 'turn' }, // Face shelf 2
            { target: new THREE.Vector3(1.5, 0, 0), action: 'move' }, // Drive forks in securely
            { target: new THREE.Vector3(1.5, 0, 0), action: 'drop' }, // Lower pallet
            { target: new THREE.Vector3(0.5, 0, 0), action: 'move_back' }, // Back away safely
            { target: new THREE.Vector3(0.5, 0, 6), action: 'move' }, // Back to corridor
            { target: new THREE.Vector3(0, 0, 6), action: 'move' } // Return to origin
        ];

        let currentStateIndex = 0;
        let hasPallet = false;

        lgv.position.set(0, 0, 6);

        // Ensure pallet is placed perfectly in front of shelf 1 for pickup
        pallet.position.set(-2.8, 0.1, 0); 

        const clock = new THREE.Clock();
        const speed = 2.5; // Slightly slower for realism

        function animate3D() {
            requestAnimationFrame(animate3D);
            const delta = clock.getDelta();

            const state = states[currentStateIndex];
            
            if (state.action === 'move' || state.action === 'move_back') {
                const direction = new THREE.Vector3().subVectors(state.target, lgv.position);
                const distance = direction.length();
                
                if (distance > 0.05) {
                    direction.normalize();
                    lgv.position.add(direction.multiplyScalar(speed * delta));
                    
                    // Look smoothly in direction of movement (unless backing up)
                    if (state.action === 'move') {
                        const lookAtTarget = lgv.position.clone().add(direction);
                        const currentQuat = lgv.quaternion.clone();
                        lgv.lookAt(lookAtTarget);
                        const targetQuat = lgv.quaternion.clone();
                        lgv.quaternion.copy(currentQuat);
                        lgv.quaternion.slerp(targetQuat, 12 * delta); // Smooth rotation
                    }
                } else {
                    lgv.position.copy(state.target);
                    currentStateIndex = (currentStateIndex + 1) % states.length;
                }
            } else if (state.action === 'turn') {
                const currentQuat = lgv.quaternion.clone();
                lgv.lookAt(state.target);
                const targetQuat = lgv.quaternion.clone();
                lgv.quaternion.copy(currentQuat);
                lgv.quaternion.slerp(targetQuat, 8 * delta);
                
                if (!lgv.userData.timer) lgv.userData.timer = 0;
                lgv.userData.timer += delta;
                if (lgv.userData.timer > 0.6) { // Wait for turn to finish cleanly
                    lgv.lookAt(state.target);
                    lgv.userData.timer = 0;
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
                const offset = new THREE.Vector3(0, 0.2, 1.4);
                offset.applyQuaternion(lgv.quaternion);
                pallet.position.copy(lgv.position).add(offset);
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

    // --- 6. Interactive LGV Game ---
    function initInteractiveGame() {
        const container = document.getElementById('game-canvas-container');
        if (!container || typeof THREE === 'undefined') return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0f1c);

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 15, 15);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 20, 10);
        scene.add(dirLight);

        // Floor Grid
        const gridHelper = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
        scene.add(gridHelper);

        // Boundaries to prevent leaving the grid (-10 to 10 on X and Z)
        const BOUNDARY = 9.0;

        // Interactive Racks
        const racks = [];
        const shelfGeo = new THREE.BoxGeometry(2, 4, 6);
        const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 });
        
        function createRack(x, z, rotY = 0) {
            const rack = new THREE.Mesh(shelfGeo, shelfMaterial);
            rack.position.set(x, 2, z);
            rack.rotation.y = rotY;
            scene.add(rack);
            
            const width = rotY === 0 ? 2 : 6;
            const depth = rotY === 0 ? 6 : 2;
            racks.push({
                minX: x - width/2 - 1.2, // extra padding for forklift length
                maxX: x + width/2 + 1.2,
                minZ: z - depth/2 - 1.2,
                maxZ: z + depth/2 + 1.2
            });
        }

        createRack(-6, 0);
        createRack(6, 0);
        createRack(0, -7, Math.PI / 2);

        // Player LGV (Forklift)
        const lgv = createForkliftSimulation(0x0ea5e9); // blue body for user
        lgv.position.set(0, 0, 5);
        scene.add(lgv);

        // Pallet
        const palletGeo = new THREE.BoxGeometry(1.0, 0.2, 1.0);
        const palletMat = new THREE.MeshLambertMaterial({ color: 0x8b5cf6 });
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        pallet.position.set(0, 0.1, 0);
        scene.add(pallet);

        // Drop Zones
        const dropZoneMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.3 });
        const dropZoneGeo = new THREE.PlaneGeometry(2, 2);
        dropZoneGeo.rotateX(-Math.PI / 2);
        
        const dropZone1 = new THREE.Mesh(dropZoneGeo, dropZoneMat);
        dropZone1.position.set(-5, 0.01, -5);
        scene.add(dropZone1);

        const dropZone2 = new THREE.Mesh(dropZoneGeo, dropZoneMat);
        dropZone2.position.set(5, 0.01, -5);
        scene.add(dropZone2);

        // Game State
        let playerHasPallet = false;
        let lgvAngle = Math.PI; // Forward facing -Z initially
        const lgvSpeed = 0.15;
        const turnSpeed = 0.05;

        // Controls Map
        const keys = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        const statusLabel = document.getElementById('game-status');

        function updateStatus(msg, isError = false) {
            statusLabel.textContent = msg;
            statusLabel.style.color = isError ? '#ff5f56' : '#10b981';
            statusLabel.style.borderColor = isError ? '#ff5f56' : '#10b981';
        }

        function togglePallet() {
            if (playerHasPallet) {
                // Drop
                playerHasPallet = false;
                const offset = new THREE.Vector3(0, 0.2, -1.3);
                offset.applyQuaternion(lgv.quaternion);
                pallet.position.copy(lgv.position).add(offset);
                pallet.position.y = 0.1;
                updateStatus("Pallet dropped successfully.");
            } else {
                // Pick
                const offset = new THREE.Vector3(0, 0, -1.3);
                offset.applyQuaternion(lgv.quaternion);
                const forkTipPos = lgv.position.clone().add(offset);
                
                const dist = forkTipPos.distanceTo(new THREE.Vector3(pallet.position.x, forkTipPos.y, pallet.position.z));
                if (dist < 1.5) {
                    playerHasPallet = true;
                    updateStatus("Pallet picked up.");
                } else {
                    updateStatus("Too far from pallet to pick up!", true);
                }
            }
        }

        // UI Buttons
        const btnUp = document.getElementById('btn-up');
        const btnDown = document.getElementById('btn-down');
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnAction = document.getElementById('btn-action');

        function addBtnListeners(btn, key) {
            btn.addEventListener('mousedown', () => keys[key] = true);
            btn.addEventListener('mouseup', () => keys[key] = false);
            btn.addEventListener('mouseleave', () => keys[key] = false);
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
        }

        addBtnListeners(btnUp, 'up');
        addBtnListeners(btnDown, 'down');
        addBtnListeners(btnLeft, 'left');
        addBtnListeners(btnRight, 'right');

        btnAction.addEventListener('click', togglePallet);

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
            if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
            if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
            if (e.key === ' ' || e.key === 'Enter') togglePallet();
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
            if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
            if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
        });

        const clock = new THREE.Clock();

        // Loop
        function animateGame() {
            requestAnimationFrame(animateGame);

            // Movement Logic
            let moved = false;
            if (keys.left) lgvAngle += turnSpeed;
            if (keys.right) lgvAngle -= turnSpeed;

            lgv.rotation.y = lgvAngle;

            const direction = new THREE.Vector3(Math.sin(lgvAngle), 0, Math.cos(lgvAngle));

            let nextX = lgv.position.x;
            let nextZ = lgv.position.z;

            if (keys.up) {
                nextX += direction.x * lgvSpeed;
                nextZ += direction.z * lgvSpeed;
                moved = true;
            }
            if (keys.down) {
                nextX -= direction.x * lgvSpeed * 0.5; // Backup slower
                nextZ -= direction.z * lgvSpeed * 0.5;
                moved = true;
            }

            // Rack Collision checks
            const clockTime = clock.getElapsedTime();
            let collision = false;
            for (const rack of racks) {
                if (nextX > rack.minX && nextX < rack.maxX && nextZ > rack.minZ && nextZ < rack.maxZ) {
                    collision = true;
                    if (!lgv.userData.crashTimer || clockTime - lgv.userData.crashTimer > 3) {
                        const messages = [
                            "Whoops! Racks don't yield!",
                            "OSHA wants to know your location.",
                            "That wasn't in the routing logic...",
                            "Looks like we need to debug your driving.",
                            "Did your LGV license expire?"
                        ];
                        updateStatus(messages[Math.floor(Math.random() * messages.length)], true);
                        lgv.userData.crashTimer = clockTime;
                    }
                    break;
                }
            }

            // Boundary checks
            if (nextX > BOUNDARY) nextX = BOUNDARY;
            if (nextX < -BOUNDARY) nextX = -BOUNDARY;
            if (nextZ > BOUNDARY) nextZ = BOUNDARY;
            if (nextZ < -BOUNDARY) nextZ = -BOUNDARY;

            if (!collision) {
                lgv.position.set(nextX, lgv.position.y, nextZ);
                if (moved && (statusLabel.textContent.includes("Too far") || statusLabel.textContent.includes("System Online"))) {
                    // Only clear the error if it wasn't a recent crash
                    if (!lgv.userData.crashTimer || clockTime - lgv.userData.crashTimer > 3) {
                        updateStatus("System Online. Awaiting commands.");
                    }
                }
            }

            if (playerHasPallet) {
                const offset = new THREE.Vector3(0, 0.2, -1.3);
                offset.applyQuaternion(lgv.quaternion);
                pallet.position.copy(lgv.position).add(offset);
            }

            renderer.render(scene, camera);
        }

        animateGame();

        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    }

    initInteractiveGame();

    // --- 7. GDPR Cookie Consent Logic ---
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptCookiesBtn = document.getElementById('accept-cookies');

    if (cookieBanner && acceptCookiesBtn) {
        // Check if user already accepted
        if (!localStorage.getItem('cookieConsent')) {
            // Slight delay to animate banner in
            setTimeout(() => {
                cookieBanner.classList.remove('hidden');
                cookieBanner.classList.add('show');
            }, 1000);
        }

        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'accepted');
            cookieBanner.classList.remove('show');
            setTimeout(() => {
                cookieBanner.classList.add('hidden');
            }, 500); // Wait for transition before hiding completely
        });
    }
});
