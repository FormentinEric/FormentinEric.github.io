// Calls onEnter/onLeave as `element` enters/leaves the viewport (last entry wins when batched).
// threshold > 0: "entered" only once that share of the element is visible.
export function whenVisible(element, onEnter, onLeave, rootMargin = '100px 0px', threshold = 0) {
    const io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (e.isIntersecting && e.intersectionRatio >= threshold) onEnter();
        else onLeave();
    }, { rootMargin, threshold: threshold > 0 ? [0, threshold] : 0 });
    io.observe(element);
    return () => io.disconnect();
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
