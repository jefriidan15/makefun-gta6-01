// Solmar Heat — gta6-01 entry program (Node 22, standard library only).
// Hands the game in: copies this repository's game/ (static files, plays offline)
// and screenshots/ (real renders of the game) into /output, then writes
// /output/dossier.json with the kit's vendored buildDossier library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countEntries(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += 1;
    if (statSync(p).isDirectory()) n += countEntries(p);
  }
  return n;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const gameFiles = countEntries(join(here, 'game'));
const shots = existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')).filter((f) => !f.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) throw new Error(`expected 3-4 screenshots, found ${shots.length}`);
if (gameFiles > 993) throw new Error(`game/ holds ${gameFiles} entries, cap is 993`);

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmar Heat: ${gameFiles} game entries, ${shots.length} screenshots -> ${out}`);
