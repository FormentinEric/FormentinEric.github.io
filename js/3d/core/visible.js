// Calls onEnter/onLeave as `element` enters/leaves the viewport (last entry wins when batched).
export function whenVisible(element, onEnter, onLeave, rootMargin = '100px 0px') {
    const io = new IntersectionObserver((entries) => {
        if (entries[entries.length - 1].isIntersecting) onEnter();
        else onLeave();
    }, { rootMargin });
    io.observe(element);
    return () => io.disconnect();
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
