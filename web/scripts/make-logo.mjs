/* Odvodí public/assets/img/logo.png (priehľadné pozadie) z logo.jpg.
   Biele pozadie loga sa nahradí priehľadnosťou: alfa sa počíta z toho,
   ako blízko je pixel k bielej (min z R/G/B kanálov). Farebné prvky loga
   (zelený text, zlaté/modré tvary) majú min výrazne pod prahom, takže
   zostanú plne nepriehľadné; len takmer biele pixely zmiznú.

   Spustenie:  node scripts/make-logo.mjs
*/
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'public/assets/img/logo.jpg')
const OUT = join(ROOT, 'public/assets/img/logo.png')

const WIDTH = 640 // zobrazuje sa max ~48 px vysoko, 640 px stačí aj pre retina
const LO = 230 // min(r,g,b) <= LO  -> plne nepriehľadné
const HI = 250 // min(r,g,b) >= HI  -> plne priehľadné (biele pozadie)

const { data, info } = await sharp(SRC)
  .trim({ threshold: 12 }) // odreže biely okraj
  .resize({ width: WIDTH })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += info.channels) {
  const m = Math.min(data[i], data[i + 1], data[i + 2])
  data[i + 3] = m <= LO ? 255 : m >= HI ? 0 : Math.round((255 * (HI - m)) / (HI - LO))
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png({ palette: true, quality: 85, effort: 10 })
  .toFile(OUT)

console.log(`logo.png  ${info.width}x${info.height}  ${(statSync(OUT).size / 1024).toFixed(1)} KB`)
