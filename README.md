# Fluid interactions

An agent skill for building web interfaces whose motion feels physical: gestures that carry the finger's speed and can be caught mid-flight, transitions that grow out of what you tapped and can be dragged back, and gestures that do different things depending on how they move.

It covers springs, velocity tracking, projection, rubber banding, direction lock, sheets, swipe back, swipe actions, pull to refresh, scrubbing, card-to-detail morphs, gestures with several modes like a home bar or fine scrubbing, and reduced motion. It also covers the pointer-event bugs that make gestures freeze on phones.

## Install

```sh
npx skills add rndrealm/fluid-interactions
```

Then ask your agent for the interaction, for example "make this card draggable and snap it to the nearest corner" or "add swipe back to this navigation stack".

## What's inside

```
skills/fluid-interactions/
├── SKILL.md            the rules, defaults and a checklist
├── code/               physics.ts, use-drag.ts, use-motion-preference.ts
└── references/         one file per pattern, loaded only when needed
```

Built on [motion](https://motion.dev). The skill tells your agent to use it, and to install it if the project doesn't have it yet.

## See it

Every pattern has a live demo, with a note on how to play with each one: [labs.rndrealm.com/fluid-interactions/demos](https://labs.rndrealm.com/fluid-interactions/demos)

## License

MIT
