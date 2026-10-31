// Document readers are loaded only when needed. No selected file leaves this browser.
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1_000_000;
const MAX_PDF_PAGES = 20;
const MAX_SHEETS = 10;
const MAX_CELLS = 20_000;
const MAX_SOURCE_PIXELS = 40_000_000;
const MAX_RENDER_PIXELS = 8_000_000;
const MAX_EDGE = 4096;
const localURL = path => new URL(path, import.meta.url).href;
const supported = new Set(['pdf', 'xlsx', 'xls', 'csv', 'tsv', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']);
let sheetScript;

export function validateImportFile(file) {
  if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || typeof file.arrayBuffer !== 'function') {
    throw new Error('Choose a PDF, Excel workbook, image, or text timetable.');
  }
  if (!file.size) throw new Error('This file is empty. Choose a timetable containing classes.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file smaller than 15 MB.');
  const extension = file.name.split('.').pop().toLowerCase();
  if (!supported.has(extension)) throw new Error('Supported files: PDF, XLSX, XLS, CSV, TSV, TXT, PNG, JPEG, WebP, BMP, or GIF. Convert HEIC/TIFF images to PNG first.');
  return extension;
}

function boundedText(text) {
  if (text.length > MAX_TEXT_LENGTH) throw new Error('The extracted timetable is too large. Import a smaller selection of pages or sheets.');
  if (!text.trim()) throw new Error('No readable text was found. Try a clearer image or paste the timetable text.');
  return text.replace(/\u0000/g, '');
}

/** Plain tab-separated cells, never HTML or executable spreadsheet formulas. */
export function rowsToText(rows) {
  return rows.map(row => row.map(value => String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim()).join('\t')).join('\n');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 10;
}

const weekday = /^(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\.?$/i;
const timeHeader = /^\d{1,2}[:.]\d{2}(?:\s*[ap]\.?m\.?)?(?:\s*[-–—]\s*\d{1,2}[:.]\d{2}(?:\s*[ap]\.?m\.?)?)?$/i;

/** Convert positioned text runs (top-down coordinates) to reviewable lines/cells. */
export function layoutTextRuns(runs) {
  if (runs.length > 25_000) throw new Error('This page contains too many text fragments. Export only the timetable region.');
  const clean = runs.filter(run => typeof run.text === 'string' && run.text.trim() &&
    [run.x, run.y, run.width, run.height].every(Number.isFinite)).map(run => ({...run, text: run.text.trim()}));
  if (!clean.length) return '';
  const tolerance = Math.max(2, median(clean.map(run => Math.max(1, run.height))) * .42);
  const lines = [];
  for (const run of clean.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = lines[lines.length - 1];
    const line = last && Math.abs(last.y - run.y) <= tolerance ? last : null;
    if (line) line.runs.push(run);
    else lines.push({y: run.y, runs: [run]});
  }
  lines.forEach(line => line.runs.sort((a, b) => a.x - b.x));
  // Preserve blank grid cells by aligning under an identifiable day/time header.
  const header = lines.find(line => line.runs.filter(run => weekday.test(run.text)).length >= 2) ||
    lines.find(line => line.runs.filter(run => timeHeader.test(run.text)).length >= 2);
  let anchors = header?.runs.map(run => run.x + run.width / 2) || [];
  if (header && anchors.length >= 2) {
    const first = Math.min(...clean.map(run => run.x));
    if (first < header.runs[0].x - 20 && !/^(day|time|period|slot)$/i.test(header.runs[0].text)) anchors.unshift(first);
  } else anchors = [];
  return lines.map(line => {
    if (anchors.length && line.y >= header.y - tolerance) {
      const cells = anchors.map(() => []);
      for (const run of line.runs) {
        const center = run.x + run.width / 2;
        let column = 0;
        for (let index = 1; index < anchors.length; index++) {
          if (Math.abs(center - anchors[index]) < Math.abs(center - anchors[column])) column = index;
        }
        cells[column].push(run.text);
      }
      return cells.map(cell => cell.join(' ')).join('\t');
    }
    let result = '';
    let previous;
    for (const run of line.runs) {
      if (previous) {
        const gap = run.x - previous.x - previous.width;
        const characterWidth = previous.width / Math.max(1, previous.text.length);
        result += gap > Math.max(14, characterWidth * 3) ? '\t' : ' ';
      }
      result += run.text;
      previous = run;
    }
    return result;
  }).join('\n');
}

async function spreadsheetLibrary() {
  if (globalThis.XLSX) return globalThis.XLSX;
  if (!sheetScript) {
    sheetScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = localURL('./vendor/xlsx.full.min.js');
      script.onload = () => globalThis.XLSX ? resolve(globalThis.XLSX) : reject(new Error('Excel reader did not initialize.'));
      script.onerror = () => { script.remove(); reject(new Error('The local Excel reader could not load. Check that the vendor files are available.')); };
      document.head.append(script);
    }).catch(error => { sheetScript = undefined; throw error; });
  }
  return sheetScript;
}

async function readWorkbook(file, onProgress) {
  onProgress('Reading workbook locally…');
  const XLSX = await spreadsheetLibrary();
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), {type: 'array', cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, sheetRows: 501});
  } catch {
    throw new Error('This workbook could not be read. Remove password protection or save a fresh XLSX/CSV copy.');
  }
  if (workbook.SheetNames.length > MAX_SHEETS) throw new Error('Choose a workbook with no more than 10 sheets.');
  let cellCount = 0;
  const warnings = [];
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
    if (range && (range.e.r >= 500 || range.e.c >= 100)) throw new Error('Each timetable sheet must fit within 500 rows and 100 columns. Remove unrelated workbook data first.');
    const rows = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: false, defval: '', blankrows: false});
    cellCount += rows.reduce((count, row) => count + row.length, 0);
    if (cellCount > MAX_CELLS) throw new Error('This workbook contains too many cells. Keep only the timetable (20,000 cells maximum).');
    if (Object.values(sheet).some(cell => cell && typeof cell === 'object' && typeof cell.f === 'string')) warnings.push('Formula cells are read as saved values only; formulas and macros are never executed.');
    return rowsToText(rows);
  });
  if (workbook.SheetNames.length > 1) warnings.push('Multiple sheets were read. Review the detected rows and remove other sections or student groups.');
  return {text: boundedText(sheets.join('\n\n')), warnings: [...new Set(warnings)]};
}

function timeout(promise, message, milliseconds = 120_000, signal) {
  let timer;
  let stop;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
    stop = () => reject(new Error('Timetable reading was cancelled.'));
    if (signal?.aborted) stop();
    else signal?.addEventListener('abort', stop, {once: true});
  })]).finally(() => { clearTimeout(timer); signal?.removeEventListener('abort', stop); });
}

function imageScale(width, height) {
  if (!width || !height || width * height > MAX_SOURCE_PIXELS) throw new Error('Image is too large. Resize it below 40 megapixels first.');
  return Math.min(2, MAX_EDGE / width, MAX_EDGE / height, Math.sqrt(MAX_RENDER_PIXELS / (width * height)));
}

async function decodeImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be opened. Save it as a clear PNG or JPEG and try again.'); });
  try {
    const scale = imageScale(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare an image for OCR.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { bitmap.close(); }
}

function ocrRuns(data) {
  const runs = [];
  for (const block of data.blocks || []) for (const paragraph of block.paragraphs || []) for (const line of paragraph.lines || []) {
    for (const word of line.words || []) {
      const box = word.bbox;
      if (box) runs.push({text: word.text || '', x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0});
    }
  }
  return runs;
}

function makeOCR(onProgress, signal) {
  let worker;
  let pending;
  let closed = false;
  async function getWorker() {
    if (!pending) {
      pending = import('./vendor/tesseract/tesseract.esm.min.js').then(module => {
        // The pinned browser build exports the Tesseract API as its default.
        const createWorker = module.createWorker || module.default?.createWorker;
        if (!createWorker) throw new Error('The local OCR reader could not initialize.');
        return createWorker('eng', 1, {
        workerPath: localURL('./vendor/tesseract/worker.min.js'),
        corePath: localURL('./vendor/tesseract/core/'),
        langPath: localURL('./vendor/tesseract/lang/').replace(/\/$/, ''),
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: message => { if (!closed && message.status) onProgress(`OCR: ${message.status}${Number.isFinite(message.progress) ? ` (${Math.round(message.progress * 100)}%)` : ''}`); }
        });
      }).then(async created => {
        worker = created;
        if (closed) { await worker.terminate(); throw new Error('OCR was stopped.'); }
        await worker.setParameters({preserve_interword_spaces: '1', user_defined_dpi: '150'});
        return worker;
      });
    }
    return timeout(pending, 'OCR could not initialize. Check the local OCR assets or paste the timetable text.', 120_000, signal);
  }
  return {
    async recognize(canvas) {
      const engine = await getWorker();
      const {data} = await timeout(engine.recognize(canvas, {}, {text: true, blocks: true}), 'OCR took too long. Crop the image to the timetable and try again.', 120_000, signal);
      const positioned = layoutTextRuns(ocrRuns(data));
      return positioned || data.text || '';
    },
    async close() { closed = true; if (worker) { await worker.terminate().catch(() => {}); worker = null; } }
  };
}

async function readPDF(file, onProgress, signal) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 1024)).indexOf('%PDF-') < 0) throw new Error('This file is not a valid PDF. Export the timetable as PDF again.');
  const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = localURL('./vendor/pdfjs/pdf.worker.mjs');
  const task = pdfjs.getDocument({data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: true,
    cMapUrl: localURL('./vendor/pdfjs/cmaps/'), cMapPacked: true, standardFontDataUrl: localURL('./vendor/pdfjs/standard_fonts/'), wasmUrl: localURL('./vendor/pdfjs/wasm/')});
  const ocr = makeOCR(onProgress, signal);
  const warnings = [];
  try {
    const pdf = await timeout(task.promise, 'PDF reading took too long. Try a smaller PDF.', 120_000, signal);
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error('Choose a PDF with no more than 20 pages. Export just your timetable pages.');
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      onProgress(`Reading PDF page ${number} of ${pdf.numPages} locally…`);
      const page = await timeout(pdf.getPage(number), 'PDF page could not be read.', 120_000, signal);
      try {
        const content = await timeout(page.getTextContent(), 'PDF text could not be read.', 120_000, signal);
        const runs = content.items.filter(item => typeof item.str === 'string').map(item => ({text: item.str,
          x: item.transform[4], y: -item.transform[5], width: item.width, height: Math.max(item.height, 1)}));
        let text = layoutTextRuns(runs);
        if (text.replace(/\s/g, '').length < 20) {
          warnings.push('Scanned PDF pages were read with English OCR. Check every subject, weekday, and time before importing.');
          const natural = page.getViewport({scale: 1});
          const scale = Math.min(2, MAX_EDGE / natural.width, MAX_EDGE / natural.height, Math.sqrt(MAX_RENDER_PIXELS / (natural.width * natural.height)));
          const viewport = page.getViewport({scale});
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
          try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('This browser cannot render scanned PDF pages.');
            await timeout(page.render({canvasContext: context, viewport}).promise, 'PDF rendering took too long. Try a smaller page.', 120_000, signal);
            text = await ocr.recognize(canvas);
          } finally { canvas.width = canvas.height = 0; }
        }
        pages.push(text);
        if (pages.join('\n').length > MAX_TEXT_LENGTH) throw new Error('PDF text is too large. Export only your timetable pages.');
      } finally { page.cleanup(); }
    }
    return {text: boundedText(pages.join('\n\n')), warnings: [...new Set(warnings)]};
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('This PDF is password protected. Export an unlocked copy and try again.');
    if (/InvalidPDF|MissingPDF|UnexpectedResponse/.test(error.name)) throw new Error('This PDF could not be read. Export a fresh copy and try again.');
    throw error;
  } finally { await ocr.close(); await task.destroy().catch(() => {}); }
}

/** Read one local file. Progress is descriptive text, not a promise of accurate recognition. */
export async function readTimetableFile(file, {onProgress = () => {}, signal} = {}) {
  if (signal?.aborted) throw new Error('Timetable reading was cancelled.');
  const extension = validateImportFile(file);
  if (['txt', 'csv', 'tsv'].includes(extension)) return {text: boundedText(await file.text()), warnings: []};
  if (extension === 'pdf') return readPDF(file, onProgress, signal);
  if (extension === 'xlsx' || extension === 'xls') return readWorkbook(file, onProgress);
  onProgress('Preparing image for local English OCR…');
  const canvas = await decodeImage(file);
  const ocr = makeOCR(onProgress, signal);
  try {
    return {text: boundedText(await ocr.recognize(canvas)), warnings: [
      'Image text was read with English OCR. Review every detected subject, weekday, and time; photos, rotation, merged cells, and handwriting may need corrections.',
      ...(extension === 'gif' ? ['Only the first frame of this GIF was read.'] : [])
    ]};
  } finally { canvas.width = canvas.height = 0; await ocr.close(); }
}
