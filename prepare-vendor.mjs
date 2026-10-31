import {mkdir, copyFile, cp, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Copies pinned runtime assets into a static directory; no bundler or backend.
const copy = async (from, to) => { await mkdir(to.slice(0, to.lastIndexOf('/')), {recursive:true}); await copyFile(from, to); };
for (const file of ['pdf.mjs', 'pdf.worker.mjs']) await copy(`node_modules/pdfjs-dist/build/${file}`, `vendor/pdfjs/${file}`);
for (const dir of ['cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${dir}`, `vendor/pdfjs/${dir}`, {recursive:true});
await copy('node_modules/pdfjs-dist/LICENSE', 'vendor/pdfjs/LICENSE');
for (const file of ['tesseract.esm.min.js','worker.min.js']) await copy(`node_modules/tesseract.js/dist/${file}`, `vendor/tesseract/${file}`);
for (const file of ['tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt']) await copy(`node_modules/tesseract.js/dist/${file}`, `vendor/tesseract/${file}`);
await copy('node_modules/tesseract.js/LICENSE.md', 'vendor/tesseract/LICENSE.md');
await mkdir('vendor/tesseract/core', {recursive:true});
const {readdir} = await import('node:fs/promises');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (file.endsWith('.wasm') || file.endsWith('.wasm.js') || file === 'LICENSE') await copy(`node_modules/tesseract.js-core/${file}`, `vendor/tesseract/core/${file}`);
}
await copy('node_modules/xlsx/dist/xlsx.full.min.js', 'vendor/xlsx.full.min.js');
await copy('node_modules/xlsx/LICENSE', 'vendor/xlsx-LICENSE');
// English OCR model; document contents never leave the browser.
const modelUrl='https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz';
const response=await fetch(modelUrl);
if(!response.ok) throw new Error(`OCR model download failed: ${response.status}`);
const model=Buffer.from(await response.arrayBuffer());
await mkdir('vendor/tesseract/lang',{recursive:true});
await writeFile('vendor/tesseract/lang/eng.traineddata.gz',model);
await writeFile('vendor/NOTICE.md',`# Locally hosted import libraries\n\nPDF.js 6.4.299 (Apache-2.0), SheetJS CE 0.20.3 (Apache-2.0), Tesseract.js 7.0.0 (Apache-2.0). Their licenses accompany these assets.\n\nEnglish OCR model: ${modelUrl}\nSHA-256: ${createHash('sha256').update(model).digest('hex')}\n\nThese static files are served locally. Imported documents, spreadsheets and images are never uploaded.\n`);
console.log('Local PDF, spreadsheet, and OCR runtime assets are ready.');
