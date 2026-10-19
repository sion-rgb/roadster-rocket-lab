# Roadster / Rocket — build progress

## Intent and constraints
Playable unofficial Tesla Roadster Rocket Edition inspired concept, metric scale, Three.js + TypeScript + Vite + Rapier + GSAP. All flight performance fictional and visibly labelled. Publish source publicly to GitHub after browser QA; enable Pages if available.

## Design brief
Drive a sculpted electric roadster along a coastal test boulevard, launch vertically, bank over the water and return gently to a marked pad. The primary verb is steering a force-driven vehicle; secondary verbs are thrust, attitude control, camera orbit and landing assist. A 5–30 second loop is launch, steer toward the next pad, manage energy, descend. Energy drains in flight, recharges on the ground. Hard impacts give concrete feedback and a quick reset. Successful pad landings increment a session count. This is a sandbox with an optional three-pad trial, not a race or a validated aerospace model.

## Core loop contract
Player drives and flies to reach illuminated pads while energy and impact velocity create risk. A soft pad touchdown gives a landing count; a crash teaches the impact speed and offers immediate reset.

## Level plan
Starting coastal pad opens onto a broad north/south boulevard. Three pads run down the coast; city towers to the east create altitude decisions, ocean to the west creates a clear recovery boundary. Initial launch is safe in open air. Distant architecture provides parallax for the spectator camera. Manual landing needs brake, upright attitude and low vertical velocity; landing assist offers an accessible alternative.

## Ownership
Lead: physics, input, cameras, HUD, sound, integration, QA and GitHub.
Car worker: src/car.ts and model credits.
World worker: src/world.ts and environment notes.

## Current state
MVP and graphics pass complete. Detailed CC BY 4.0 model and offline mobile LOD integrated, original retained. Browser production QA: 17 checks pass, no JS/HTTP errors; Rapier physics: 12 checks pass. Five canvas states plus required artifact manifest pass. Independent review fixed flight brake, wheel suspension animation, pitch labels and camera roll transition; final graphics fixed z-fighting and reduced shadow cost. Public source pushed to https://github.com/sion-rgb/roadster-rocket-lab, visibility PUBLIC verified. Actions tests/build/deploy succeeded; https://sion-rgb.github.io/roadster-rocket-lab/ returned HTTP 200 and seven live browser checks passed without errors. Intended build and publication are complete. See final-evidence.md for measured limits; real phones and physical Gamepad remain explicitly unverified.
