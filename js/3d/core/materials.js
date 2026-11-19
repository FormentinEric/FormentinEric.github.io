// Shared PBR materials (created once, reused by every model).
import * as THREE from 'three';
import { hazardTexture, woodTexture, cartonTexture, wireMeshTexture, corrugationTexture } from './textures.js';

let cache = null;

export function materials() {
    if (cache) return cache;

    const paint = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
        color, roughness: 0.32, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.18, ...extra,
    });
    const emissive = (color, intensity = 4) => new THREE.MeshStandardMaterial({
        color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4,
    });

    const cartons = [
        new THREE.MeshStandardMaterial({ map: cartonTexture(3, '#b9895a'), roughness: 0.85 }),
        new THREE.MeshStandardMaterial({ map: cartonTexture(7, '#c49564'), roughness: 0.85 }),
        new THREE.MeshStandardMaterial({ map: cartonTexture(13, '#ad7f52'), roughness: 0.85 }),
    ];

    cache = {
        // vehicle / machine paint
        lgvYellow: paint(0xf2b20f),
        robotWhite: paint(0xd6d3cb, { roughness: 0.42, clearcoat: 0.45 }),
        cabinetGrey: paint(0xb9bec6, { clearcoat: 0.2, roughness: 0.5 }),
        fenceYellow: paint(0xf2b20f, { clearcoat: 0.1, roughness: 0.55 }),
        rackBlue: paint(0x1f5fbf, { clearcoat: 0.2, roughness: 0.45 }),
        rackOrange: paint(0xf26b1d, { clearcoat: 0.2, roughness: 0.45 }),

        // metals
        chassis: new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.55, metalness: 0.55 }),
        steelDark: new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.42, metalness: 0.75 }),
        steelWorn: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.65 }),
        aluminium: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.32, metalness: 0.9 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.06, metalness: 1.0 }),
        motor: new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.38, metalness: 0.6 }),

        // others
        rubber: new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.92 }),
        plasticBlack: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.45 }),
        glassDark: new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
        hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(6), roughness: 0.6 }),
        hazardShort: new THREE.MeshStandardMaterial({ map: hazardTexture(2), roughness: 0.6 }),
        estopRed: new THREE.MeshPhysicalMaterial({ color: 0xd01818, roughness: 0.3, clearcoat: 0.8 }),
        wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 }),
        cartons,
        stretchWrap: new THREE.MeshPhysicalMaterial({
            color: 0xdfe8f0, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.28,
            clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false, side: THREE.DoubleSide,
        }),
        fenceMesh: new THREE.MeshStandardMaterial({
            map: wireMeshTexture(1, 2), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6,
        }),
        hose: new THREE.MeshStandardMaterial({
            color: 0x14161a, roughness: 0.55, bumpMap: corrugationTexture(70), bumpScale: 2.5,
        }),

        // lights / LEDs (bloom)
        ledCyan: emissive(0x22d3ee, 5),
        ledGreen: emissive(0x22ee77, 4),
        ledRed: emissive(0xff2a2a, 5),
        ledAmber: emissive(0xffa31a, 5),
        ledBlue: emissive(0x3b82f6, 6),
        lampOff: new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.3 }),
        beaconDome: new THREE.MeshPhysicalMaterial({
            color: 0xff8a00, emissive: 0xff7a00, emissiveIntensity: 1.5, roughness: 0.15,
            transparent: true, opacity: 0.75, clearcoat: 1,
        }),
    };
    return cache;
}
