/*
 * Projects section: stats strip + type filters.
 * Reads everything from the static HTML (data-* attributes on .project-card),
 * so content stays visible and indexable even without JavaScript.
 */
(function () {
    'use strict';

    /**
     * @param {HTMLElement[]} cards
     * @returns {{lgv:number, cranes:number, robots:number, plants:number, countries:number}}
     */
    function computeStats(cards) {
        const sum = (key) => cards.reduce((total, card) => total + (parseInt(card.dataset[key], 10) || 0), 0);
        return {
            lgv: sum('lgv'),
            cranes: sum('cranes'),
            robots: sum('robots'),
            plants: cards.length,
            countries: new Set(cards.map((card) => card.dataset.country).filter(Boolean)).size,
        };
    }

    /** @param {HTMLElement|null} root */
    function initProjects(root) {
        if (!root) return;

        const cards = Array.from(root.querySelectorAll('.project-card'));
        const stats = computeStats(cards);
        root.querySelectorAll('[data-stat]').forEach((el) => {
            const value = stats[el.dataset.stat];
            if (value !== undefined) el.textContent = String(value);
        });

        const buttons = Array.from(root.querySelectorAll('.filter-btn'));
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
                cards.forEach((card) => {
                    card.hidden = filter !== 'all' && card.dataset.type !== filter;
                });
            });
        });
    }

    initProjects(document.getElementById('projects'));
})();
