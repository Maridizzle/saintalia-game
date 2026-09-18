// ============================================================
// SAINTALIA -- THE 15 QUESTIONS_POOL (Beat 2-B), content
// Author: Maridizzle
//
// Extracted verbatim from saintalia-15questions-v2.html by script, not
// retyped:
//   QUESTIONS_POOL      lines 384-430
//   QUESTIONS_NEUTRAL  lines 432-448
//   QUESTIONS_TANGENTS       lines 450-481
//
// Renamed to QUESTIONS_* so nothing collides. The content is untouched.
//
// TWO THINGS MARIDIZZLE STILL OWNS HERE, neither of which Claude will touch:
//
// 1. The ten tangent guardrails are written as Sasha's and Tyvian's specific
//    biographies (a custody arrangement, a shed creature, a named scroll).
//    The decision was that those two are TEMPLATES and character creation
//    stays, so these need genericizing into shapes that fit any character.
//    They are data, so rewriting them never touches code.
//
// 2. Trigger collisions, which are ambiguities in the vault itself rather
//    than bugs here. The vault claims Q4-B and Q7-B for BOTH Self as Threat
//    A and B, and Q6-B and Q8-B for BOTH Conditional Survival B and The
//    Connection Itself. This data picked one owner each, which leaves
//    Conditional Survival B reachable only from Q3-B and Self as Threat A
//    only from Q9-A. The vault also assigns Q7-A to nothing at all.
//
// The 10 turn cap is NOT a bug. It counts main questions only, never
// tangents, which stops the scene running forever and means a different 10
// of 15 every playthrough. See CLAUDE.md. Do not "fix" it.
// ============================================================

// ---- QUESTIONS_POOL ----
const QUESTIONS_POOL = [
  {id:'origin',label:'Origin',text:'What made your world the way it is now?',
    a:{seed:'A slow rot. Something that should have been stopped, but everyone pretended it wasn\'t happening.',tangent:'systemic_rot'},
    b:{seed:'Anger. Whatever broke their world, they take it personally. Their voice changes when they describe it.',tangent:'systemic_rot'}},
  {id:'power',label:'Power',text:'Who decides what matters in your world?',
    a:{seed:'People who don\'t live with the consequences of their decisions. Bitter specificity in how they describe the distance.',tangent:'systemic_rot'},
    b:{seed:'They don\'t know. The real power is invisible to them and that frightens them more than they want to say.',tangent:'systemic_rot'}},
  {id:'safety',label:'Safety',text:'What keeps you alive day to day?',
    a:{seed:'Things that could disappear tomorrow. Safety that is conditional and they\'ve always known it.',tangent:'conditional_a'},
    b:{seed:'They deflect with humor. The question hits something they won\'t examine directly.',tangent:'conditional_b'}},
  {id:'fear',label:'Fear',text:'What threatens your world most?',
    a:{seed:'Something already inside, growing. Described like a cancer that\'s been ignored too long.',tangent:'systemic_rot'},
    b:{seed:'Themselves. Their world\'s biggest threat is people like them making the wrong choices.',tangent:'self_threat_b'}},
  {id:'truth',label:'Truth',text:'How do you know what\'s real?',
    a:{seed:'They don\'t anymore. Something fundamental about truth has broken and they\'re lost without it.',tangent:'broken_ep_a'},
    b:{seed:'Pain. The only reliable indicator of reality is when something hurts enough to matter.',tangent:'broken_ep_b'}},
  {id:'belonging',label:'Belonging',text:'Where do you fit in your world?',
    a:{seed:'Nowhere they\'re supposed to be. Ended up outside their intended place and can\'t get back.',tangent:'conditional_a'},
    b:{seed:'They belong to the people who need them, even when those people can\'t reciprocate.',tangent:'connection'}},
  {id:'change',label:'Change',text:'What in your world refuses to stay the same?',
    a:{seed:'The things they need to stay stable. What should be permanent keeps shifting underfoot.',tangent:'conditional_a'},
    b:{seed:'They\'re the thing that won\'t stay the same and they don\'t know if that\'s good or destructive.',tangent:'self_threat_b'}},
  {id:'responsibility',label:'Responsibility',text:'What do you owe to others?',
    a:{seed:'More than they can give. A debt impossible to repay but that won\'t release them.',tangent:'conditional_a'},
    b:{seed:'To not become what hurt them. Their responsibility is breaking a cycle they\'re terrified of continuing.',tangent:'connection'}},
  {id:'guilt',label:'Guilt',text:'What have you failed to protect?',
    a:{seed:'Someone who trusted them completely. The betrayal wasn\'t malicious and that makes it worse.',tangent:'self_threat_a'},
    b:{seed:'They go quiet for too long, then change the subject. The failure is too total to name.',tangent:'grief_b'}},
  {id:'hope',label:'Hope',text:'What keeps you going when things get dark?',
    a:{seed:'Spite. Still here because giving up would let something win that doesn\'t deserve to.',tangent:'grief_a'},
    b:{seed:'They don\'t know anymore. Hope has become a habit rather than a feeling.',tangent:'grief_b'}},
  {id:'loss',label:'Loss',text:'What has your world already lost that you can\'t get back?',
    a:{seed:'Something systemic. A whole category of thing gone -- a species, a practice, a way of life.',tangent:'grief_a'},
    b:{seed:'Something personal. The systemic loss lands through one specific thing or person they can name.',tangent:'grief_b'}},
  {id:'veil',label:'The Veil',text:'Before the dream, did you have any concept of something like it existing?',
    a:{seed:'Yes, but it was myth or folklore. Their world had a name for something like it that was never taken seriously.',tangent:'broken_ep_a'},
    b:{seed:'They had a feeling. No cultural framework, just a persistent personal sense that the world had a seam somewhere.',tangent:'broken_ep_b'}},
  {id:'entity',label:'The Entity',text:'Have you encountered anything that felt like it before, in your world?',
    a:{seed:'Yes. Something specific in their world\'s history or their own experience maps onto what they saw.',tangent:'broken_ep_a'},
    b:{seed:'They don\'t answer directly. They deflect in a way that suggests yes but they won\'t say it.',tangent:'broken_ep_b'}},
  {id:'want',label:'What You Want',text:'If this ends, what does good look like to you?',
    a:{seed:'Something they can\'t have anymore. Good is already past tense for them.',tangent:'grief_a'},
    b:{seed:'Something for someone else. Good doesn\'t include themselves or they\'ve left themselves out entirely.',tangent:'grief_b'}},
  {id:'connection',label:'The Connection',text:'Do you think this was an accident?',
    a:{seed:'No, and they have a theory. They\'ve been thinking about why them specifically.',tangent:'connection'},
    b:{seed:'They hope it was. The alternative is too heavy to hold.',tangent:'connection'}}
];

const QUESTIONS_NEUTRAL = {
  origin:['They pause a long time before answering.','The question goes somewhere they\'ve been avoiding.'],
  power:['Power isn\'t something they think about directly.','They give the safe answer and then go quiet.'],
  safety:['They list things quickly, like they\'ve rehearsed this.','They laugh a little. It doesn\'t land well.'],
  fear:['Fear has a lot of addresses for them.','They name something small. It isn\'t the real answer.'],
  truth:['They used to know. They\'re less sure now.','They answer the question they wish had been asked instead.'],
  belonging:['Belonging is the word they flinch at.','They\'ve stopped asking that question of themselves.'],
  change:['Change happens to them more than they happen to it.','They describe it like weather. Impersonal. Uncontrollable.'],
  responsibility:['They recite this one. They\'ve thought about it too much.','They reframe the question without meaning to.'],
  guilt:['They take the out. They say: nothing comes to mind.','They answer about something small and true.'],
  hope:['They give an answer. It doesn\'t sound like hope.','They change the subject very smoothly.'],
  loss:['They describe something abstract. They keep it that way deliberately.','They start to answer and then don\'t.'],
  veil:['The concept doesn\'t have a word in their vocabulary. They find one.','They had a word but never said it out loud before now.'],
  entity:['They answer the question they thought was being asked instead.','They say no. Their voice does something on the no.'],
  want:['They describe something achievable. It isn\'t what they want.','They turn it into a question back.'],
  connection:['They don\'t answer right away. The silence is its own answer.','They say they haven\'t decided yet. It sounds true.']
};

const QUESTIONS_TANGENTS = {
  broken_ep_a:{name:'Broken Epistemology A',
    reality:'Ancient art folklore she investigated with genuine excitement. The trail dead-ended in a way that felt wrong, not just incomplete. Something tied to her work. A cosmically blocked thread she never finished pulling.',
    fantasy:'A scroll about the vast nature of the universe. Sought it out deliberately. Read it once. It sat in them. Now they are standing inside it.'},
  broken_ep_b:{name:'Broken Epistemology B',
    reality:'A location or surface mid-creation where the art felt like it was responding to her rather than the other way around. No language for it that didn\'t sound like a breakdown. Never told anyone.',
    fantasy:'Places in Saintalia avoided without explanation. Not dangerous by any known measure. Wrong in a frequency they could feel but not name. Stopped mentioning it because no one else seemed to feel it.'},
  conditional_a:{name:'Conditional Survival A',
    reality:'The commission as total financial load-bearing structure. One job, one building, one wall. Too much weight on a single contract. Knew it. Took it anyway. Now trapped inside the thing keeping her alive.',
    fantasy:'The terminal as sole infrastructure. Everything runs through technology never built for this purpose. No backup. No alternative. Knew it the whole time. Kept going anyway.'},
  conditional_b:{name:'Conditional Survival B',
    reality:'The colleague she was trying to reach when this started. Survival structured around being reliable for someone who doesn\'t know how much she holds. The wrong number was her trying to be that person one more time.',
    fantasy:'Self-appointed witness to the creatures of Saintalia. Not needed, not asked. The only thing that makes them feel like they belong in their own world. Responsibility entirely self-assigned.'},
  grief_a:{name:'Grief Topology A',
    reality:'A tradition of mural work with no remaining market. One of the last practitioners of something the world stopped needing before she finished learning it. The spite is quiet, professional, and has been running underneath everything for years.',
    fantasy:'A species that didn\'t die -- dissolved. Biology predicated on the veil boundary existing. Tyvian watched it happen over years with no framework for a creature dying of a metaphysical condition. The spite is directed at whatever allowed the failing.'},
  grief_b:{name:'Grief Topology B',
    reality:'A child lost to a custody arrangement she initiated because she knew she couldn\'t be what was needed. The child is alive, healthy, well raised. Sasha signed the papers knowingly. The knowing made it worse. Everything she has made since is for someone who will probably never see it.',
    fantasy:'A creature shed during a dangerous period because survival required it. It didn\'t die immediately. It died slowly looking for them. Tyvian went back later and followed the trail far enough to understand the ending. Has never decided if going back was courage or cruelty.'},
  self_threat_a:{name:'Self as Threat A',
    reality:'A collaborator burned through absence not malice. The collaborator was gracious. That\'s the part she can\'t put down. A clean betrayal would have been easier to carry.',
    fantasy:'A negotiation that went wrong traced directly to a decision they made in the room. They replay the moment of certainty more than the moment of consequence. That\'s where the real failure lives.'},
  self_threat_b:{name:'Self as Threat B',
    reality:'A period she doesn\'t date precisely. Choices she hasn\'t repeated but hasn\'t fully accounted for. Not crimes. Nothing with a clean name. The commission was partly about proving that period is over. She is not certain it is over.',
    fantasy:'A capability they have that they don\'t use because of what using it felt like the one time they did. Not the consequence -- the feeling during. The capability hasn\'t diminished. They check sometimes.'},
  systemic_rot:{name:'Systemic Rot',
    reality:'The corporate capture of what gets funded and called important. Watched it happen over her entire career. Takes commissions like this one because there is nothing else. The anger is old, specific, and has excellent aim.',
    fantasy:'The council structures of Saintalia. Governance built for a world that no longer exists. The veil showing symptoms longer than official record acknowledges. The rot was not malicious. It was institutional.'},
  connection:{name:'The Connection Itself',
    reality:'Has been the wrong number before -- figuratively. Built entire relationships out of being the one who picked up. No framework for being chosen by accident. This is the first time the accident feels like it might have been the point.',
    fantasy:'Two theories. First: the entity engineered this and they are already inside a trap. Second, worse: the veil reached through its own dying body to find the two most useless possible people, and this is what hope looks like when it\'s completely out of options.'}
};
