// ============================================================
// SAINTALIA -- CHAR_DATA
// Author: Maridizzle
//
// Race, job, stat, appearance and personality data for both sides.
// Moved verbatim from saintalia-v2.html lines 1558 to 1637 (Phase 1).
// No content changed. All of this text is Maridizzle's.
//
// Stat bonuses are parsed out of the `bonus` string by applyBonuses() in
// character.js, which expects the exact shape "StatName +N" with a comma
// between multiple entries. Do not reformat those strings.
// ============================================================

const CHAR_DATA = {
  fantasy: {
    races: [
      { id:'centaur', name:'Centaur', icon:'🐴', lore:'Half-scholar, half-horse. You remember when the sky was a different color and the stars moved in patterns that made sense. Your hooves leave char marks now. They did not used to.', bonus:'Veilsight +1, Ferocity +1' },
      { id:'minotaur', name:'Minotaur', icon:'🐂', lore:'Keeper of a labyrinth that holds nothing anymore. You built your identity around guarding a secret and the secret rotted. What does a guardian become when there is nothing left to guard?', bonus:'Ferocity +2' },
      { id:'fallen-dragon', name:'Fallen Dragon', icon:'🐉', lore:'Your wings are ash. Your hands bleed where the scales pulled away. You walk like something that was once enormous and has been made small. The humiliation is the worst part.', bonus:'Shadow +1, Ferocity +1' },
      { id:'basilisk-touched', name:'Basilisk-Touched', icon:'🐍', lore:'You looked too long into a basilisk\'s eye and survived. Now you see too much. Every surface holds a reflection of something that was. Your left eye is permanently wrong.', bonus:'Veilsight +2' },
      { id:'cerberus-bonded', name:'Cerberus-Bonded', icon:'🐕', lore:'Three voices in one skull. They do not always agree. Two of them want to protect you. The third has different ideas. You have learned to let them argue and act anyway.', bonus:'Cunning +1, Anchor +1' },
      { id:'last-human', name:'Last Human', icon:'🧍', lore:'You should not still be human. Something in Saintalia is changing you and you can feel it at the edges. You are the most fragile thing in a world of monsters. That has made you dangerous.', bonus:'Resonance +1, Cunning +1' },
    ],
    jobs: [
      { id:'warlord', name:'Warlord', mirror:'Photographer', bonus:'Ferocity +2', ability:'Battle Cry', abilityDesc:'Once per session, double all damage dealt through the veil on your next action.' },
      { id:'hedge-witch', name:'Hedge Witch', mirror:'Therapist', bonus:'Resonance +2', ability:'Veil Read', abilityDesc:'Ask the narrator one yes or no question about what is coming. They must answer honestly.' },
      { id:'bonekeeper', name:'Bonekeeper', mirror:'Forensic Archivist', bonus:'Shadow +2', ability:'Dead Reckoning', abilityDesc:'Sense when something has crossed the veil recently and roughly from which direction.' },
      { id:'wayfinder', name:'Wayfinder', mirror:'Urban Explorer', bonus:'Cunning +2', ability:'Pathfind', abilityDesc:'Never become lost in Saintalia. Once per session, reveal a hidden passage or route.' },
      { id:'silvertongue', name:'Silvertongue', mirror:'Journalist', bonus:'Anchor +2', ability:'Compel', abilityDesc:'Convince one creature to pause before acting. It will not attack on its next turn.' },
      { id:'ruinwalker', name:'Ruinwalker', mirror:'Archaeologist', bonus:'Veilsight +2', ability:'Echo Read', abilityDesc:'See a memory of what happened in your current location. One vision per location.' },
    ],
    stats: ['Veilsight','Ferocity','Cunning','Anchor','Resonance','Shadow'],
    statDescs: {
      Veilsight: 'How clearly you perceive the breaking between worlds',
      Ferocity: 'Raw combat force and physical dominance',
      Cunning: 'Wit, deception, and survival instinct',
      Anchor: 'How grounded you remain in Saintalia\'s reality',
      Resonance: 'Your connection to ancient magic and creature-kin',
      Shadow: 'The darkness you carry and have learned to wield'
    },
    appearance: {
      Build: ['Massive and scarred','Lean and predatory','Broad and weathered','Slight and overlooked','Towering and imposing','Compact and coiled'],
      'Skin / Hide': ['Ash-grey scales','Deep brown fur','Pale skin, wrong somehow','Mottled green and black','Bone-white','Rust-red with gold undertones'],
      Eyes: ['Solid black, no whites','Amber with slit pupils','Milky and far-seeing','Two different colors','Glowing faintly gold','Deep red, always watching'],
      Hair: ['None — bone ridges instead','Thick black matted coils','Silver-white, always moving','Braided with teeth and wire','Burnt short at the temples','Long and dark, perpetually damp'],
      'Distinguishing Mark': ['A scar that reopens sometimes','Markings that shift at night','One hand that is not quite right','A shadow that moves independently','Something growing under the skin','Eyes that reflect wrong'],
    },
    personality: {
      'When threatened, you': ['Attack first and think later','Go very still and wait','Look for the exit','Make a joke that lands wrong','Calculate odds fast','Reach for something to protect'],
      'You trust': ['No one until they have bled beside you','Instinct over evidence','Old promises over new ones','Anyone who has suffered visibly','Your own judgment, always','Whatever the dark tells you'],
      'The veil thinning makes you feel': ['Vindicated — I always knew','Terrified but I hide it well','Curious despite myself','Responsible somehow','Furious at whoever allowed it','Pulled toward it like a wound'],
    }
  },
  reality: {
    races: [
      { id:'classically-trained', name:'Classically Trained', icon:'🎨', lore:'MFA, residencies, gallery shows. You learned the rules so thoroughly you forgot why they existed. Now something is painting itself into your work and it does not follow any rule you were taught.', bonus:'Craft +2' },
      { id:'self-taught', name:'Self-Taught', icon:'✏️', lore:'No one showed you how to do this. You figured it out alone in rooms that were too small and too cold. That self-reliance is the only thing keeping you functional right now.', bonus:'Intuition +1, Composure +1' },
      { id:'former-prodigy', name:'Former Prodigy', icon:'⭐', lore:'You were extraordinary at twelve. By thirty you were just good. The fall from genius to competent is its own kind of haunting, and you have been haunted for years. This is different. This is worse.', bonus:'Craft +1, Bleed +1' },
      { id:'late-bloomer', name:'Late Bloomer', icon:'🌱', lore:'You came to this late and that is the only reason you are still sane. You have no old habits to fall back on. You see the wrongness clearly.', bonus:'Perception +2' },
      { id:'commercial-artist', name:'Commercial Artist', icon:'📐', lore:'You make things for money and you are good at it and you have never pretended otherwise. The commission was supposed to be straightforward. Nothing about this is straightforward.', bonus:'Tether +1, Craft +1' },
      { id:'outsider-artist', name:'Outsider Artist', icon:'🌀', lore:'People have always said your work was strange. You have always known it was true. The difference between then and now is that the strangeness is no longer coming from inside you.', bonus:'Bleed +1, Perception +1' },
    ],
    jobs: [
      { id:'photographer', name:'Photographer', mirror:'Warlord', bonus:'Perception +2', ability:'Caught on Film', abilityDesc:'Once per session, your camera captures something invisible to the naked eye.' },
      { id:'therapist', name:'Therapist', mirror:'Hedge Witch', bonus:'Composure +2', ability:'Read the Room', abilityDesc:'Sense the emotional residue a creature or presence left in a space.' },
      { id:'forensic-archivist', name:'Forensic Archivist', mirror:'Bonekeeper', bonus:'Tether +2', ability:'Evidence', abilityDesc:'Identify what crossed over and approximately when, from physical traces alone.' },
      { id:'urban-explorer', name:'Urban Explorer', mirror:'Wayfinder', bonus:'Intuition +2', ability:'Known Territory', abilityDesc:'Find safe shelter instinctively in any environment, no matter how wrong it has become.' },
      { id:'journalist', name:'Journalist', mirror:'Silvertongue', bonus:'Craft +2', ability:'On Record', abilityDesc:'Written notes cannot be altered, erased, or corrupted by veil influence.' },
      { id:'archaeologist', name:'Archaeologist', mirror:'Ruinwalker', bonus:'Bleed +2', ability:'Dig', abilityDesc:'Uncover one hidden truth per session that the narrator did not plan to reveal.' },
    ],
    stats: ['Perception','Composure','Intuition','Craft','Bleed','Tether'],
    statDescs: {
      Perception: 'Noticing what should not be there',
      Composure: 'Holding yourself together when reality bends',
      Intuition: 'Trusting your gut over your eyes',
      Craft: 'Mastery of your art and what it can do now',
      Bleed: 'How much Saintalia has already gotten into you',
      Tether: 'How strongly you are still anchored to the real world'
    },
    appearance: {
      Build: ['Tall and angular','Compact and restless','Soft-edged and strong','Athletic and worn down','Slight with paint-stained hands','Heavy-shouldered, always hunched'],
      Hair: ['Short and practical','Long and perpetually escaping','Shaved close on one side','Silver before its time','Dark and paint-dusted','Pulled back so tight it hurts'],
      Eyes: ['Pale and too observant','Dark brown, always calculating','Green with a permanent tired quality','One eye slightly unfocused now','Grey and flat until something interests you','Bloodshot from too many late nights'],
      'Studio Marks': ['Turpentine smell that won\'t wash out','Calluses in the wrong places','A recurring paint color always under your nails','Hands that shake slightly after midnight','A chronic crick from looking up too long','Eyes that water near certain pigments'],
      'Something Wrong': ['You have been losing time','Your reflection is slightly delayed','You find brushstrokes you don\'t remember','You hear breathing when you work alone','The cold follows you into warm rooms','Your shadow does something different at 3am'],
    },
    personality: {
      'When you see something impossible, you': ['Document it immediately','Go very still and pretend you didn\'t','Try to find the rational explanation','Feel a horrible excitement','Call someone — anyone','Step toward it before you can stop yourself'],
      'You have told': ['No one. They would not believe me','One person who now worries about me','My therapist, who referred me elsewhere','A journal, at least','Everyone. No one took it seriously','Myself it isn\'t happening'],
      'Your art has always been': ['A way to process what I cannot say','Something I do for money and only money','The truest thing about me','Getting away from me lately','Stranger than I admit publicly','Guided by something I don\'t understand'],
    }
  }
};
