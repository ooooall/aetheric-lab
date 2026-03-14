# Aetheric Lab

Cinematic dark visiting card site built around two WebGL effects: particle text and interactive dot sphere.

## Run locally

Serve over HTTP (required for ES modules):

```bash
npx serve -s . -l 3333
```

Open **http://localhost:3333**

## Stack

- **Three.js** (r158) — particle text (Effect #1), dot sphere (Effect #2)
- **Tone.js** — all sound synthesized in real time (no audio files)
- **GSAP + ScrollTrigger** — tagline, manifesto word reveal, scroll
- **Lenis** — smooth scroll
- **simplex-noise** — chaos-state drift for particles
- Pure HTML/CSS/JS (no framework)

## Features

- **Hero:** ~15k particles (6k on mobile) assemble into “Aetheric Lab” with spring physics; cursor repels particles (melts/heals).
- **Sphere section:** Fibonacci-sphere dots with cursor “light wave” and hover pulse.
- **Custom cursor:** Dot + lagging ring; disabled on touch.
- **Scroll progress:** 1px teal line on left.
- **SVG noise overlay** for matte feel.
- **Mobile:** Reduced counts, tap hero to scatter/reassemble.
- **Sound:** Unlocks on first tap/click ("tap to enter"). Ambient drone, assembly sweep, particle repel/snap, sphere singing bowl + dot pings, scroll whoosh, CTA hover/click. Mute: button bottom-right or **M** key.

## Colors

- Background: `#060606`
- Accent: `#5fffd4` / `#4de8c2`
- Text: `#e8e8e8`
