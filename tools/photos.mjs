// Turns the chosen found pictures in assets/ into web sizes plus a credits list.
// node tools/photos.mjs   (needs assets/ from the design skill's assets.mjs --get)
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = 'web/public/photos';
mkdirSync(OUT, { recursive: true });

// name on the site ← downloaded file, with what it shows in both languages
const PICK = {
  albarello: ['apothecary-jar-albarello.jpg', 'Apothecary jar, Faenza, about 1480–90', 'Albarello da farmacia, Faenza, 1480–90 circa'],
  brocca: ['armorial-ewer-brocca.jpg', 'Armorial ewer, Faenza, probably 1527', 'Brocca con stemma, Faenza, probabilmente 1527'],
  bianco: ['bowl-in-faenza-white-maiolica.jpg', 'Bowl in "Faenza white", about 1570–80', 'Ciotola in "bianco di Faenza", 1570–80 circa'],
  crespina: ['dish-crespina.jpg', 'Fluted dish (crespina), Faenza, about 1540–50', 'Crespina, Faenza, 1540–50 circa'],
  mic: ['facciata-del-mic-museo-internazionale-delle-ceramiche.jpg', 'The International Museum of Ceramics, Faenza', 'Il Museo Internazionale delle Ceramiche, Faenza'],
  mazzini: ['faenza-corso-giuseppe-mazzini-01.jpg', 'Corso Mazzini, Faenza', 'Corso Mazzini, Faenza'],
  xilografia: ['faenza-corso-mazzini-xilografia.jpg', 'Corso Mazzini in a woodcut, 1900', 'Corso Mazzini in una xilografia, 1900'],
  piazza: ['faenza-piazza-del-popolo-palazzo-manfredi-01.jpg', 'Piazza del Popolo and Palazzo Manfredi, Faenza', 'Piazza del Popolo e Palazzo Manfredi, Faenza'],
  giardino: ['museo-internazionale-delle-ceramiche-in-faenza-111.jpg', 'The museum garden, Faenza', 'Il giardino del museo, Faenza'],
  tornio: ['sevres-grand-atelier-ebauchage-032.jpg', 'Throwing on the wheel (Sèvres workshop)', 'Al tornio (laboratorio di Sèvres)'],
  forno: ['stacking-kiln-for-bulk-firing-of-one.jpg', 'Glazed tiles stacked in a kiln before firing', 'Piastrelle smaltate impilate nel forno prima della cottura'],
};

const credits = JSON.parse(readFileSync('assets/credits.json', 'utf8'));
const byFile = f => credits.find(c => c.file === `assets/${f}`);
const list = [];

for (const [name, [file, en, it]] of Object.entries(PICK)) {
  const c = byFile(file);
  if (!c) throw new Error(`no credit for ${file}`);
  const meta = await sharp(`assets/${file}`).metadata();
  for (const w of [800, 1600]) {
    let q = 78;
    const out = `${OUT}/${name}-${w}.webp`;
    do { await sharp(`assets/${file}`).resize({ width: Math.min(w, meta.width) }).webp({ quality: q }).toFile(out); q -= 8; }
    while (statSync(out).size > 200_000 && q > 40);
  }
  list.push({ name, w: meta.width, h: meta.height, alt: { en, it }, creator: c.creator.replace(/^(.+) \1$/, '$1'), license: c.license, licenseUrl: c.licenseUrl, page: c.page, via: c.via, title: c.title });
}

// the moving picture: 12 s of the kick wheel, no sound
const clip = credits.find(c => c.file === 'assets/opyshnja.webm');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '15', '-t', '12', '-i', 'assets/opyshnja.webm', '-an', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', `${OUT}/wheel.webm`]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '18', '-i', 'assets/opyshnja.webm', '-frames:v', '1', `${OUT}/wheel-poster.png`]);
await sharp(`${OUT}/wheel-poster.png`).webp({ quality: 75 }).toFile(`${OUT}/wheel-poster.webp`);
list.push({ name: 'wheel', video: true, w: 640, h: 480, alt: { en: 'A kick wheel at work, Opishnia pottery fair', it: 'Un tornio a pedale al lavoro, fiera della ceramica di Opišnja' }, creator: clip.creator, license: clip.license, licenseUrl: clip.licenseUrl, page: clip.page, via: clip.via, title: clip.title });

writeFileSync(`${OUT}/credits.json`, JSON.stringify(list, null, 1));
console.log(list.map(l => `${l.name}: ${l.creator} · ${l.license}`).join('\n'));
