// Note: the `js` class on <html> (enables scroll-reveal styles) is set early by js-enabled.js in <head>.

document.addEventListener('DOMContentLoaded', () => {

    const ICONS = 'assets/icons.svg';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Runs `start` when the element enters the viewport and `stop` when it leaves.
    function whenVisible(element, start, stop) {
        const io = new IntersectionObserver((entries) => {
            // The last entry is the most recent state if several were batched.
            entries[entries.length - 1].isIntersecting ? start() : stop();
        }, { rootMargin: '100px 0px' });
        io.observe(element);
    }

    // Each 3D block is independent: if WebGL is unavailable, the rest of the page keeps working.
    function safeInit(name, init) {
        try {
            init();
        } catch (err) {
            console.warn(`${name} disabled:`, err && err.message ? err.message : err);
        }
    }

    // --- 1. Navbar Scroll Effect & Mobile Menu ---
    const navbar = document.querySelector('.navbar');
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    const allNavLinks = document.querySelectorAll('.nav-link, #nav-contact');
    const toggleIcon = mobileToggle.querySelector('use');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });

    function setMenu(open) {
        navLinks.classList.toggle('active', open);
        mobileToggle.setAttribute('aria-expanded', String(open));
        toggleIcon.setAttribute('href', `${ICONS}#${open ? 'xmark' : 'bars'}`);
    }

    mobileToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('active')));
    allNavLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('active')) {
            setMenu(false);
            mobileToggle.focus();
        }
    });

    // --- 2. Scroll Animation (Intersection Observer) ---
    // threshold 0 so that very tall sections (e.g. Projects on phones) are always revealed.
    const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    document.querySelectorAll('.section').forEach(section => revealObserver.observe(section));

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
            subtitleElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typingDelay = 50;
        } else {
            subtitleElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typingDelay = 100;
        }

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

    if (subtitleElement && !prefersReducedMotion) {
        setTimeout(() => {
            subtitleElement.textContent = "";
            typeEffect();
        }, 1000);
    }

    // --- 4. 3D Background Animation (Three.js) ---
    function init3DBackground() {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas || typeof THREE === 'undefined') return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const coreGroup = new THREE.Group();
        scene.add(coreGroup);

        // 1. Icosahedron (Tech Core)
        const coreGeometry = new THREE.IcosahedronGeometry(2, 1);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.15
        });
        coreGroup.add(new THREE.Mesh(coreGeometry, wireframeMaterial));

        const pointsMaterial = new THREE.PointsMaterial({
            size: 0.08, color: 0x06b6d4, transparent: true, opacity: 0.8, sizeAttenuation: true
        });
        coreGroup.add(new THREE.Points(coreGeometry, pointsMaterial));

        // 2. Outer Orbit Rings
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6, transparent: true, opacity: 0.15, wireframe: true
        });
        const ringMesh1 = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.01, 16, 100), ringMaterial);
        ringMesh1.rotation.x = Math.PI / 2;
        coreGroup.add(ringMesh1);

        const ringMesh2 = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.01, 16, 100), ringMaterial);
        ringMesh2.rotation.y = Math.PI / 2;
        coreGroup.add(ringMesh2);

        // 3. Floating Data Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 400;
        const posArray = new Float32Array(particlesCount * 3);
        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 25;
        }
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMesh = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({
            size: 0.03, color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending
        }));
        scene.add(particlesMesh);

        function updateLayout() {
            if (window.innerWidth > 900) {
                coreGroup.position.set(3.5, 0, 0);
                camera.position.z = 8;
            } else {
                coreGroup.position.set(0, 2.5, 0);
                camera.position.z = 10;
            }
        }
        updateLayout();

        // Mouse interaction
        let mouseX = 0;
        let mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - window.innerWidth / 2) * 0.001;
            mouseY = (event.clientY - window.innerHeight / 2) * 0.001;
        }, { passive: true });

        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            coreGroup.rotation.y += 0.002;
            coreGroup.rotation.x += 0.001;
            ringMesh1.rotation.z -= 0.003;
            ringMesh2.rotation.z += 0.002;
            particlesMesh.rotation.y = elapsedTime * 0.015;

            coreGroup.rotation.y += 0.05 * (mouseX * 1.5 - coreGroup.rotation.y);
            coreGroup.rotation.x += 0.05 * (mouseY * 1.5 - coreGroup.rotation.x);

            renderer.render(scene, camera);
        }

        // Reduced motion: draw a single static frame instead of a continuous animation.
        if (prefersReducedMotion) {
            renderer.render(scene, camera);
        } else {
            animate();
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateLayout();
            if (prefersReducedMotion) renderer.render(scene, camera);
        });
    }

    safeInit('3D background', init3DBackground);

    // --- Shared Functions ---
    // forksSide: +1 = mast and forks on +Z (warehouse demo), -1 = on -Z (simulator).
    function createForklift(bodyColor, forksSide = 1) {
        const forklift = new THREE.Group();
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const forkMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.6), bodyMat);
        bodyMesh.position.set(0, 0.4, 0.2);
        forklift.add(bodyMesh);

        const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), baseMat);
        roofMesh.position.set(0, 1.4, 0.3);
        forklift.add(roofMesh);

        const pillarGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        [[-0.45, -0.15], [0.45, -0.15], [-0.45, 0.75], [0.45, 0.75]].forEach(([x, z]) => {
            const p = new THREE.Mesh(pillarGeo, baseMat);
            p.position.set(x, 1.1, z);
            forklift.add(p);
        });

        const mastMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.2), baseMat);
        mastMesh.position.set(0, 0.9, forksSide > 0 ? 1.1 : -0.7);
        forklift.add(mastMesh);

        const forkGeo = new THREE.BoxGeometry(0.15, 0.05, 1.2);
        const fork1 = new THREE.Mesh(forkGeo, forkMat);
        fork1.position.set(-0.35, 0.05, 1.3 * forksSide);
        forklift.add(fork1);
        const fork2 = new THREE.Mesh(forkGeo, forkMat);
        fork2.position.set(0.35, 0.05, 1.3 * forksSide);
        forklift.add(fork2);

        const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
        light.position.set(0, 1.55, 0.3);
        forklift.add(light);

        return forklift;
    }

    // --- 5. 3D Warehouse & Code Typing Animation ---
    function initWarehouseDemo() {
        const container = document.getElementById('warehouse-canvas-container');
        if (!container || typeof THREE === 'undefined') return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(12, 10, 12);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

        const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 });
        const shelfGeo = new THREE.BoxGeometry(1.5, 4, 6);
        const shelf1 = new THREE.Mesh(shelfGeo, shelfMaterial);
        shelf1.position.set(-4, 2, 0);
        scene.add(shelf1);
        const shelf2 = new THREE.Mesh(shelfGeo, shelfMaterial);
        shelf2.position.set(4, 2, 0);
        scene.add(shelf2);

        const lgv = createForklift(0xf59e0b);
        scene.add(lgv);

        const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.0), new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }));
        scene.add(pallet);

        // State Machine for LGV
        const states = [
            { target: new THREE.Vector3(0, 0, 6), action: 'idle' },
            { target: new THREE.Vector3(-0.5, 0, 6), action: 'move' },
            { target: new THREE.Vector3(-0.5, 0, 0), action: 'move' },
            { target: new THREE.Vector3(-1.5, 0, 0), action: 'turn' },
            { target: new THREE.Vector3(-1.5, 0, 0), action: 'move' },
            { target: new THREE.Vector3(0.5, 0, 0), action: 'pickup' },
            { target: new THREE.Vector3(-0.5, 0, 0), action: 'move_back' },
            { target: new THREE.Vector3(-0.5, 0, 6), action: 'move' },
            { target: new THREE.Vector3(0.5, 0, 6), action: 'move' },
            { target: new THREE.Vector3(0.5, 0, 0), action: 'move' },
            { target: new THREE.Vector3(5, 0, 0), action: 'turn' },
            { target: new THREE.Vector3(1.5, 0, 0), action: 'move' },
            { target: new THREE.Vector3(1.5, 0, 0), action: 'drop' },
            { target: new THREE.Vector3(0.5, 0, 0), action: 'move_back' },
            { target: new THREE.Vector3(0.5, 0, 6), action: 'move' },
            { target: new THREE.Vector3(0, 0, 6), action: 'move' }
        ];

        let currentStateIndex = 0;
        let hasPallet = false;
        lgv.position.set(0, 0, 6);
        pallet.position.set(-2.8, 0.1, 0);

        const clock = new THREE.Clock();
        const speed = 2.5;
        let running = false;

        function nextState() {
            lgv.userData.timer = 0;
            currentStateIndex = (currentStateIndex + 1) % states.length;
        }

        function waitFor(seconds, delta) {
            lgv.userData.timer = (lgv.userData.timer || 0) + delta;
            return lgv.userData.timer > seconds;
        }

        function animate3D() {
            if (!running) return;
            requestAnimationFrame(animate3D);
            const delta = Math.min(clock.getDelta(), 0.05);
            const state = states[currentStateIndex];

            if (state.action === 'move' || state.action === 'move_back') {
                const direction = new THREE.Vector3().subVectors(state.target, lgv.position);
                if (direction.length() > 0.05) {
                    direction.normalize();
                    lgv.position.add(direction.clone().multiplyScalar(speed * delta));
                    if (state.action === 'move') {
                        const currentQuat = lgv.quaternion.clone();
                        lgv.lookAt(lgv.position.clone().add(direction));
                        const targetQuat = lgv.quaternion.clone();
                        lgv.quaternion.copy(currentQuat);
                        lgv.quaternion.slerp(targetQuat, Math.min(12 * delta, 1));
                    }
                } else {
                    lgv.position.copy(state.target);
                    nextState();
                }
            } else if (state.action === 'turn') {
                const currentQuat = lgv.quaternion.clone();
                lgv.lookAt(state.target);
                const targetQuat = lgv.quaternion.clone();
                lgv.quaternion.copy(currentQuat);
                lgv.quaternion.slerp(targetQuat, Math.min(8 * delta, 1));
                if (waitFor(0.6, delta)) {
                    lgv.lookAt(state.target);
                    nextState();
                }
            } else if (state.action === 'pickup') {
                if (waitFor(0.8, delta)) {
                    hasPallet = true;
                    nextState();
                }
            } else if (state.action === 'drop') {
                if (waitFor(0.8, delta)) {
                    hasPallet = false;
                    pallet.position.set(2.8, 0.1, 0);
                    nextState();
                }
            } else if (waitFor(1.0, delta)) { // idle
                pallet.position.set(-2.8, 0.1, 0);
                nextState();
            }

            if (hasPallet) {
                const offset = new THREE.Vector3(0, 0.2, 1.4).applyQuaternion(lgv.quaternion);
                pallet.position.copy(lgv.position).add(offset);
            }

            renderer.render(scene, camera);
        }

        // Render only while the section is on screen (saves GPU and battery).
        // Reduced motion: keep the static first frame, no autoplay.
        renderer.render(scene, camera);
        if (!prefersReducedMotion) {
            whenVisible(container,
                () => { if (!running) { running = true; clock.getDelta(); animate3D(); } },
                () => { running = false; });
        }

        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
                renderer.render(scene, camera);
            }
        });
    }

    // --- 5b. Code typing next to the warehouse demo (independent from WebGL) ---
    function initCodeTyping() {
        const codeElement = document.getElementById('code-typing-area');
        const container = document.querySelector('.pc-mockup');
        if (!codeElement || !container) return;
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

        // Static, trusted markup only (no user input reaches innerHTML).
        if (prefersReducedMotion) {
            codeElement.innerHTML = codeLines.join('<br>');
            return;
        }

        let lineIndex = 0;
        let visible = false;
        let timer = null;
        const pcBody = container.querySelector('.pc-body');

        function schedule(fn, ms) {
            timer = setTimeout(() => { timer = null; if (visible) fn(); }, ms);
        }

        function typeCode() {
            if (lineIndex < codeLines.length) {
                codeElement.innerHTML += codeLines[lineIndex] + "<br>";
                lineIndex++;
                if (pcBody) pcBody.scrollTop = pcBody.scrollHeight;
                schedule(typeCode, 300 + Math.random() * 500);
            } else {
                schedule(() => {
                    codeElement.innerHTML = "";
                    lineIndex = 0;
                    typeCode();
                }, 8000);
            }
        }

        // Types only while visible; pauses off-screen and resumes where it stopped.
        whenVisible(container,
            () => { visible = true; if (!timer) schedule(typeCode, 500); },
            () => { visible = false; });
    }

    safeInit('Warehouse demo', initWarehouseDemo);
    initCodeTyping();

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

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 20, 10);
        scene.add(dirLight);

        scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

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
                minX: x - width / 2 - 1.2, // extra padding for forklift length
                maxX: x + width / 2 + 1.2,
                minZ: z - depth / 2 - 1.2,
                maxZ: z + depth / 2 + 1.2
            });
        }

        createRack(-6, 0);
        createRack(6, 0);
        createRack(0, -7, Math.PI / 2);

        const lgv = createForklift(0x0ea5e9, -1);
        lgv.position.set(0, 0, 5);
        scene.add(lgv);

        const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.0), new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }));
        pallet.position.set(0, 0.1, 0);
        scene.add(pallet);

        // Drop Zones
        const dropZoneMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.3 });
        const dropZoneGeo = new THREE.PlaneGeometry(2, 2);
        dropZoneGeo.rotateX(-Math.PI / 2);
        [[-5, -5], [5, -5]].forEach(([x, z]) => {
            const zone = new THREE.Mesh(dropZoneGeo, dropZoneMat);
            zone.position.set(x, 0.01, z);
            scene.add(zone);
        });

        // Game State — speeds are per second, so movement is the same at 60, 120 or 144 Hz.
        let playerHasPallet = false;
        let lgvAngle = Math.PI;
        const LGV_SPEED = 9;      // units per second
        const TURN_SPEED = 3;     // radians per second
        const MAX_DELTA = 0.05;   // seconds; avoids jumps after a pause

        const keys = { up: false, down: false, left: false, right: false };
        const statusLabel = document.getElementById('game-status');

        function updateStatus(msg, isError = false) {
            statusLabel.textContent = msg;
            statusLabel.classList.toggle('is-error', isError);
        }

        function togglePallet() {
            if (playerHasPallet) {
                playerHasPallet = false;
                const offset = new THREE.Vector3(0, 0.2, -1.3).applyQuaternion(lgv.quaternion);
                pallet.position.copy(lgv.position).add(offset);
                pallet.position.y = 0.1;
                updateStatus("Pallet dropped successfully.");
            } else {
                const offset = new THREE.Vector3(0, 0, -1.3).applyQuaternion(lgv.quaternion);
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

        // On-screen buttons (mouse + touch)
        function addBtnListeners(btn, key) {
            const press = (e) => { if (e.cancelable) e.preventDefault(); keys[key] = true; };
            const release = (e) => { if (e.cancelable) e.preventDefault(); keys[key] = false; };
            btn.addEventListener('mousedown', press);
            btn.addEventListener('mouseup', release);
            btn.addEventListener('mouseleave', release);
            btn.addEventListener('touchstart', press, { passive: false });
            btn.addEventListener('touchend', release, { passive: false });
            btn.addEventListener('touchcancel', release, { passive: false });
            // Keyboard: hold Enter/Space on a focused arrow button to drive.
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keys[key] = true; }
            });
            btn.addEventListener('keyup', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keys[key] = false; }
            });
            btn.addEventListener('blur', () => { keys[key] = false; });
        }
        addBtnListeners(document.getElementById('btn-up'), 'up');
        addBtnListeners(document.getElementById('btn-down'), 'down');
        addBtnListeners(document.getElementById('btn-left'), 'left');
        addBtnListeners(document.getElementById('btn-right'), 'right');
        document.getElementById('btn-action').addEventListener('click', togglePallet);

        // Keyboard: only while the simulator has focus, so the page keeps scrolling normally.
        const KEY_MAP = {
            arrowup: 'up', w: 'up',
            arrowdown: 'down', s: 'down',
            arrowleft: 'left', a: 'left',
            arrowright: 'right', d: 'right'
        };

        container.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (KEY_MAP[key]) {
                keys[KEY_MAP[key]] = true;
                e.preventDefault();
            } else if (key === ' ' || key === 'enter') {
                e.preventDefault();
                if (!e.repeat) togglePallet();
            }
        });
        container.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (KEY_MAP[key]) keys[KEY_MAP[key]] = false;
        });
        container.addEventListener('blur', () => {
            keys.up = keys.down = keys.left = keys.right = false;
        });

        const clock = new THREE.Clock();
        let running = false;
        const CRASH_MESSAGES = [
            "Whoops! Racks don't yield!",
            "OSHA wants to know your location.",
            "That wasn't in the routing logic...",
            "Looks like we need to debug your driving.",
            "Did your LGV license expire?"
        ];

        function animateGame() {
            if (!running) return;
            requestAnimationFrame(animateGame);
            const dt = Math.min(clock.getDelta(), MAX_DELTA);
            const now = clock.elapsedTime;

            if (keys.left) lgvAngle += TURN_SPEED * dt;
            if (keys.right) lgvAngle -= TURN_SPEED * dt;
            lgv.rotation.y = lgvAngle;

            const dirX = Math.sin(lgvAngle);
            const dirZ = Math.cos(lgvAngle);
            let nextX = lgv.position.x;
            let nextZ = lgv.position.z;
            let moved = false;

            if (keys.up) {
                nextX += dirX * LGV_SPEED * dt;
                nextZ += dirZ * LGV_SPEED * dt;
                moved = true;
            }
            if (keys.down) {
                nextX -= dirX * LGV_SPEED * 0.5 * dt; // Backup slower
                nextZ -= dirZ * LGV_SPEED * 0.5 * dt;
                moved = true;
            }

            let collision = false;
            for (const rack of racks) {
                if (nextX > rack.minX && nextX < rack.maxX && nextZ > rack.minZ && nextZ < rack.maxZ) {
                    collision = true;
                    if (!lgv.userData.crashTimer || now - lgv.userData.crashTimer > 3) {
                        updateStatus(CRASH_MESSAGES[Math.floor(Math.random() * CRASH_MESSAGES.length)], true);
                        lgv.userData.crashTimer = now;
                    }
                    break;
                }
            }

            nextX = Math.max(-BOUNDARY, Math.min(BOUNDARY, nextX));
            nextZ = Math.max(-BOUNDARY, Math.min(BOUNDARY, nextZ));

            if (!collision) {
                lgv.position.set(nextX, lgv.position.y, nextZ);
                const recentCrash = lgv.userData.crashTimer && now - lgv.userData.crashTimer <= 3;
                if (moved && !recentCrash && statusLabel.textContent.includes("Too far")) {
                    updateStatus("System Online. Awaiting commands.");
                }
            }

            if (playerHasPallet) {
                const offset = new THREE.Vector3(0, 0.2, -1.3).applyQuaternion(lgv.quaternion);
                pallet.position.copy(lgv.position).add(offset);
            }

            renderer.render(scene, camera);
        }

        renderer.render(scene, camera);
        whenVisible(container,
            () => { if (!running) { running = true; clock.getDelta(); animateGame(); } },
            () => { running = false; });

        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
                renderer.render(scene, camera);
            }
        });
    }

    safeInit('LGV simulator', initInteractiveGame);
});
