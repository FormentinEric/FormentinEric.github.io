// Rendering quality profiles and an fps governor that can only downgrade (pure logic, no DOM).

export const PROFILES = {
    high: { dpr: 2, shadow: 4096, ao: true, bloom: true, msaa: 4, fxaa: false },
    medium: { dpr: 1.5, shadow: 2048, ao: false, bloom: true, msaa: 4, fxaa: false },
    low: { dpr: 1, shadow: 1024, ao: false, bloom: false, msaa: 0, fxaa: true },
};

const DISCRETE_GPU = /nvidia|geforce|quadro|radeon rx|radeon pro|apple m\d (pro|max|ultra)/i;

/** @returns {'high'|'medium'|'low'} */
export function pickInitialProfile({ isMobile, gpu }) {
    if (isMobile) return 'low';
    if (gpu && DISCRETE_GPU.test(gpu)) return 'high';
    return 'medium';
}

/**
 * Downgrades to 'low' once, when the average frame rate over a window of `seconds` is under
 * `minFps` (an average, so stutter with the odd fast frame still counts as slow).
 */
export function createGovernor({ minFps = 40, seconds = 3, initial = 'medium' } = {}) {
    let current = initial;
    let time = 0, frames = 0;
    return {
        sample(dt) {
            if (current === 'low') return null;
            time += dt;
            frames++;
            if (time < seconds) return null;
            const slow = frames / time < minFps;
            time = 0;
            frames = 0;
            if (!slow) return null;
            current = 'low';
            return 'low';
        },
        profile: () => current,
    };
}
