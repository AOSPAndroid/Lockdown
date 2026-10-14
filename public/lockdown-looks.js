/** How everything in Lockdown looks: the one source for art. The 3D models, the menu icons and the
 * 2D sprites are all made from these descriptions (docs/CATALOG.md is generated from this file).
 *
 * House style for every item: small battle robots in the style of the LBX anime and model kits
 * (reference: docs/reference/lbx/), original designs only. Hard-surface armour plates over a dark inner
 * frame, crisp chamfered edges, panel lines, gold bolt caps, a clean painted-plastic finish, one main colour
 * per part with white and gold, glowing camera eyes. Clean silhouettes that read from a camera ~48° above;
 * light from the top-left. Team colour is never part of an item: where an item has a "team" trim, that trim
 * is made with a material named `team` and the game paints it Amber or Cyan. */

export const BODY_LOOK = 'The bare robot frame every knight is built on, before any armour: a "core skeleton" in the LBX style (see docs/reference/lbx/20-core-skeleton-drawing.jpg), 1.3 units tall, about five heads tall, original design, made in code by tools/make-core-skeleton.mjs. A dark gunmetal body: a blocky chest unit with a raised X pattern and a `team` stripe, a jointed waist block, round joint discs at the shoulders, elbows, hips and knees, pale blue-grey piston limbs (forearms and shins with visible cylinders and ribbing), blocky dark hands and wedge-shaped feet. The head is a smooth dark helmet-shaped unit with two narrow glowing yellow slit eyes. No skin, hair or face. It must look finished and cool on its own: the bare frame is a real look in the game. Every part is a rigid piece so the game can swing it.';

export const CLASS_LOOKS = Object.freeze({
  striker: 'No piece to model: the Striker is marked by a thin neon line in `team` colour that the game draws trailing behind the robot as it moves (longer and brighter while Boost is held).',
  guardian: 'A big shield on the left arm, worn over any armour: a large round battle shield about as tall as the robot\'s torso and hips (≈ 0.7 across), a coloured face with gold radial vanes and a gold rim, a pointed gold boss in the middle and a `team` band round the edge. The shield bubble and dome are drawn by the game.',
  recon: 'A tiny round shield on the left forearm (≈ 0.22 across): a compact armoured buckler with a glowing violet lens in the middle, the cloaking device. Give the lens an emissive material named with `lens`; the game makes it flare when the Recon cloaks and turns the robot translucent.',
});

export const HELMET_LOOKS = Object.freeze({
  none: 'Bare head: the core skeleton\'s own smooth dark head with two glowing yellow slit eyes (part of the body).',
  sallet: 'A rounded steel knight head with a narrow eye slit glowing white, a swept tail fin at the back and a `team` brow band.',
  visor: 'A sleek sniper head: a wraparound dark visor with one big glowing cyan targeting lens, a brass sensor ear and a short antenna.',
  horned: 'A heavy iron head with two big curved horns sweeping forward, a jutting jaw guard and red glowing eyes.',
  hood: 'A charcoal-violet cowl-shaped head with a deep shadowed face where two violet eyes glow, and rune panel lines on the rim.',
  lampcap: 'A miner head with a big brass headlamp on the brow (warm yellow glow), a soot-dark shell and a fuse coil wrapped round it.',
  feather: 'A light jaunty head with a green swept crest shaped like a feathered cap and a long red feather fin sweeping back.',
  bucket: 'A dented bucket-shaped head, two round eye holes glowing white and a hinged handle at the side: a scrapyard build.',
  circlet: 'A slim white head with a thin gold circlet round the brow and a small green gem in the middle.',
  goggles: 'A pilot head with round amber goggle lenses pushed up on the brow, a padded leather-look crown and a ticking cog at the temple.',
  cobalt: 'A deep-blue cobalt knight head, broad and heavy, with a T-shaped visor glowing white, silver bolts and a short blue crest.',
  wolver: 'A grey wolf head: snout-shaped visor with fangs over the eyes, tall pointed ears and a fur-textured mane plate.',
  demo: 'A blast-scarred black demolition head with an orange-glowing grille visor, soot streaks and a little smoking exhaust on top.',
  seraph: 'A white and gold head with a floating golden halo (soft warm glow) and two small white wing fins at the temples.',
});

export const ARMOR_LOOKS = Object.freeze({
  none: 'Unarmoured: the core skeleton\'s own X-patterned chest and joint discs (part of the body).',
  scout: 'Light tan armour: a slim chest plate with a brown strap, small rounded shoulder guards and a canister on the hip; quick and practical.',
  ballistic: 'Chunky grey-green padded plates over the chest and shoulders with a high armoured collar, like a bomb-disposal suit; bullet scuffs.',
  duelist: 'A fitted burgundy chest with diagonal steel bands, one large swept left pauldron and a high collar; elegant and sharp.',
  heavy: 'Thick steel plate: a domed chest, big rounded pauldrons and a skirt of plates; bolts everywhere.',
  gunslinger: 'A long brown armoured duster: chest plate with a bandolier of brass shells, a wide collar and coat-tail plates behind (on `hips`).',
  fencer: 'A white padded fencing chest buttoned on one side with a red heart emblem; a slim, light silhouette.',
  windrunner: 'Pale-turquoise aerodynamic plates with fin-shaped sashes trailing behind like ribbons, and wrapped forearm guards.',
  juggernaut: 'A huge riveted dark-iron siege chest: barrel front, enormous spiked shoulder plates and a grille on the chest; the robot looks twice as wide.',
  bombardier: 'A scorched brown blast apron over a soot-grey chest, a belt of fused bombs and a coil of fuse cable on the shoulder.',
  berserker: 'Dark iron bracers and a studded chest harness painted with red war stripes, a wolf-pelt mantle plate over the shoulders; a bone-white claw necklace.',
  mirrorweave: 'A mantle of mirror scales that catches the light (pearly blue-violet sheen) over a dark chest.',
  medic: 'A white medical chest with a red cross on the shoulder, a satchel module across the body and green glass vials at the belt.',
  clockwork: 'A brass gear harness over a dark chest: exposed turning gears, a winding key on the back and copper pipes on the shoulders.',
  cobalt: 'Deep-blue cobalt armour: a smooth blue chest with silver trim and a star emblem, rounded blue pauldrons and a short blue tabard plate.',
  vog: 'A shaggy orange-and-black fur-plated coat from a volcanic bear cub: ember-glowing tips, small horns on the shoulders and a fur hood plate down the back.',
});

export const PANTS_LOOKS = Object.freeze({
  none: 'Unarmoured: the core skeleton\'s own piston legs (part of the body).',
  greaves: 'Steel knee guards and shin plates over the frame.',
  leggings: 'Slim dark-blue runner legs with a light stripe down the side.',
  chausses: 'Grey chain-link leg armour (a clear ring pattern) to the ankle.',
  breeches: 'Cream fencing leg plates buckled below the knee with white shin guards.',
  sapper: 'Olive utility leg plates with knee pads and a fuse pouch on the thigh.',
  cargo: 'Khaki leg plates with big side pockets and a holster strap on the thigh.',
  kilt: 'A red-and-green tartan skirt of plates with a hip pouch.',
  cobalt: 'Deep-blue cobalt thigh plates with silver bolts and blue knee guards.',
  wolver: 'Grey fur-edged runner legs with wolf-claw marks on the thighs.',
  demo: 'Bulky black leg plates stuffed with charges, orange powder stains and a stick of dynamite at the hip.',
  seraph: 'White and gold tassets: layered white panels edged in gold over light legs.',
});

export const SHOE_LOOKS = Object.freeze({
  none: 'Unarmoured: the core skeleton\'s own wedge feet (part of the body).',
  sneakers: 'White runner feet with a bright sole stripe.',
  sabatons: 'Chunky segmented iron feet with pointed toes.',
  dashboots: 'Sleek blue feet with small silver wing fins at the ankles.',
  spurs: 'Brown armoured boots with gold rowel spurs at the heel.',
  treads: 'Heavy black feet with thick tank-tread soles.',
  clogs: 'Springy block feet on coiled steel springs.',
  sandals: 'Light open feet with strap plates and a little green leaf emblem.',
  striders: 'Long, light feet with a slim stride and a tiny green leaf on each cuff.',
  magma: 'Thick black obsidian-soled feet with glowing orange cracks.',
  hover: 'Chunky silver feet with small glowing cyan thrusters under the soles (a soft glow below the feet).',
  quicksilver: 'Thin liquid-silver feet with a mirror sheen and little speed streaks.',
});

/** Weapons: grip at the origin, blade or barrel along +X. Elemental items carry a glowing accent
 * (material named `glow_<element>`); the game adds the charge glow and every effect. */
export const WEAPON_LOOKS = Object.freeze({
  // Swords
  brand: 'A classic knight\'s broadsword: a straight polished blade with a fuller, a gold cross-guard with round ends and a red gem in the pommel. The reliable starter.',
  cleaver: 'A huge troll-sized cleaver: a slab of notched dark iron as wide as the knight\'s head, a short wrapped handle and a ring through the spine. Looks too heavy to swing.',
  rapier: 'A needle-thin rapier with a swept gold basket hilt and a long, fine point; elegant and fragile next to the others.',
  thorn: 'A sword grown from a briar: a green-wood blade wrapped in thorny vines with little purple poison buds, a root-knot guard.',
  greatblade: 'A two-handed umbral greatblade: a long jagged black blade with purple veins of light running down it and a winged guard.',
  spur: 'A short spinning sword: a curved blade with three small hooked spurs along the back and a round gear-like guard.',
  frostbite: 'A blade of blue ice with frost crystals on the edge, a silver guard rimed with frost and a pale blue glowing core.',
  blazebrand: 'A sword of living flame: a red-hot orange blade with flickering fire along the edge, a blackened iron guard.',
  voltedge: 'A crackling sword: a short silver blade with a zigzag edge and a glowing cyan lightning core, copper coils on the guard.',
  sickle: 'A blood-red curved sickle-sword with a hooked tip, a bone handle and a dark red gem that pulses softly.',
  hexblade: 'A heavy cursed blade of dark violet steel etched with glowing purple runes, a skull on the guard and a chain on the pommel.',
  maul: 'An enormous earthbreaker sledgehammer: a stone-and-iron block head bound with bronze bands, cracks of earth on the faces, a long thick haft.',
  avenger: 'A holy sword: a white-gold blade with a sun-shaped guard, two small feathered wings at the hilt and a soft golden glow along the edge.',
  leviathan: 'A very long sea-steel blade with a wave-curled tip, scale-patterned flat and a teal-green guard shaped like fins.',
  troika: 'A three-pronged heavy iron sword: one thick blade splitting into three at the tip, rough forged iron with a heavy round pommel.',
  sabre: 'A curved fencing sabre: a slim gleaming blade with a single edge, a sweeping basket guard of polished brass and a wrapped grip.',
  flamesabre: 'A fencing sabre of red-hot steel: an orange glowing curved blade trailing small flames, a blackened basket guard.',
  frostsabre: 'A fencing sabre of pale blue ice-steel: a curved frosted blade with crystals along the spine, a silver basket guard.',
  stormsabre: 'A fencing sabre crackling with lightning: a dark curved blade with a glowing cyan edge, a copper basket guard with coils.',
  // Guns
  blaster: 'A chunky brass pistol with a stubby barrel, a blue energy cell on top and a rounded grip; the friendly standard sidearm.',
  pulsar: 'A wide-mouthed pulsar with a ringed barrel that flares like a trumpet and a glowing blue coil in the middle.',
  alchemer: 'A ricochet coil gun: copper coils wound round the barrel, a glass bulb of green liquid on top and a bent spout muzzle.',
  autogun: 'A rattling autogun with a short drum magazine, a perforated barrel shroud and a crank on the side.',
  sixgun: 'A frontier six-shooter: a long octagonal barrel, a six-chamber revolving cylinder with brass caps, a hammer and a curved wooden grip.',
  catalyzer: 'A tether catalyst: a stubby launcher with a red glass chamber of fizzing charges and a three-pronged claw muzzle.',
  magnus: 'A thunder hand-cannon: a huge revolver with a thick barrel, a big cylinder and a gold lightning emblem; heavy and loud.',
  rifle: 'A long precision rifle: a slim long barrel, a brass scope, a wooden stock and a small bipod folded under the barrel.',
  frostgun: 'A winter repeater: a white-and-blue pistol with an ice crystal chamber, frost on the barrel and a snowflake emblem.',
  embercaster: 'A fire pulsar: a black iron flared barrel with glowing orange vents and a small furnace chamber.',
  voltneedle: 'A shock autogun: a slim gun with a row of glowing cyan needles in the magazine and lightning coils along the barrel.',
  viper: 'A toxic blaster shaped like a snake head: green scales, two fang prongs at the muzzle and a glowing green venom vial.',
  grimcannon: 'A cursed hand-cannon: a dark iron barrel shaped like a gaping skull, violet runes and purple smoke curling from the muzzle.',
  scatter: 'An iron scattergun: a short, very wide double barrel, a pump grip and a riveted iron body; built for close quarters.',
  polaris: 'A star pulsar: a ringed barrel ending in a star-shaped emitter with a pale yellow glowing core and blue fins.',
  riftlocker: 'A rift repeater: an angular black-and-violet gun with a floating purple crystal in an open frame where the barrel should be.',
  // Bombs (held in hand while charging; the planted bomb is a separate model)
  blast: 'A round black iron bomb with a brass band, a short fuse and a lit spark; the classic.',
  haze: 'A round clay pot bomb with a cork stopper leaking orange smoke, painted with flame symbols.',
  frost: 'A round glass bomb full of swirling blue frost with a silver cap and snowflake etching.',
  venom: 'A green glass flask bomb with bubbling toxic liquid, a skull-and-crossbones tag and a wax seal.',
  storm: 'A brass sphere with copper coils and a lightning rod on top, crackling with cyan sparks.',
  hex: 'A dark violet orb bound in chains with a glowing rune on the front and a purple wisp rising from it.',
  shard: 'A spiky ball of sharp crystal shards held together by an iron band, like a sea urchin.',
  vortex: 'A black sphere with a swirling purple vortex window in the middle and four small antenna fins.',
  nitro: 'A huge barrel-sized bomb: riveted red iron with hazard stripes, a thick fuse and NITRO stencilled on it (as shapes, no readable text needed).',
  spark: 'A small white flash-bulb grenade with a glass dome full of crackling light and a pull ring.',
});

/** Everything the catalogue and the art pipeline need, by slot. */
export const GEAR_LOOKS = Object.freeze({ helmet: HELMET_LOOKS, armor: ARMOR_LOOKS, pants: PANTS_LOOKS, shoes: SHOE_LOOKS });
