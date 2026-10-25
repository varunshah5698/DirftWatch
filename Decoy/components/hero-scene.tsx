"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Hero 3D scene — "the agent swarm".
 *
 * Soft glowing round particles (a small shader draws each point as a radial
 * glow rather than a square), a constellation web that only links near
 * neighbours (short deliberate edges, never scratch-like diagonals), three
 * fitted orbit rings with traveling satellites, and a breathing core. All
 * motion stops under prefers-reduced-motion; the scene still renders once.
 */

const LIME = new THREE.Color("#c9f76f");
const ORANGE = new THREE.Color("#f2a35a");
const RED = new THREE.Color("#ff6a58");
const WHITE = new THREE.Color("#f4f4ee");
const DIM = new THREE.Color("#575c49");

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ShellPoint = { position: THREE.Vector3; color: THREE.Color; scale: number };

/** Fibonacci-sphere shell with jitter: even coverage, no clumps. */
function makeShell(count: number, seed: number): ShellPoint[] {
  const rand = seededRandom(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: ShellPoint[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const jitter = 0.84 + rand() * 0.34;
    const radius = 3.1 * jitter;
    const position = new THREE.Vector3(
      Math.cos(theta) * ring * radius,
      y * radius * 0.74,
      Math.sin(theta) * ring * radius,
    );
    const roll = rand();
    const color = roll > 0.965 ? RED : roll > 0.87 ? ORANGE : roll > 0.4 ? LIME : DIM;
    const hero = rand() > 0.94 ? 1.7 : 1;
    points.push({ position, color, scale: (0.05 + rand() * 0.14) * hero });
  }
  return points;
}

/* ------------------------------------------------------ glowing particles */
const PARTICLE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;
    vec3 p = position;
    // Gentle breathing along the radius so the shell feels alive.
    p += normalize(position) * sin(uTime * 0.45 + aPhase) * 0.07;
    p.y += sin(uTime * 0.3 + aPhase * 1.7) * 0.05;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float twinkle = 0.78 + 0.22 * sin(uTime * 1.4 + aPhase * 2.3);
    gl_PointSize = aScale * uPixelRatio * (260.0 / -mv.z) * twinkle;
    // Far side of the shell dims so the cloud reads as depth, not noise.
    vFade = smoothstep(-13.5, -5.5, mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.02, d);
    glow = pow(glow, 2.4);
    float core = smoothstep(0.14, 0.0, d);
    vec3 col = vColor + core * 0.75;
    gl_FragColor = vec4(col, (glow * 0.85 + core) * vFade);
  }
`;

function ParticleShell({ count = 620, reduced }: { count?: number; reduced: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const points = useMemo(() => makeShell(count, 20261024), [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const scales = new Float32Array(points.length);
    const phases = new Float32Array(points.length);
    const rand = seededRandom(9911);
    points.forEach((point, index) => {
      positions[index * 3] = point.position.x;
      positions[index * 3 + 1] = point.position.y;
      positions[index * 3 + 2] = point.position.z;
      colors[index * 3] = point.color.r;
      colors[index * 3 + 1] = point.color.g;
      colors[index * 3 + 2] = point.color.b;
      scales[index] = point.scale;
      phases[index] = rand() * Math.PI * 2;
    });
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [points]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: {
        value: typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 1.8),
      },
    }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = reduced ? 0 : clock.getElapsedTime();
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        args={[
          {
            uniforms,
            vertexShader: PARTICLE_VERT,
            fragmentShader: PARTICLE_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          },
        ]}
      />
    </points>
  );
}

/* ---------------------------------------------------- constellation web */
function ConstellationWeb({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const nodes = makeShell(200, 77123);
    // Only connect near neighbours within a short radius, strongest first.
    const pairs: { a: number; b: number; d: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].position.distanceTo(nodes[j].position);
        if (d < 1.15) pairs.push({ a: i, b: j, d });
      }
    }
    pairs.sort((x, y) => x.d - y.d);
    const chosen = pairs.slice(0, 420);

    const positions: number[] = [];
    const colors: number[] = [];
    for (const pair of chosen) {
      const a = nodes[pair.a];
      const b = nodes[pair.b];
      positions.push(
        a.position.x, a.position.y, a.position.z,
        b.position.x, b.position.y, b.position.z,
      );
      const hot =
        a.color.equals(ORANGE) || a.color.equals(RED) || b.color.equals(ORANGE) || b.color.equals(RED);
      const color = hot ? ORANGE : LIME;
      for (let k = 0; k < 2; k++) colors.push(color.r, color.g, color.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (!group.current || reduced) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.045;
    group.current.rotation.x = Math.sin(t * 0.09) * 0.05;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.17}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

/* ------------------------------------------------------------ orbit rings */
const RING_DEFS = [
  { radius: 3.0, tilt: [0.46, 0, -0.2] as const, color: LIME, speed: 0.22, arc: Math.PI * 2, dot: LIME },
  { radius: 2.42, tilt: [0.72, 0, 0.55] as const, color: ORANGE, speed: -0.3, arc: Math.PI * 1.45, dot: ORANGE },
  { radius: 3.45, tilt: [1.02, 0, 0.15] as const, color: WHITE, speed: 0.14, arc: Math.PI * 0.8, dot: WHITE },
];

function OrbitRings({ reduced }: { reduced: boolean }) {
  const satellite = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.getElapsedTime();
    if (satellite.current) {
      const angle = t * 0.34;
      satellite.current.position.set(Math.cos(angle) * 3.0, Math.sin(angle) * 3.0, 0);
    }
  });

  return (
    <group>
      {RING_DEFS.map((ring, index) => (
        <group key={index} rotation={new THREE.Euler(...ring.tilt)}>
          <mesh>
            <torusGeometry args={[ring.radius, 0.008, 6, 220, ring.arc]} />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={index === 2 ? 0.22 : 0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
      {/* One bright satellite gliding along the outer ring. */}
      <group rotation={new THREE.Euler(...RING_DEFS[0].tilt)}>
        <group ref={satellite}>
          <mesh>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={LIME} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshBasicMaterial
              color={LIME}
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- glow core */
function GlowCore({ reduced }: { reduced: boolean }) {
  const wire = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.getElapsedTime();
    if (wire.current) {
      wire.current.rotation.y = t * 0.16;
      wire.current.rotation.x = Math.sin(t * 0.24) * 0.3;
      wire.current.scale.setScalar(1 + Math.sin(t * 1.1) * 0.05);
    }
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(t * 1.1) * 0.09);
  });

  return (
    <group>
      <mesh ref={wire}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshBasicMaterial
          color={LIME}
          wireframe
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshBasicMaterial color={WHITE} transparent opacity={0.85} />
      </mesh>
      {/* Soft additive halo — a glow, not a solid disc. */}
      <mesh ref={halo}>
        <sphereGeometry args={[0.85, 24, 24]} />
        <meshBasicMaterial
          color={LIME}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ camera rig */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const goalX = reduced ? 0 : pointer.x * 0.8;
    const goalY = reduced ? 0 : pointer.y * 0.45;
    camera.position.x += (goalX - camera.position.x) * 0.045;
    camera.position.y += (goalY - camera.position.y) * 0.045;
    camera.lookAt(target.current);
  });

  return null;
}

/* ------------------------------------------------------------------ demo */
export function HeroScene({ className = "" }: { className?: string }) {
  const [reduced, setReduced] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  if (!mounted) {
    // Reserve the layout before hydration so the hero never jumps.
    return <div className={className} aria-hidden />;
  }

  return (
    <div className={className} aria-hidden role="presentation">
      <Canvas
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 8.8], fov: 44 }}
      >
        <CameraRig reduced={reduced} />
        <SlowGroup reduced={reduced}>
          <ParticleShell count={620} reduced={reduced} />
          <GlowCore reduced={reduced} />
        </SlowGroup>
        <ConstellationWeb reduced={reduced} />
        <OrbitRings reduced={reduced} />
      </Canvas>
    </div>
  );
}

/** Shared slow rotation for the shell + core so they move as one body. */
function SlowGroup({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || reduced) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.045;
    group.current.rotation.x = Math.sin(t * 0.09) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}