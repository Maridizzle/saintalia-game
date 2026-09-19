// ============================================================
// SAINTALIA -- THE DREAM, content
// Author: Maridizzle
//
// Beat 2-A, the scene before the 15 Questions. Both players sleep
// after The Sky Tears. The veil reaches through unconscious minds.
//
// The five objects are the same five from the Lockdown. Their names,
// aliases and IDs come from data/scenes/lockdown.js. This file holds
// what is new to The Dream: the wall symbols, the flash guardrails,
// the room descriptions, and the placement feedback text.
//
// OBJECT-TO-SYMBOL MAPPING
// Each symbol represents one object. The fantasy player sees the
// symbols on the wall and must describe them to the artist through
// notes. The artist matches each object to its symbol for a correct
// placement. The mapping:
//   key        -> jawbone circle
//   bottle     -> cross-section oval
//   compass    -> concentric rings with inward needle
//   clock      -> grid of blank circles
//   photograph -> crowd of negative-space silhouettes
//
// FLASH ORDER
// Flashes always fire in sequence (1, 2, 3, 4, 5) regardless of
// which object is placed. The Nth correct placement fires Flash N.
// ============================================================

const DREAM_ENERGY_DRAIN = 5;

// ---- SETTING DESCRIPTIONS ----

const DREAM_INTRO = [
  'Your eyes are heavy.',
  'The ground is warm.',
  'Something behind your eyelids is waiting.'
];

const DREAM_ROOM_ARTIST = 'A white room. Clinically, aggressively white. No shadows. The five objects are the only things with color or texture, sitting on the floor like exhibits. One wall is different -- not white but clear, the way deep water is clear, and behind it shapes move in patterns that almost repeat but never quite do. Your phone\'s flashlight is already on. You did not turn it on.';

const DREAM_ROOM_FANTASY = 'A tower made of something translucent, like bone or clouded glass, standing in an ocean that glows faintly from beneath. There is no land in any direction. The air smells like ozone and salt and something older than both. The hologram screen is embedded in the floor, facing up, showing five symbols as constellations on a dark field. The tower hums at a frequency you can feel in your teeth. You did not climb here. You have always been here. That is the worst part.';

// ---- WALL SYMBOLS ----
// What the fantasy player sees. Each one represents an object.

const DREAM_SYMBOLS = {
  key: {
    id: 'key',
    name: 'The Jawbone',
    desc: 'A jawbone curving into a circle, biting its own hinge. The teeth along it are not uniform -- some are human, some are animal, some are geometric shapes pretending to be teeth. Where the teeth meet, tiny lines branch outward like roots or veins.'
  },
  bottle: {
    id: 'bottle',
    name: 'The Empty Pour',
    desc: 'A long vertical oval with a narrow neck, like a bottle seen in cross-section. The interior is filled with fine horizontal lines, densely packed, that stop abruptly at the opening. Above the opening: nothing. Not blank wall, but a conspicuous nothing, a shape where a pour should be that has been carefully, precisely left out.'
  },
  compass: {
    id: 'compass',
    name: 'The Inward Needle',
    desc: 'Two concentric rings with a needle shape suspended between them, floating, aimed at neither ring but at a point between the viewer and the wall. It looks wrong from every angle because it is pointing at a direction that is not north, south, east, or west. It is pointing at in.'
  },
  clock: {
    id: 'clock',
    name: 'The Shifting Grid',
    desc: 'A grid of small circles, rows and columns, each one identical, each one blank. Too many to count quickly. The grid is slightly curved, as if pressed against the inside of a larger sphere. One circle near the center is fractionally larger than the rest. Then you look again and a different one is larger. Then again.'
  },
  photograph: {
    id: 'photograph',
    name: 'The Turned Crowd',
    desc: 'Shapes that suggest a crowd seen from behind at a distance. No faces, no features, just the posture of people who are all paying attention to something the viewer cannot see. The shapes are not drawn with lines but with negative space -- they are the gaps between the light on the wall, defined by what surrounds them rather than what they are.'
  }
};

// ---- PLACEMENT FEEDBACK ----

const DREAM_CORRECT_FEEDBACK = 'The object clicks into the wall like a puzzle piece finding its hole. The click is felt, not heard -- a vibration that runs up your arm and settles behind your sternum. The symbol flares bright enough to leave an afterimage, and the wall around it ripples outward in concentric rings, like the object was dropped into still water.';

const DREAM_WRONG_FEEDBACK = 'The object reaches the wall and passes through it, and for a fraction of a second you see your own hand inside the wall, inside the geometry, and it is wrong -- your fingers are too long, or too many, or bending in directions fingers do not bend. Then the wall pushes everything back out. The object clatters to the floor. Your vision blurs at the edges for a moment, and the white room is less white than it was before. Slightly. Barely.';

// ---- FLASH GUARDRAILS ----
// These fire in fixed order 1-5 regardless of which object is placed.
// The narrator expands from these; they are not the full text.

const DREAM_FLASHES = [
  {
    id: 1,
    name: 'The Seed',
    guardrail: 'A seed buried in darkness, germinating. Its shell is cracking from the inside. What pushes through is not a root or a shoot but a geometric pattern -- the seed of life, ancient, precise, each circle locking into the next with the inevitability of a heartbeat. The glow coming off it is not illumination. It is presence. Something is in the pattern, or the pattern is something, and it has just started the process of becoming real. The scale is unclear. It could be microscopic. It could be the size of a planet. Both feel equally true.'
  },
  {
    id: 2,
    name: 'The Flower',
    guardrail: 'The pattern opens like a wound opening, except what spills out is order. Perfect, relentless, geometric order. Circle interlocking with circle, the flower of life assembling itself with the patience of something that has never once been in a hurry. It is already vast. It is not finished. Both players realize they are not watching it from outside. They are somewhere inside it, standing on one of the overlaps, and the expansion is happening around them in every direction. The beauty of it is not comforting. It is the beauty of a machine that runs whether or not anyone is watching.'
  },
  {
    id: 3,
    name: 'The Tree',
    guardrail: 'Geometry becomes biology. The flat pattern curls, thickens, reaches. What was a circle is now a ring of bark. What was an overlap is now a knot where two branches fused and kept growing. The tree of life, built from the flower of life, built from the seed -- and now both players can see the whole sequence as one continuous process, not three stages but one long exhale from a point of light to a structure vast enough to hold universes in its branches. It has been growing this whole time. Before tonight. Before either of them. It was already old when the thing that is poisoning it first arrived.'
  },
  {
    id: 4,
    name: 'The Network',
    guardrail: 'The tree shatters. Not violently -- joyfully, the way a dandelion shatters in wind, each piece carrying the whole pattern in miniature. Every fragment finds another fragment and locks in. The geometry that was a tree is now a lattice, then a mesh, then something language does not have a word for because language was built for three dimensions and this has more. The network pulses with the rhythm of something circulating through it. Not blood. Not data. Something that is to data what data is to stone. Both players can feel every node as a place that exists, that has weather and gravity and things living in it that do not know they are part of a pattern.'
  },
  {
    id: 5,
    name: 'The Poisoning',
    guardrail: 'Something enters the network that was not part of the original pattern. Both players feel it before they see it -- a wrongness, a dropped stitch, a note slightly off-key in a chord that was perfect a moment ago. Then the shape: cloaked, faceless, moving through the lattice with the certainty of something that knows exactly where it is going. It touches a node and the node changes color. Still alive. Still connected. But sick now, in a way that will spread to every node it touches, which will spread to every node those touch. Not destruction. Infection. The figure moves slowly because it does not need to move fast. It has all the time that has ever existed. Both players understand that the tearing sky, the dying veil, the wrongness in both their worlds -- this is where it starts. This is where it has always started. And the figure has not noticed them yet.'
  }
];

// Slot order on the wall. The symbols shuffle per game, but the wall
// always has exactly five slots numbered 1-5.
const DREAM_SLOT_COUNT = 5;
