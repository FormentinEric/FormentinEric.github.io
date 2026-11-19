// Note: the `js` class on <html> (enables scroll-reveal styles) is set early by js-enabled.js in <head>.

document.addEventListener('DOMContentLoaded', () => {

    const ICONS = 'assets/icons.svg';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // --- 4. 3D sections (Three.js r187 ES modules, loaded only when a section gets close) ---
    // One exclusive runner keeps at most one WebGL stage rendering at a time.
    const runnerReady = import('./js/3d/core/exclusive.js').then((m) => m.createExclusiveRunner());

    function lazy3d(element, mount) {
        if (!element) return;
        const io = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            io.disconnect();
            runnerReady
                .then((runner) => mount(runner))
                .catch((err) => console.warn('3D section disabled:', err && err.message ? err.message : err));
        }, { rootMargin: '0px 0px 200px 0px' });
        io.observe(element);
    }

    const twinEl = document.getElementById('twin');
    lazy3d(twinEl, (runner) =>
        import('./js/3d/twin/twin.js')
            .then((m) => m.mountTwin(twinEl, runner))
            .catch((err) => {
                // modules failed to load: still show a picture of the twin
                const view = twinEl.querySelector('.twin-view');
                if (view && !view.querySelector('img')) {
                    view.querySelector('canvas')?.remove();
                    for (const a of ['role', 'tabindex', 'aria-label', 'aria-describedby']) view.removeAttribute(a);
                    const img = document.createElement('img');
                    img.className = 'twin-fallback';
                    img.src = 'assets/twin-fallback.webp';
                    img.alt = 'Digital twin overview of an intralogistics plant with a robot cell, LGVs and an automated warehouse.';
                    view.append(img);
                    twinEl.classList.add('twin-static');
                }
                throw err;
            }));

    lazy3d(document.getElementById('game-canvas-container'), (runner) =>
        import('./js/3d/game.js').then((m) => m.mountGame(document.getElementById('game-canvas-container'), runner)));

    // --- 5. Hero point cloud (WebGL2, no three.js) ---
    // The cloud starts as scattered points and assembles while the visitor scrolls, so it starts at the first
    // interaction after the load event: creating a WebGL context costs the browser a noticeable moment
    // (GPU start-up), and nobody should wait for it before the page is usable. The module is fetched at idle.
    const heroModule = () => import('./js/hero.js');
    const HERO_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'];
    let heroStarted = false;
    const startHero = () => {
        if (heroStarted) return;
        heroStarted = true;
        for (const ev of HERO_EVENTS) window.removeEventListener(ev, startHero);
        Promise.all([heroModule(), runnerReady])
            .then(([m, runner]) => m.mountHero(document.getElementById('hero'), runner))
            .catch((err) => console.warn('Hero background disabled:', err && err.message ? err.message : err));
    };
    const armHero = () => {
        for (const ev of HERO_EVENTS) window.addEventListener(ev, startHero, { passive: true });
        (window.requestIdleCallback || setTimeout)(() => heroModule().catch(() => {}));
    };
    if (document.readyState === 'complete') armHero();
    else window.addEventListener('load', armHero, { once: true });
});
