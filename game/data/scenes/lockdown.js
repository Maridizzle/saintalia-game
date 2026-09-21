// ============================================================
// SAINTALIA -- THE LOCKDOWN, content
// Author: Maridizzle
//
// Extracted verbatim from saintalia-lockdown-2p-v2.html by script, not
// retyped, so it is provably identical to the sandbox:
//   LOCKDOWN_ROOMS          lines 627-673
//   LOCKDOWN_ROOM_POSITIONS lines 679-689
//   LOCKDOWN_OBJECTS        lines 693-699
//   LOCKDOWN_DECOR     lines 702-712
//   LOCKDOWN_FLASHES  lines 714-720
//
// Flash content swap (bottle/compass) fixed: bottle = The Neural Network
// (point 2), compass = The Book (point 3), matching the vault.
// ============================================================

// ---- ROOM MAP ----
const LOCKDOWN_ROOMS = {
  entrance: {
    id: 'entrance', name: 'Entrance Hall',
    desc: 'A long hall. The lights are on but shadows fall in directions that do not correspond to any light source. Two large pillars flank the center. The scaffolding from the mural project fills the far corner, draped in canvas that moves slightly despite no draft.',
    exits: { N: 'hallwayA', E: 'utilityRoom' }, object: 'clock',
  },
  hallwayA: {
    id: 'hallwayA', name: 'Hallway A',
    desc: 'A connecting corridor between the entrance and the main corridor. Plain walls. A fire extinguisher mounted at the wrong height. The floor here is slightly tacky underfoot for no reason you can identify.',
    exits: { S: 'entrance', N: 'corridor' }, object: null,
  },
  utilityRoom: {
    id: 'utilityRoom', name: 'Utility Room',
    desc: 'Exposed pipes. A drain in the center of the floor. Shelves of cleaning supplies and labeled boxes. The smell of something that is not cleaning fluid underneath the cleaning fluid smell. Nothing moves. Everything feels recently disturbed.',
    exits: { W: 'entrance' }, object: null,
  },
  corridor: {
    id: 'corridor', name: 'Main Corridor',
    desc: 'The corridor bends in a way the building exterior did not suggest was possible. A fire exit sign glows red at the far end. Between you and it: four support columns, a rolling cart of painting supplies left from the mural project, and a cold spot that does not move when you walk through it.',
    exits: { S: 'hallwayA', N: 'storageRoom' }, object: 'photograph',
  },
  storageRoom: {
    id: 'storageRoom', name: 'Storage Room',
    desc: 'Filing cabinets. Stacked chairs in rows. The detritus of a building that has been here a long time. A window high on the far wall shows a slice of night sky. The window has no latch mechanism visible from the floor. Something in the third filing cabinet rattles very slightly when you are not moving.',
    exits: { S: 'corridor', W: 'landing' }, object: 'key',
  },
  landing: {
    id: 'landing', name: 'Empty Landing',
    desc: 'A landing between floors. The stairwell is visible above and below. There is a bench here that no one has sat on in a long time. The wall paint on the north side is slightly newer than everywhere else, as if something was patched over. You do not know what.',
    exits: { E: 'storageRoom', N: 'stairwell' }, object: null,
  },
  stairwell: {
    id: 'stairwell', name: 'Stairwell',
    desc: 'Stairs going up, stairs going down. The descent looks normal. The ascent does not -- somewhere around the third landing the perspective behaves incorrectly, as if the stairs continue past the building itself. Your phone has two bars of signal here. The handrail is cold in a way that metal should not be at room temperature.',
    exits: { S: 'landing', W: 'breakRoom' }, object: 'compass',
  },
  breakRoom: {
    id: 'breakRoom', name: 'Break Room',
    desc: 'A table. Four chairs. A countertop with a sink and a coffee maker with a cracked carafe. The whiteboard on the wall has been wiped but not completely -- under the cleaning marks you can see the ghost of writing in a script you do not recognize. The fluorescent light above the sink flickers at irregular intervals.',
    exits: { E: 'stairwell', N: 'sideCorridor' }, object: null,
  },
  sideCorridor: {
    id: 'sideCorridor', name: 'Side Corridor',
    desc: 'A smaller corridor off the main building path. The ceiling is lower here. Three doors, all locked. One of them has light under it that is the wrong color -- not wrong like a colored bulb, wrong like the light is coming from somewhere that has never had electricity. The air here moves in a direction that is not toward any vent.',
    exits: { S: 'breakRoom' }, object: 'bottle',
  },
};

// ---- ROOM GRID POSITIONS ----
// Building layout reflected as X/Y % positions on the grid
// Vertical axis: top = north end of building, bottom = entrance
// Horizontal axis: left = west, right = east
const LOCKDOWN_ROOM_POSITIONS = {
  sideCorridor: { x: 30, y: 8  },
  breakRoom:    { x: 30, y: 22 },
  stairwell:    { x: 30, y: 36 },
  landing:      { x: 55, y: 36 },
  storageRoom:  { x: 75, y: 36 },
  corridor:     { x: 55, y: 52 },
  hallwayA:     { x: 55, y: 65 },
  utilityRoom:  { x: 78, y: 65 },
  entrance:     { x: 55, y: 80 },
};

// ---- OBJECT DATA ----
// gridX/gridY now match their room's position exactly
const LOCKDOWN_OBJECTS = {
  clock:      { id:'clock',      name:'a clock with no hands but too many faces',              shortName:'clock',      aliases:['clock','clocks','dial','dials'],                       hint:'south end, in the entrance itself',     flashName:'The Flythrough',    pointId:4, gridX: LOCKDOWN_ROOM_POSITIONS.entrance.x,     gridY: LOCKDOWN_ROOM_POSITIONS.entrance.y,     found:false },
  photograph: { id:'photograph', name:'a photograph where every subject has their back turned', shortName:'photograph', aliases:['photograph','photo','photos','picture','pictures','frame'], hint:'central corridor, north of the entrance', flashName:'The Harvest',        pointId:5, gridX: LOCKDOWN_ROOM_POSITIONS.corridor.x,     gridY: LOCKDOWN_ROOM_POSITIONS.corridor.y,     found:false },
  key:        { id:'key',        name:'a key made of teeth',                                    shortName:'key',        aliases:['key','keys'],                                          hint:'far northeast, near the storage area',  flashName:'Cellular Fusion',   pointId:1, gridX: LOCKDOWN_ROOM_POSITIONS.storageRoom.x,  gridY: LOCKDOWN_ROOM_POSITIONS.storageRoom.y,  found:false },
  compass:    { id:'compass',    name:'a compass whose needle points inward',                   shortName:'compass',    aliases:['compass','compasses'],                                 hint:'northwest, in the stairwell',           flashName:'The Book',           pointId:3, gridX: LOCKDOWN_ROOM_POSITIONS.stairwell.x,    gridY: LOCKDOWN_ROOM_POSITIONS.stairwell.y,    found:false },
  bottle:     { id:'bottle',     name:'a water bottle that pours nothing',                      shortName:'bottle',     aliases:['bottle','bottles','water bottle','water'],             hint:'far north, west wing',                  flashName:'The Neural Network', pointId:2, gridX: LOCKDOWN_ROOM_POSITIONS.sideCorridor.x, gridY: LOCKDOWN_ROOM_POSITIONS.sideCorridor.y, found:false },
};

// ---- DECOR (non-key items players might poke at) ----
const LOCKDOWN_DECOR = {
  entrance:     [ { name:'the pillars', aliases:['pillar','pillars','column','columns'] }, { name:'the scaffolding', aliases:['scaffolding','canvas','tarp','mural'] } ],
  hallwayA:     [ { name:'the fire extinguisher', aliases:['fire extinguisher','extinguisher'] }, { name:'the floor', aliases:['floor','tile','tiles','ground'] } ],
  utilityRoom:  [ { name:'the drain', aliases:['drain'] }, { name:'the shelves', aliases:['shelf','shelves','boxes','box','cleaning supplies','supplies'] }, { name:'the pipes', aliases:['pipe','pipes'] } ],
  corridor:     [ { name:'the fire exit sign', aliases:['fire exit sign','exit sign','sign'] }, { name:'the support columns', aliases:['column','columns','pillar','pillars'] }, { name:'the rolling cart', aliases:['cart','painting supplies','rolling cart'] }, { name:'the cold spot', aliases:['cold spot'] } ],
  storageRoom:  [ { name:'the filing cabinets', aliases:['filing cabinet','filing cabinets','cabinet','cabinets'] }, { name:'the stacked chairs', aliases:['chair','chairs'] }, { name:'the window', aliases:['window'] } ],
  landing:      [ { name:'the bench', aliases:['bench'] }, { name:'the patched wall', aliases:['wall','paint','patch'] } ],
  stairwell:    [ { name:'the handrail', aliases:['handrail','rail','railing'] }, { name:'the stairs', aliases:['stairs','staircase','steps'] } ],
  breakRoom:    [ { name:'the table', aliases:['table'] }, { name:'the chairs', aliases:['chair','chairs'] }, { name:'the coffee maker', aliases:['coffee maker','carafe','coffee'] }, { name:'the sink', aliases:['sink','faucet','countertop','counter'] }, { name:'the whiteboard', aliases:['whiteboard','board'] }, { name:'the fluorescent light', aliases:['light','lights','fluorescent'] } ],
  sideCorridor: [ { name:'the doors', aliases:['door','doors'] } ],
};

const LOCKDOWN_FLASHES = {
  'Cellular Fusion':    'The artist seizes. For three seconds they are inside the veil itself -- not above it or beside it but inside it. Cells the size of continents fusing and tearing. Physical, biological, happening in real time beneath this building. Membranes the width of mountain ranges press together and merge, and where they merge something new wakes up, briefly, and screams without a mouth, and is quiet again. The artist can feel the temperature of it. They can feel that it has weight, that it is happening on a scale that should not fit inside a single moment of human attention and yet does, completely, leaving no room for anything else. What is fusing to what is not yet clear. Whether it can be stopped is not yet clear. Whether it has happened before, and how many times, and what was here last time it finished -- none of this is given. What is clear: it is happening right now, underneath this exact floor, underneath these exact feet, and it has been happening the entire time the artist has been walking these halls looking for small wrong things in small wrong rooms.',
  'The Neural Network': 'The building dissolves. The artist is suspended in a network so vast the word vast does not apply, the way the word "wet" does not apply to an ocean from the inside. Universes as nodes -- not represented as nodes, not symbolized as nodes, but functioning as nodes, packets of reality passing between them along threads of something that is not light and is not thought but resembles both. The connections between them are alive -- not metaphorically alive, functionally alive, processing, communicating, routing something incomprehensible between infinite points, the way blood routes oxygen, the way nerves route pain. The artist is a mote of dust standing inside the mind of something that has never been small, has never once in its existence had an edge, and does not appear to have noticed them yet. They can feel the scale of it pressing against the inside of their skull like pressure at depth. Somewhere in that network, impossibly small and impossibly specific, is a thread that leads back to this building, to this hallway, to this exact configuration of walls.',
  'The Book':           'A book, open, writing itself at a speed the artist cannot follow. Pages filling with text in a script they do not recognize and cannot look away from -- the letters arrive faster than sight, faster than thought, and yet each one lands somewhere in the artist with the weight of something remembered rather than something new. This book exists. It is somewhere, physically, on a shelf or a table or held in hands that are not the artist\'s own. When they find it they will know it immediately, the way you know your own name spoken in a crowded room. What it records, who writes it, where it is: none of this is given. Only the certainty that it is real, that it has been writing the whole time, long before tonight, and that whatever is happening in this building tonight is already a sentence in it -- already past tense, somewhere, to whoever is reading. It is theirs to find. It has always been theirs to find.',
  'The Flythrough':     'The artist moves through Saintalia -- not walks, moves, pulled at a speed that compresses landscape into impression, the way a falling body compresses a fall into a single long second. Creatures. Real ones. A centaur with char marks where its hooves touch ground, each step leaving a small dying ember in dry grass. Something vast and winged and broken folding itself into a canyon, too large for the canyon, fitting anyway, the way a memory fits into a space too small for it. Eyes in the dark that track their passage without surprise, as if they have been expected, as if this flythrough happens on a schedule and they are simply the latest to take it. The wind has a temperature and a smell and neither belongs to this world. They must ask P2 to confirm what they are seeing, out loud, through the veil, because alone the artist cannot hold the certainty of it -- it slips, it wants to be a dream. P2 must say: yes, those are real, I am here with them, I see them too.',
  'The Harvest':        'The artist stands in a void that has no temperature and no sound, and that absence is itself a kind of pressure. Off their body, threads of light extend in every direction -- connection points, beautiful, fine as hair, each one humming faintly with something that feels like memory or relationship or love, hard to say which. Then the understanding arrives, not as a thought but as a fact already known: this is what is harvested. They are standing at a rupture point, a place where the membrane between here and there is thin enough that what is inside a person becomes visible from outside. Their connection points are exposed, drifting, gently luminous, utterly unguarded. The entity does not know about them yet -- this is stated with the same flat certainty as everything else here -- but the void is not entirely empty. Something at the edge has no shape but has attention, and the attention has begun, slowly, almost lazily, to turn.',
};
