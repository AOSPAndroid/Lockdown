# Weapons audit

All 40 weapons: 15 swords, 15 guns and 10 bombs, measured, reviewed and tuned. The game data lives in
`public/lockdown-weapons.js`; the per-item art briefs are in [CATALOG.md](CATALOG.md).

## Second review (October 2026)

Every sword, gun and bomb re-measured after the slower sword tempo, the hitbox work and the new Striker play, then
tuned in three short rounds. Same method as below: the lab (a standing dummy, every hit clean) and 48 fair bot
matches (loadouts rotate; damage counted for the weapon in hand). Lab DPS for swords is a full combo by an unbuffed
Guardian; for guns, firing as fast as allowed at three tiles.

**Result.** In matches, swords now sit between **−20% and +28%** of the sword average (before: −44% to +51%), guns
between **−20% and +22%** (before: −38% to +57%). Run-to-run noise is about ±10% (the Ember Sabre, changed once more
after the last run, read +17% to +28% across runs).

**Streamlining.**
- One tempo layer for swords. Every cut used to pass through two (`BLADE_TEMPO` on the written timings, then
  `CUT_TEMPO`); now `CUT_TEMPO` alone turns written timings into real ones. No timing moved by more than a tick.
- Guns deal what the data says. The hidden `GUN.damage` ×0.9 on every normal shot is baked into the numbers.
- One systemic fix instead of five per-weapon ones: **burn** dealt 48 over three seconds, more than three sword cuts,
  so every fire weapon overperformed (Ember Sixgun +39%, Ember Sabre +29%, Blazebrand +25% in the lab). It now
  deals 36.
- Elemental variants sit just under their plain twin, with the element doing the rest (the sabres, the Brand line,
  the six-shooters, the pulsars).

**Changes.** Sword cut damage, all cuts of a combo scaled together (full-combo change): Moonlit Katana −30%, Umbral
Greatblade −22%, Dawnbringer −20%, Ember Sabre −11% (and it now burns on the third hit, not the second), Troll Cleaver
−10%, Knight Brand −9%, Blazebrand −5%; Gyre Spur +67%, Sanguine Sickle +42%, Needle Rapier +34%, Rime Sabre +33%,
Volt Fang +27%, Storm Sabre +25%, Briar Blade +22%, Frostbite Edge +21%, Tri-Fang Blade +20%, Duelist Sabre +17%,
Earthbreaker Maul +4%; Hexblade and Tidebreaker unchanged. Guns (damage per shot as dealt, and fire interval in ticks): Pulse Blaster 8 (interval 16 → 15), Ricochet Coil 8
(18 → 17), Rattle Autogun 4 (8 → 10, charge stream 5 → 4 a round), Prairie Sixgun 5 (9 → 10), Ember Sixgun 4
(9 → 11, burns on the fifth hit, not the fourth), Iron Peacemaker 7 → 6 (15 → 18, charge fan 9 → 6 a round), Ripple
Caster 7 → 10, Northstar 7 → 9, Ember Caster 6 → 7, Winter Repeater 6 → 7, Longshot Rifle 16 → 18, Tether Catalyst
7 → 9 (detonation 18 → 25 a charge); the rest are unchanged. Bombs are unchanged; the Ember Haze cloud deals less
through the burn change.

**Still bot-driven.** The Needle Rapier, Gyre Spur and Frostbite Edge sit lowest in bot hands although they lead or
match the lab (bots rarely land the rapier's tip or a perfect Frostbite combo); the Tether Catalyst needs a detonation
bots seldom set up. All need human playtests before any further change.

| Sword | Lab DPS before → after | In match before → after |
|---|---|---|
| Ember Sabre `flamesabre` | 41 → 34 | +29% → **+28%** |
| Umbral Greatblade `greatblade` | 57 → 45 | +46% → **+19%** |
| Briar Blade `thorn` | 35 → 43 | -5% → **+11%** |
| Moonlit Katana `katana` | 89 → 59 | +51% → **+8%** |
| Duelist Sabre `sabre` | 31 → 34 | -3% → **+8%** |
| Troll Cleaver `cleaver` | 48 → 43 | +22% → **+7%** |
| Knight Brand `brand` | 50 → 46 | +29% → **+7%** |
| Tri-Fang Blade `troika` | 38 → 46 | -6% → **+3%** |
| Earthbreaker Maul `maul` | 50 → 51 | -4% → **+3%** |
| Volt Fang `voltedge` | 29 → 36 | -10% → **+1%** |
| Hexblade `hexblade` | 47 → 47 | +7% → **-1%** |
| Tidebreaker `leviathan` | 52 → 52 | -4% → **-1%** |
| Blazebrand `blazebrand` | 58 → 52 | +6% → **-2%** |
| Storm Sabre `stormsabre` | 30 → 35 | -21% → **-7%** |
| Dawnbringer `avenger` | 66 → 53 | +11% → **-8%** |
| Sanguine Sickle `sickle` | 25 → 35 | -18% → **-10%** |
| Rime Sabre `frostsabre` | 27 → 34 | -31% → **-11%** |
| Frostbite Edge `frostbite` | 47 → 56 | -23% → **-18%** |
| Gyre Spur `spur` | 26 → 43 | -44% → **-18%** |
| Needle Rapier `rapier` | 48 → 65 | -32% → **-20%** |

Spread: -44% to +51% → -20% to +28%

| Gun | Lab DPS at 3 tiles before → after | In match before → after |
|---|---|---|
| Ember Sixgun `embersixgun` | 38 → 31 | +39% → **+22%** |
| Iron Peacemaker `peacemaker` | 31 → 25 | +57% → **+21%** |
| Volt Needle `voltneedle` | 30 → 28 | +28% → **+17%** |
| Rift Repeater `riftlocker` | 24 → 24 | +18% → **+16%** |
| Grim Hand-cannon `grimcannon` | 29 → 29 | +2% → **+8%** |
| Rattle Autogun `autogun` | 26 → 24 | +28% → **+6%** |
| Prairie Sixgun `sixgun` | 33 → 31 | +11% → **+6%** |
| Longshot Rifle `rifle` | 24 → 27 | -16% → **+1%** |
| Iron Scattergun `scatter` | 45 → 45 | -12% → **+1%** |
| Pulse Blaster `blaster` | 32 → 32 | -15% → **+0%** |
| Ripple Caster `pulsar` | 24 → 34 | -31% → **-4%** |
| Thunder Hand-cannon `magnus` | 31 → 31 | -5% → **-9%** |
| Ricochet Coil `alchemer` | 30 → 29 | -7% → **-11%** |
| Winter Repeater `frostgun` | 24 → 28 | -13% → **-12%** |
| Tether Catalyst `catalyzer` | 24 → 31 | -38% → **-14%** |
| Northstar `polaris` | 24 → 30 | -18% → **-15%** |
| Viper Spitter `viper` | 33 → 33 | -16% → **-16%** |
| Ember Caster `embercaster` | 31 → 32 | -10% → **-20%** |

Spread: -38% to +57% → -20% to +22%

## First review

### Summary

- **Balance after tuning.** In bot matches with fair loadout rotation, swords now sit between **−20% and
  +21%** of the average sword's damage per minute held (before: −34% to +26%). Guns sit between **−35% and +32%**
  (before: −42% to +51%). Run-to-run noise is about ±10%, so anything inside ±20% counts as even.
- **One systemic fix.** Bullet flinch now follows the round's weight (`min(8, 3 + 0.3 × damage)` ticks) instead
  of a flat 8 ticks. Light rapid-fire rounds no longer chain-interrupt swords; heavy rounds still stagger.
- **Twenty-one number changes**, listed below, and one fix in the charge test of the audit lab itself.
- **Names.** Eight display names matched or nearly matched Spiral Knights items. They are renamed to
  originals; the ids stay the same (see *Names* below).
- **Biggest remaining gaps** are bot-driven: heavy swords overperform because bots rarely punish their slow
  wind-ups, and the Tether Catalyst underperforms because bots rarely set up its detonation. Both need human
  playtests before any further change.

## Method

1. **Lab.** Each weapon fights a standing dummy for 8 seconds as an unbuffed Guardian. Swords: full combo
   (pressing every 4 ticks) and the Spiral Knights cancel loop (first cut, shield-cancel, first cut). Guns:
   firing as fast as allowed at 3 tiles and at 9 tiles, including bloom and reloads. Charge attacks: a full
   charge released into the dummy. Bombs: planted 40 units from the dummy. Status damage (burn, shock) counts.
2. **Matches.** 48 full bot matches (8 arenas × 6 seeds). Loadouts rotate so every weapon gets the same number
   of seats; damage and kills are credited to the weapon **in the attacker's hand** when they land, divided by
   the minutes that weapon was held. Bombs are judged by the lab and their role only, since cloud and status
   damage lands while the bot holds another weapon.
3. **Review.** Each weapon's role, range, difficulty and description against the others, against the
   Spiral Knights weapon lines, and against the fighting rules (interrupts, counters, clashes, stagger).

## Measurements (after tuning)

DPS = damage per second. Reach in world units (48 = one tile). Wind-up in ticks (120 per second).
"In match" = damage per minute held compared with the family average.

### Swords

| Sword | Type | Hits | 1st cut (dmg / wind-up ticks) | Reach | Full combo DPS | Cancel-loop DPS | Charge dmg | Difficulty | In match before → after |
|---|---|---|---|---|---|---|---|---|---|
| Earthbreaker Maul `maul` | Heavy hammer, heavy | 2 | 35 / 22 | 80 | 104 | 96 | 58 | ★★★ | +25% → **+16%** |
| Blazebrand `blazebrand` | Fire sword, burn | 3 | 13 / 5 | 70 | 91 | 83 | 66 | ★ | +10% → **+14%** |
| Tidebreaker `leviathan` | Long sword | 3 | 16 / 6 | 84 | 90 | 84 | 46 | ★★ | -12% → **-8%** |
| Knight Brand `brand` | Normal sword | 3 | 14 / 5 | 70 | 88 | 77 | 86 | ★ | -1% → **-6%** |
| Umbral Greatblade `greatblade` | Dark sword, heavy | 2 | 26 / 12 | 80 | 87 | 98 | 30 | ★★ | +17% → **+21%** |
| Dawnbringer `avenger` | Holy sword, holy | 3 | 14 / 5 | 72 | 85 | 77 | 28 | ★★ | -16% → **-7%** |
| Troll Cleaver `cleaver` | Heavy sword, heavy | 2 | 27 / 14 | 78 | 85 | 95 | 42 | ★★ | +26% → **+7%** |
| Tri-Fang Blade `troika` | Heavy sword, heavy | 3 | 24 / 12 | 76 | 84 | 90 | 36 | ★★★ | +3% → **+1%** |
| Briar Blade `thorn` | Thorn sword | 3 | 13 / 5 | 68 | 83 | 72 | 35 | ★ | -2% → **+1%** |
| Hexblade `hexblade` | Curse sword, heavy, curse | 2 | 25 / 13 | 78 | 79 | 91 | 34 | ★★ | +15% → **+20%** |
| Frostbite Edge `frostbite` | Frost sword, chill | 3 | 12 / 5 | 68 | 71 | 66 | 32 | ★★ | -2% → **-12%** |
| Sanguine Sickle `sickle` | Vampire sword, drain | 3 | 12 / 5 | 68 | 71 | 66 | 24 | ★★ | -17% → **-13%** |
| Needle Rapier `rapier` | Fast sword | 4 | 9 / 4 | 82 | 70 | 54 | 28 | ★★★ | +5% → **+5%** |
| Volt Fang `voltedge` | Shock sword, shock | 4 | 8 / 4 | 72 | 67 | 50 | 41 | ★★ | -34% → **-20%** |
| Gyre Spur `spur` | Spin sword | 4 | 8 / 4 | 72 | 63 | 46 | 33 | ★★ | -17% → **-18%** |

### Guns

| Gun | Type | Damage per shot | Clip | Range | DPS at 3 tiles | DPS at 9 tiles | Charge dmg | Difficulty | In match before → after |
|---|---|---|---|---|---|---|---|---|---|
| Iron Scattergun `scatter` | Shotgun | 6 × 6 | 2 | 6.9 tiles | 54 | 0 | 30 | ★★ | -17% → **+11%** |
| Ember Caster `embercaster` | Fire pulsar, burn | 8 | 3 | 6.7 tiles | 39 | 0 | 62 | ★ | -17% → **-16%** |
| Viper Spitter `viper` | Toxic blaster, poison | 10 | 3 | 11.7 tiles | 38 | 33 | 8 | ★★ | -36% → **-24%** |
| Pulse Blaster `blaster` | Blaster | 9 | 3 | 12.9 tiles | 37 | 32 | 24 | ★ | +20% → **+3%** |
| Ripple Caster `pulsar` | Pulsar | 11 | 3 | 7.1 tiles | 37 | 0 | 22 | ★ | -39% → **-11%** |
| Northstar `polaris` | Pulsar | 11 | 3 | 8.8 tiles | 37 | 33 | 24 | ★★ | -36% → **-11%** |
| Thunder Hand-cannon `magnus` | Hand-cannon | 16 | 2 | 13.3 tiles | 36 | 38 | 26 | ★★ | +6% → **+1%** |
| Ricochet Coil `alchemer` | Ricochet | 9 | 3 | 15.8 tiles | 34 | 29 | 20 | ★★★ | -3% → **-8%** |
| Grim Hand-cannon `grimcannon` | Curse hand-cannon, curse | 14 | 2 | 12.9 tiles | 32 | 36 | 22 | ★★ | +12% → **+6%** |
| Volt Needle `voltneedle` | Shock autogun, shock | 4 | 6 | 11.3 tiles | 31 | 14 | 54 | ★ | +12% → **+13%** |
| Winter Repeater `frostgun` | Frost blaster, chill | 7 | 3 | 12.1 tiles | 29 | 25 | 16 | ★ | -3% → **-10%** |
| Tether Catalyst `catalyzer` | Catalyzer | 8 | 3 | 10.8 tiles | 28 | 26 | 28 | ★★★ | -42% → **-35%** |
| Rattle Autogun `autogun` | Autogun | 4 | 6 | 11.7 tiles | 27 | 12 | 50 | ★ | +50% → **+32%** |
| Longshot Rifle `rifle` | Long rifle | 18 | 1 | 19.6 tiles | 27 | 30 | 30 | ★★★ | +40% → **+26%** |
| Rift Repeater `riftlocker` | Rift gun | 8 | 3 | 12.5 tiles | 27 | 25 | 48 | ★★ | +51% → **+22%** |

### Bombs

| Bomb | Type | Direct damage (+ status over time) | Press to blast | Radius | Effect | Difficulty |
|---|---|---|---|---|---|---|
| Cannonball Bomb `blast` | Blast bomb | 30 | 1.10s | 2.1 tiles | knockback blast | ★ |
| Ember Haze `haze` | Haze bomb | 88 | 1.20s | 1.9 tiles | burn cloud, 4 s | ★ |
| Frost Haze `frost` | Haze bomb | 0 | 1.20s | 1.9 tiles | freeze cloud, 4 s | ★ |
| Venom Veil `venom` | Haze bomb | 0 | 1.20s | 1.9 tiles | poison cloud, 4 s | ★ |
| Storm Haze `storm` | Haze bomb | 28 | 1.20s | 1.9 tiles | shock cloud, 4 s | ★ |
| Hex Haze `hex` | Haze bomb | 0 | 1.20s | 1.9 tiles | curse cloud, 4 s | ★ |
| Shard Burst `shard` | Shard bomb | 24 | 1.70s | 0.8 tiles | 8 shards | ★★ |
| Vortex Bomb `vortex` | Vortex bomb | 22 | 1.75s | 2.3 tiles | pulls enemies in, then blasts | ★★ |
| Nitro Colossus `nitro` | Blast bomb | 46 | 2.30s | 3.1 tiles | knockback blast | ★★ |
| Storm Flash `spark` | Flash bomb | 26 | 0.88s | 1.9 tiles | stun + shock | ★ |


## Changes

| Weapon | Before | After | Why |
|---|---|---|---|
| Troll Cleaver | 31 / 38 | 27 / 33 | top of the swords in matches (+26%) |
| Earthbreaker Maul | 40 / 52 | 35 / 46 | +25% in matches |
| Umbral Greatblade | 29 / 34 | 26 / 31 | +17% in matches |
| Hexblade | 26 / 31 | 25 / 29 | +15%, and it curses |
| Volt Fang | 7/8/8/12, reach 66, arcs 30% × 6 | 8/9/10/15, reach 72, arcs 40% × 7 | −34% in matches: short reach meant whiffs |
| Gyre Spur | 7/8/9/13, reach 66 | 8/9/10/15, reach 72 | −17% in matches |
| Sanguine Sickle | 11/14/20 | 12/15/21 | −17% (lifesteal included) |
| Dawnbringer | 13/17/24, beam 26 | 14/18/26, beam 28 | −16% in matches |
| Tidebreaker | 15/20/28 | 16/21/30 | −12% in matches |
| Rift Repeater | 10, charge 9 | 8, charge 8 | +51%: piercing every knight in line is strong |
| Rattle Autogun | 5 damage, spread .08 | 4 damage, spread .09 | +50% in matches |
| Longshot Rifle | 20, +80% at range | 18, +60% at range | +40% (bots aim well; still the hardest gun) |
| Ripple Caster | 7, speed 360 | 11, speed 400 | −39% in matches |
| Tether Catalyst | 6, detonation 14 per charge | 8, 18 per charge | −42% in matches |
| Viper Spitter | 7, poison 30%, fan .6 | 10, poison 40%, fan .4 (8 per bolt) | −36%; the charged fan rarely landed |
| Northstar | 8, charge 20 | 11, charge 24 | −36% in matches |
| Iron Scattergun | 6 × 5, spread .5, range 300 | 6 × 6, spread .3, range 330 | −17%: pellets missed even at three tiles |
| Ember Caster | 6 | 8 | −17% in matches |
| Ricochet Coil | 8 | 9 | −8% in matches |
| Shard Burst | shards 12 | shards 14 | weakest damaging bomb in the lab |
| All guns | flat 8-tick flinch | min(8, 3 + 0.3 × damage) | rapid fire chain-interrupted swords |

## Review

### Roles and coverage

| Family | Easy (★) | Skill (★★) | Hard (★★★) |
|---|---|---|---|
| Swords | Knight Brand, Blazebrand, Briar Blade | Cleaver, Greatblade, Hexblade, Frostbite, Sickle, Volt Fang, Gyre Spur, Dawnbringer, Tidebreaker | Needle Rapier (tip sweet spot), Earthbreaker Maul, Tri-Fang Blade |
| Guns | Pulse Blaster, Ripple Caster, Autogun, Winter Repeater, Ember Caster, Volt Needle | Hand-cannon, Grim Hand-cannon, Viper Spitter, Scattergun, Northstar, Rift Repeater | Ricochet Coil (bank shots), Tether Catalyst (detonation), Longshot Rifle |
| Bombs | Cannonball Bomb, the five hazes, Storm Flash | Shard Burst, Vortex Bomb, Nitro Colossus | (none) |

Every family has an easy starter, a spread of skill weapons and at least two high-skill, high-reward picks.
Every status has a sword, a gun and a bomb: burn, freeze/chill, shock, poison, curse.

### Spiral Knights coverage

| Spiral Knights line | Lockdown |
|---|---|
| Normal swords (the Calibur line) | Knight Brand |
| Heavy swords | Troll Cleaver, Tri-Fang Blade, Umbral Greatblade |
| Fencing swords (the Flourish line) | Needle Rapier (sweet spot) |
| Spinning swords (the Spur and Wolver lines) | Gyre Spur |
| Long and holy swords | Tidebreaker, Dawnbringer |
| Elemental and special swords | Frostbite Edge, Blazebrand, Volt Fang, Sanguine Sickle, Hexblade, Briar Blade |
| Blasters | Pulse Blaster, Winter Repeater, Viper Spitter |
| Pulsars | Ripple Caster, Ember Caster, Northstar |
| Alchemers | Ricochet Coil |
| Autoguns | Rattle Autogun, Volt Needle |
| Catalyzers | Tether Catalyst |
| Antiguas and hand-cannons | Thunder Hand-cannon, Grim Hand-cannon |
| Shotguns | Iron Scattergun |
| Blast bombs | Cannonball Bomb, Nitro Colossus |
| Haze bombs | Ember, Frost, Venom, Storm and Hex Haze |
| Shard and vortex bombs | Shard Burst, Vortex Bomb |
| Flash bombs | Storm Flash |
| Invented | Earthbreaker Maul, Longshot Rifle, Rift Repeater |

### Names

Display names are original. Eight matched or nearly matched Spiral Knights items and were renamed (ids
unchanged, so saves and art paths keep working): Voltedge → **Volt Fang**, Polaris → **Northstar**, Blast Bomb →
**Cannonball Bomb**, Splinter Bomb → **Shard Burst**, Static Flash → **Storm Flash**, Leviathan Edge → **Tidebreaker**,
Iron Troika → **Tri-Fang Blade**, Radiant Avenger → **Dawnbringer**.

### Findings to watch

- **Heavy swords** (Cleaver, Maul, Greatblade, Hexblade) still lead the swords in bot matches (+7% to +21%).
  Their weaknesses (slow wind-ups, whiffs, being out-traded during the wind-up) are things people punish
  and bots mostly don't. Re-check after human playtests before nerfing further.
- **Light four-hit swords** (Gyre Spur, Volt Fang) trail by about 20%: heavies clash them aside and their
  light cuts are easily out-traded. Their strength is the cancel game and quick counters, which bots barely use.
- **Tether Catalyst** (−35%) depends on stacking charges and then firing a detonator. Bots don't play it that
  way; a person who does deals the most burst of any gun. Keep it as the skill gun.
- **Longshot Rifle** is still +26% in bot hands because bots aim perfectly. With people it will land far less.
- **Haze bombs** do little or no direct damage; their value is area denial on capture points, which this
  audit cannot measure. Watch whether they get used at all.

## Rerunning the audit

- Lab: `node tools/weapon-lab.mjs` (JSON rows per weapon).
- Matches: `for i in 0 1 2 3; do node tools/weapon-matches.mjs $i 4 > part$i.json & done; wait`, then
  `node tools/weapon-report.mjs part*.json`. Takes a few minutes; rerun after every balance change.
