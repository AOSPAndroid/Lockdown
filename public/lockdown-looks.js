/** How everything in Lockdown looks: the one source for art. The 3D models, the menu icons and the
 * 2D sprites are all made from these descriptions (docs/CATALOG.md is generated from this file).
 *
 * House style for every item: chunky, rounded, toy-like Spiral Knights-inspired shapes; soft painted
 * materials; clean silhouettes that read from a camera ~48° above; light from the top-left. Original
 * designs only. Team colour is never part of an item: where an item has a "team" trim, that trim is
 * made with a material named `team` and the game paints it Amber or Cyan. */

export const BODY_LOOK = 'A Spiral Knights-style knight, 1.3 units tall, always armoured: no skin, no hair, no human face ever shows. The body is the mannequin under the gear: a dark charcoal-navy padded under-suit (seen only in the gaps at the neck, elbows, waist and knees), big round armoured mitten gauntlets, and a head that is a dark void sphere with two small glowing pale eye-lights (soft white-blue, emissive). Every helmet is a shell over that head with a visor opening, so the same two glowing eyes look out of every helmet. Proportions: the helmet is about 45% of the height and wider than the shoulders; a short barrel torso; short stubby legs; chunky feet. Arms and legs are separate rigid parts so the game can swing them.';

export const CLASS_LOOKS = Object.freeze({
  striker: 'Lean and fast. A swept-back fin crest on the helmet in `team` colour, small gold go-faster chevrons on the shoulders. While Boost is held the game adds a gold speed streak behind the knight.',
  guardian: 'Broad and steady. Huge rounded bronze pauldrons, nearly as big as the helmet, with a `team` rim (on `arm_L` and `arm_R`, worn over any armour: the Guardian\'s mark), a round crest knob on the helmet in `team` colour and a round riveted bronze shield on the left arm. The shield bubble and dome are drawn by the game.',
  recon: 'Slim and sly. A short pointed hood-tip crest in `team` colour and a dark scarf. Cloaked, the knight turns translucent (drawn by the game).',
});

export const HELMET_LOOKS = Object.freeze({
  none: 'Recruit Helm (everyone starts in it): a big round polished-steel dome helm, wider than the shoulders, with a wide dark T-shaped visor opening where the two glowing eyes show, a raised ridge from brow to nape, a `team` band round the brow and a few big rivets. The plain, friendly starter look of the game.',
  sallet: 'A rounded steel sallet with a narrow eye slit and a short swept tail at the back; polished, a little battered, a thin `team` band round the brow.',
  visor: 'A slim dark tactical visor wrapping the eyes with a glowing cyan lens and a small brass earpiece; worn on a dark padded skullcap that covers the whole head.',
  horned: 'A dented iron cap with two big curved bone horns sweeping forward and up; leather chin strap.',
  hood: 'A deep charcoal-violet cloth hood that shadows the face; two eyes glow faintly violet inside; little rune stitches on the hem.',
  lampcap: 'A sooty leather miner\'s cap with a big brass lamp on the front (warm yellow glow) and a fuse cord wrapped round it.',
  feather: 'A jaunty green felt cap tipped to one side with a long red feather sweeping back.',
  bucket: 'A dented metal bucket worn upside down as a helm, two eye holes punched in it and the handle hanging at the side.',
  circlet: 'A thin gold circlet with a small green gem on the forehead, over a dark padded coif that covers the head; the two glowing eyes look out from the shadow under it.',
  goggles: 'Brass aviator goggles with round amber lenses pushed up on a padded leather aviator cap that covers the whole head; a tiny ticking cog at the temple.',
  cobalt: 'A deep-blue cobalt great helm, rounded and heavy, with a T-shaped visor slit, silver rivets and a short blue plume.',
  wolver: 'A grey wolf-pelt cowl: the wolf\'s head sits on top with its ears up and its fangs over the brow; fur falls to the shoulders.',
  demo: 'A blast-scarred black demolition helm with an orange-glowing visor grille, soot streaks and a little smoking chimney on top.',
  seraph: 'A white silk veil falling from the crown, a floating golden halo above the head (soft warm glow) and two small white feather wings at the temples.',
});

export const ARMOR_LOOKS = Object.freeze({
  none: 'Recruit Plate (everyone starts in it): a plain polished-steel cuirass with a rounded barrel chest, two small round steel pauldrons, a `team` stripe down the middle of the chest and a dark leather belt with a brass buckle.',
  scout: 'Light tan leather jerkin with a brown belt, small shoulder guards and a canteen at the hip; quick and practical.',
  ballistic: 'Chunky grey-green padded plates over the chest and shoulders with a high collar, like a bomb-disposal vest; bullet scuffs.',
  duelist: 'A fitted burgundy brigandine with diagonal steel bands, one large left pauldron and a high collar; elegant and sharp.',
  heavy: 'Thick steel plate: a domed breastplate, big rounded pauldrons and a skirt of plates; dents and rivets everywhere.',
  gunslinger: 'A long brown riding duster with a bandolier of brass cartridges across the chest and a wide collar; the coat tails flap behind.',
  fencer: 'A white padded fencing jacket buttoned on one side with a red heart patch on the chest; a slim, light silhouette.',
  windrunner: 'Flowing pale-turquoise silk wraps and sashes that trail behind like ribbons over a dark under-suit, with wrapped steel-capped forearms.',
  juggernaut: 'A huge riveted dark-iron siege plate: a barrel chest, enormous shoulder plates with spikes and a grille on the chest; the knight looks twice as wide.',
  bombardier: 'A scorched brown leather apron over a soot-grey padded gambeson, a belt of fused bombs and a coil of fuse cord on the shoulder.',
  berserker: 'Dark iron bracers and a studded leather harness painted with red war stripes, a wolf pelt over the shoulders with the head on the back; a bone necklace.',
  mirrorweave: 'A shimmering cloak of mirror scales that catches the light (pearly blue-violet sheen) over a dark tunic.',
  medic: 'A white field coat with a red cross armband, a satchel of salves across the body and green glass vials at the belt.',
  clockwork: 'A ticking brass harness over a dark padded gambeson: exposed gears on the chest that turn, a winding key on the back and copper pipes on the shoulders.',
  cobalt: 'Deep-blue cobalt mail: a smooth blue breastplate with silver trim and a star emblem, rounded blue pauldrons and a short blue tabard.',
  vog: 'A shaggy orange-and-black fur coat made from a volcanic bear cub: ember-glowing tips on the fur, small horns on the shoulders and a fur hood down the back.',
});

export const PANTS_LOOKS = Object.freeze({
  none: 'Recruit Greaves (everyone starts in them): a short skirt of three steel tassets over the hips and plain rounded steel shin plates over the dark under-suit.',
  greaves: 'Steel knee greaves and shin plates over dark trousers.',
  leggings: 'Tight dark-blue running leggings with a light stripe down the side.',
  chausses: 'Grey chainmail chausses (a clear ring texture) to the ankle.',
  breeches: 'Cream fencing breeches buckled below the knee with long white socks.',
  sapper: 'Olive canvas trousers with knee pads and a fuse-cord pouch on the thigh.',
  cargo: 'Khaki cargo trousers with big side pockets and a holster strap on the thigh.',
  kilt: 'A red-and-green tartan kilt with a leather sporran.',
  cobalt: 'Deep-blue cobalt cuisses: blue steel thigh plates with silver rivets over dark trousers.',
  wolver: 'Grey fur-lined running leggings with wolf-claw marks stitched on the thighs.',
  demo: 'Baggy black pantaloons stuffed with charges, orange powder stains and a stick of dynamite tucked in the belt.',
  seraph: 'White and gold tassets: layered white cloth panels edged in gold over light trousers.',
});

export const SHOE_LOOKS = Object.freeze({
  none: 'Recruit Boots (everyone starts in them): plain rounded steel sabatons with a thick dark sole, chunky and toy-like.',
  sneakers: 'Light padded runner boots in white canvas over steel toe caps, with a bright sole stripe.',
  sabatons: 'Chunky segmented iron sabatons with pointed toes.',
  dashboots: 'Sleek blue boots with small silver wings at the ankles.',
  spurs: 'Brown riding boots with gold rowel spurs at the heel.',
  treads: 'Heavy black rubber-soled work boots with thick treads.',
  clogs: 'Springy wooden clogs on coiled steel springs.',
  sandals: 'Simple leather sandals with straps and a little herb sprig tucked in.',
  striders: 'Long, light leather boots with a slim stride and a tiny green leaf on each cuff.',
  magma: 'Thick black obsidian-soled boots with glowing orange cracks.',
  hover: 'Chunky silver boots with small glowing cyan thrusters under the soles (a soft glow below the feet).',
  quicksilver: 'Thin liquid-silver slippers with a mirror sheen and little speed streaks.',
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
  // Guns
  blaster: 'A chunky brass pistol with a stubby barrel, a blue energy cell on top and a rounded grip; the friendly standard sidearm.',
  pulsar: 'A wide-mouthed pulsar with a ringed barrel that flares like a trumpet and a glowing blue coil in the middle.',
  alchemer: 'A ricochet coil gun: copper coils wound round the barrel, a glass bulb of green liquid on top and a bent spout muzzle.',
  autogun: 'A rattling autogun with a short drum magazine, a perforated barrel shroud and a crank on the side.',
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
