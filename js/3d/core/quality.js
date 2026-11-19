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

/** Downgrades to 'low' once, after `seconds` of continuous frames under `minFps`. */
export function createGovernor({ minFps = 40, seconds = 3, initial = 'medium' } = {}) {
    let current = initial;
    let slowTime = 0;
    return {
        sample(dt) {
            if (current === 'low') return null;
            slowTime = 1 / dt < minFps ? slowTime + dt : 0;
            if (slowTime >= seconds) {
                current = 'low';
                return 'low';
            }
            return null;
        },
        profile: () => current,
    };
}
