import { buildOfficialDocument, parseFiscalXml } from "./fiscal-layouts.js?v=54";

const API_URL = "/api/consultar-chave";
const ACCEPTED_UPLOAD_EXTENSIONS = [".xml", ".txt", ".doc", ".docx"];
const MAX_UPLOAD_FILES = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_SIZE_BYTES = 50 * 1024 * 1024;

let pdfUrl = "";
let xmlUrl = "";
let batchActive = false;
let internalSingleDispatch = false;
let batchDocuments = [];
let localStatisticsDocuments = [];
let singleDocumentGeneration = 0;
const loadedScripts = new Map();

function hasAcceptedUploadExtension(fileName = "") {
  const lower = String(fileName).toLowerCase();
  return ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function ensureUploadWordStyles() {
  if (document.querySelector('#upload-word-styles')) return;
  const style = document.createElement('style');
  style.id = 'upload-word-styles';
  style.textContent = `
    .upload-word-badge,
    .upload-word-highlight {
      color: #2563eb;
      font-size: 1.22em;
      font-weight: 900;
      letter-spacing: .04em;
    }
    .upload-format-note {
      margin-top: 12px;
      text-align: center;
      color: #334155;
      font-size: 14px;
      line-height: 1.45;
    }
    .upload-format-note .word {
      color: #2563eb;
      font-size: 1.26em;
      font-weight: 900;
      letter-spacing: .04em;
    }
  `;
  document.head.append(style);
}

function releaseDownloads() {
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  if (xmlUrl) URL.revokeObjectURL(xmlUrl);
  pdfUrl = "";
  xmlUrl = "";
}

function base64ToBlob(value, mimeType) {
  const clean = String(value || "")
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s/g, "");
  const binary = atob(clean);
  const chunks = [];

  for (let offset = 0; offset < binary.length; offset += 8_192) {
    const part = binary.slice(offset, offset + 8_192);
    const bytes = new Uint8Array(part.length);
    for (let index = 0; index < part.length; index += 1) {
      bytes[index] = part.charCodeAt(index);
    }
    chunks.push(bytes);
  }

  return new Blob(chunks, { type: mimeType });
}

function normalizeKey(value) {
  return value.replace(/\D/g, "").slice(0, 44);
}

function updatePrivacyBar(mode) {
  const bar = document.querySelector(".privacy-bar");
  if (!bar) return;

  const title = bar.querySelector("strong");
  const text = bar.querySelector("p");
  const badge = bar.querySelector(".status-pill");
  if (!title || !text || !badge) return;

  if (mode === "key") {
    title.textContent = "Consulta protegida pelo servidor";
    text.lastChild.textContent = "A chave é enviada ao serviço MeuDanfe somente para localizar a NF-e ou o CT-e.";
    badge.textContent = "Servidor";
  } else {
    title.textContent = "Seus dados ficam protegidos";
    text.lastChild.textContent = "O XML é processado localmente e não fica armazenado.";
    badge.textContent = "Privado";
  }
}

function showMode(mode) {
  document.body.dataset.consultaMode = mode;

  const tabs = document.querySelectorAll(".tabs button");
  const xmlPanel = document.querySelector(".tool-panel");
  const keyPanel = document.querySelector("#key-query-panel");
  const batchPanel = document.querySelector("#batch-panel");
  if (tabs.length < 2 || !xmlPanel || !keyPanel) return;

  const keyMode = mode === "key";
  xmlPanel.hidden = keyMode || batchActive;
  keyPanel.hidden = !keyMode;
  if (batchPanel) batchPanel.hidden = keyMode || !batchActive;

  tabs[0].classList.toggle("active", !keyMode);
  tabs[0].setAttribute("aria-selected", String(!keyMode));
  tabs[1].classList.toggle("active", keyMode);
  tabs[1].setAttribute("aria-selected", String(keyMode));

  updatePrivacyBar(mode);

  if (keyMode) {
    keyPanel.querySelector("input")?.focus();
  }
}

async function describeXmlFile(file) {
  if (!hasAcceptedUploadExtension(file.name)) {
    throw new Error("Envie XML, TXT ou arquivo Word com conteúdo XML fiscal.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("O arquivo ultrapassa o limite de 10 MB.");
  }
  const xml = await file.text();
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("O XML contém uma declaração não permitida.");
  }

  if (!/[<][A-Za-z!?/]/.test(xml)) {
    throw new Error("Não foi possível ler o conteúdo XML do arquivo enviado.");
  }

  let fiscalDocument;
  try {
    fiscalDocument = parseFiscalXml(xml);
  } catch (error) {
    const lower = String(file.name || "").toLowerCase();
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
      throw new Error("O arquivo Word precisa conter XML fiscal em texto para ser lido.");
    }
    throw error;
  }

  const type = fiscalDocument.kind === "cte" ? "CT-e" : "NF-e";
  const key = fiscalDocument.accessKey;
  if (key.length !== 44) {
    throw new Error("Não foi possível identificar a chave de acesso no XML.");
  }

  const isXmlName = file.name.toLowerCase().endsWith(".xml");
  const baseName = file.name.replace(/\.[^.]+$/, "") || "documento-fiscal";
  const renderFile = isXmlName
    ? file
    : new File([xml], `${baseName}.xml`, { type: "application/xml", lastModified: file.lastModified || Date.now() });

  return { file, renderFile, key, type, fiscalDocument };
}

function waitForRenderedDocument(descriptor, timeoutMs = 8_000) {
  const selector = descriptor.type === "CT-e" ? ".dacte-print" : ".danfe-print";
  const keySelector = descriptor.type === "CT-e" ? ".dacte-access strong" : ".danfe-access strong";
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const node = document.querySelector(`#root ${selector}`);
      const renderedKey = String(node?.querySelector(keySelector)?.textContent || "").replace(/\D/g, "");
      const barcodeReady = Boolean(node?.querySelector(`${selector === ".dacte-print" ? ".dacte-access" : ".danfe-access"} svg`));
      const qrReady = descriptor.type !== "CT-e"
        || !descriptor.fiscalDocument?.qrCode
        || Boolean(node?.querySelector(".dacte-qr img"));

      if (node && renderedKey.includes(descriptor.key) && barcodeReady && qrReady) {
        resolve(node);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("O documento demorou demais para ser montado."));
        return;
      }

      window.setTimeout(check, 60);
    };

    check();
  });
}

function waitForFileInput(timeoutMs = 2_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const input = document.querySelector(".tool-panel .file-input");
      if (input) {
        resolve(input);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Não foi possível preparar o próximo arquivo."));
        return;
      }

      window.setTimeout(check, 40);
    };

    check();
  });
}

async function renderFileWithExistingTool(descriptor) {
  let input = document.querySelector(".tool-panel .file-input");
  if (!input) {
    document.querySelector(".tool-panel .change-xml-button")?.click();
    input = await waitForFileInput();
  }

  const transfer = new DataTransfer();
  transfer.items.add(descriptor.renderFile || descriptor.file);
  internalSingleDispatch = true;
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  internalSingleDispatch = false;

  return waitForRenderedDocument(descriptor);
}

function ensureSinglePrintContainer() {
  let container = document.querySelector("#single-official-print-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "single-official-print-container";
    container.setAttribute("aria-hidden", "true");
    document.body.append(container);
  }
  return container;
}

function syncPrintStartOrientation(container, documentNode) {
  if (!container) return;
  const landscape = Boolean(
    documentNode?.classList?.contains("fiscal-landscape-print") ||
    documentNode?.querySelector?.(".fiscal-sheet.fiscal-landscape"),
  );
  const portrait = Boolean(documentNode) && !landscape;
  container.classList.toggle("print-start-landscape", landscape);
  container.classList.toggle("print-start-portrait", portrait);
}

async function prepareSingleOfficialDocument(file) {
  const generation = ++singleDocumentGeneration;
  const container = ensureSinglePrintContainer();
  container.replaceChildren();
  document.body.classList.remove("official-print-ready");

  try {
    const descriptor = await describeXmlFile(file);
    const isNativeXml = file.name.toLowerCase().endsWith(".xml");
    const rendered = isNativeXml
      ? await waitForRenderedDocument(descriptor)
      : await renderFileWithExistingTool(descriptor);
    if (generation !== singleDocumentGeneration) return;

    const officialDocument = buildOfficialDocument(descriptor.fiscalDocument, rendered);
    syncPrintStartOrientation(container, officialDocument);
    container.replaceChildren(officialDocument);
    document.body.classList.add("official-print-ready");
    updateLocalStatistics([descriptor.fiscalDocument]);
  } catch {
    if (generation === singleDocumentGeneration) {
      container.replaceChildren();
      syncPrintStartOrientation(container, null);
      document.body.classList.remove("official-print-ready");
      clearLocalStatistics();
    }
  }
}

function buildBatchPanel() {
  const panel = document.createElement("section");
  panel.id = "batch-panel";
  panel.className = "batch-panel";
  panel.hidden = true;
  panel.setAttribute("role", "tabpanel");
  panel.innerHTML = `
    <div class="panel-heading">
      <span class="panel-number">+</span>
      <div>
        <h2>Processamento em lote</h2>
        <p id="batch-progress">Preparando arquivos…</p>
      </div>
    </div>
    <p id="batch-large-warning" class="batch-large-warning" hidden>Lotes grandes podem deixar o navegador mais lento por alguns segundos.</p>
    <div id="batch-file-list" class="batch-file-list" aria-live="polite"></div>
    <p id="batch-message" class="batch-message" role="status"></p>
    <div class="batch-actions">
      <button id="batch-download-pdf" class="primary-button" type="button" disabled>Baixar PDF único <span>↓</span></button>
      <button id="batch-print" class="primary-button batch-print-button" type="button" disabled>Imprimir todos <span aria-hidden="true">↗</span></button>
    </div>
    <button id="batch-clear" class="change-xml-button" type="button">Escolher outros arquivos</button>
  `;
  return panel;
}

function ensureBatchPrintContainer() {
  let container = document.querySelector("#batch-print-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "batch-print-container";
    container.setAttribute("aria-hidden", "true");
    document.body.append(container);
  }
  return container;
}

function addBatchRow(list, file) {
  const row = document.createElement("div");
  row.className = "batch-file-row is-waiting";

  const name = document.createElement("span");
  name.className = "batch-file-name";
  name.textContent = file.name;

  const status = document.createElement("span");
  status.className = "batch-file-status";
  status.textContent = "Aguardando";

  row.append(name, status);
  list.append(row);
  return { row, status };
}

function setBatchRowStatus(item, state, text) {
  item.row.className = `batch-file-row is-${state}`;
  item.status.textContent = text;
}

function resetBatch() {
  batchActive = false;
  batchDocuments = [];
  const batchPrintContainer = ensureBatchPrintContainer();
  batchPrintContainer.replaceChildren();
  syncPrintStartOrientation(batchPrintContainer, null);
  const singlePrintContainer = ensureSinglePrintContainer();
  singlePrintContainer.replaceChildren();
  syncPrintStartOrientation(singlePrintContainer, null);
  document.body.classList.remove("official-print-ready", "batch-print-mode");
  clearLocalStatistics();

  const input = document.querySelector(".file-input");
  if (input) input.value = "";
  document.querySelector(".tool-panel .change-xml-button")?.click();
  showMode("xml");
}

async function processBatchFiles(files) {
  const panel = document.querySelector("#batch-panel");
  if (!panel) return;

  const list = panel.querySelector("#batch-file-list");
  const progress = panel.querySelector("#batch-progress");
  const message = panel.querySelector("#batch-message");
  const largeWarning = panel.querySelector("#batch-large-warning");
  const downloadButton = panel.querySelector("#batch-download-pdf");
  const printButton = panel.querySelector("#batch-print");
  const clearButton = panel.querySelector("#batch-clear");
  const printContainer = ensureBatchPrintContainer();

  batchActive = true;
  batchDocuments = [];
  clearLocalStatistics();
  list.replaceChildren();
  printContainer.replaceChildren();
  syncPrintStartOrientation(printContainer, null);
  const singlePrintContainer = ensureSinglePrintContainer();
  singlePrintContainer.replaceChildren();
  syncPrintStartOrientation(singlePrintContainer, null);
  document.body.classList.remove("official-print-ready", "batch-print-mode");
  downloadButton.disabled = true;
  printButton.disabled = true;
  clearButton.disabled = true;
  message.textContent = "";
  if (largeWarning) largeWarning.hidden = files.length < 30;
  showMode("xml");

  const batchSize = files.reduce((total, file) => total + Number(file.size || 0), 0);
  if (files.length > MAX_UPLOAD_FILES || batchSize > MAX_BATCH_SIZE_BYTES) {
    progress.textContent = "Lote não processado";
    message.textContent = files.length > MAX_UPLOAD_FILES
      ? "Selecione no máximo 20 arquivos por vez."
      : "O lote ultrapassa o limite total de 50 MB.";
    if (largeWarning) largeWarning.hidden = true;
    clearButton.disabled = false;
    return;
  }

  const rows = files.map((file) => addBatchRow(list, file));
  let failures = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const row = rows[index];
    progress.textContent = `Processando ${index + 1} de ${files.length}…`;
    setBatchRowStatus(row, "processing", "Processando");

    try {
      const descriptor = await describeXmlFile(file);
      const rendered = await renderFileWithExistingTool(descriptor);
      const officialDocument = buildOfficialDocument(descriptor.fiscalDocument, rendered);
      officialDocument.classList.add("batch-print-copy");
      printContainer.append(officialDocument);
      batchDocuments.push({ ...descriptor, node: officialDocument });
      setBatchRowStatus(row, "ready", descriptor.type === "CT-e" ? "DACTE pronto" : "DANFE pronto");
    } catch (error) {
      failures += 1;
      setBatchRowStatus(row, "error", error instanceof Error ? error.message : "Falha no arquivo");
    }
  }

  const ready = batchDocuments.length;
  syncPrintStartOrientation(printContainer, batchDocuments[0]?.node || null);
  progress.textContent = failures
    ? `${ready} de ${files.length} documentos processados`
    : `${ready} documentos processados com sucesso`;
  message.textContent = failures
    ? `${failures} arquivo(s) não puderam ser processados. Os demais continuam disponíveis.`
    : "Tudo pronto. Baixe um PDF único ou abra a impressão em lote.";
  downloadButton.disabled = ready === 0;
  printButton.disabled = ready === 0;
  clearButton.disabled = false;
  updateLocalStatistics(batchDocuments.map((descriptor) => descriptor.fiscalDocument));
}

function loadScript(source, readyCheck) {
  if (readyCheck()) return Promise.resolve();
  if (loadedScripts.has(source)) return loadedScripts.get(source);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.async = true;
    script.addEventListener("load", () => readyCheck() ? resolve() : reject(new Error("Biblioteca indisponível.")));
    script.addEventListener("error", () => reject(new Error("Não foi possível carregar o gerador de PDF.")));
    document.head.append(script);
  });

  loadedScripts.set(source, promise);
  return promise;
}

async function loadPdfLibraries() {
  await Promise.all([
    loadScript("/vendor/html2canvas-1.4.1.min.js", () => typeof window.html2canvas === "function"),
    loadScript("/vendor/jspdf-4.2.1.umd.min.js", () => Boolean(window.jspdf?.jsPDF)),
  ]);
}

function sheetOrientation(sheet) {
  return sheet?.classList?.contains("fiscal-landscape") ? "landscape" : "portrait";
}

function requiresPdfPrintFallback(userAgent = navigator.userAgent) {
  const value = String(userAgent || "");
  const legacyWindows = /Windows NT 6\.[123]/i.test(value);
  const chromeVersion = Number(value.match(/(?:Chrome|Chromium)\/(\d+)/i)?.[1] || 0);
  return legacyWindows || (chromeVersion > 0 && chromeVersion < 110);
}


function waitForIsolatedPrintFrame(frame) {
  const frameDocument = frame.contentDocument;
  if (!frameDocument) return Promise.reject(new Error("Não foi possível preparar a impressão."));

  const styles = [...frameDocument.querySelectorAll('link[rel="stylesheet"]')];
  const stylesheetReady = Promise.all(styles.map((link) => {
    if (link.sheet) return Promise.resolve();
    return new Promise((resolve) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true });
      window.setTimeout(resolve, 2_500);
    });
  }));

  return stylesheetReady.then(async () => {
    try {
      await frameDocument.fonts?.ready;
    } catch {
      // A impressão pode continuar mesmo se uma fonte opcional não carregar.
    }
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  });
}

function isolatedPrintCss({ single = false, orientation = "portrait", lockOrientation = false } = {}) {
  const landscape = orientation === "landscape";
  const forcePageSize = single || lockOrientation;
  const pageSize = forcePageSize ? `size: A4 ${landscape ? "landscape" : "portrait"};` : "size: auto;";
  const sheetWidth = landscape ? "297mm" : "210mm";
  const sheetHeight = landscape ? "210mm" : "297mm";

  const pageRules = forcePageSize
    ? `@page { margin: 0; ${pageSize} }`
    : `
      @page { margin: 8mm; size: A4 portrait; }
      @page fiscal-portrait { margin: 8mm; size: A4 portrait; }
      @page fiscal-landscape { margin: 8mm; size: A4 landscape; }
    `;

  return `
    ${pageRules}
    html, body {
      background: #fff !important;
      margin: 0 !important;
      min-height: 0 !important;
      padding: 0 !important;
      width: auto !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body.fiscal-isolated-print {
      display: block !important;
    }
    body.fiscal-isolated-print .fiscal-standard-print {
      background: #fff !important;
      display: block !important;
      left: auto !important;
      margin: 0 !important;
      min-height: 0 !important;
      position: static !important;
      top: auto !important;
    }
    ${forcePageSize ? `
    body.fiscal-isolated-print .fiscal-standard-print {
      page: auto !important;
      width: ${sheetWidth} !important;
    }
    body.fiscal-isolated-print .fiscal-sheet {
      height: ${sheetHeight} !important;
      min-height: ${sheetHeight} !important;
      width: ${sheetWidth} !important;
    }` : `
    body.fiscal-isolated-print .fiscal-portrait-print,
    body.fiscal-isolated-print .fiscal-sheet.fiscal-portrait,
    body.fiscal-isolated-print .fiscal-sheet.fiscal-portrait {
      page: fiscal-portrait !important;
    }
    body.fiscal-isolated-print .fiscal-landscape-print,
    body.fiscal-isolated-print .fiscal-sheet.fiscal-landscape {
      page: fiscal-landscape !important;
    }
    body.fiscal-isolated-print .fiscal-sheet.fiscal-portrait,
    body.fiscal-isolated-print .fiscal-sheet.fiscal-portrait {
      width: 194mm !important;
      min-width: 194mm !important;
      height: 280mm !important;
      min-height: 280mm !important;
    }
    body.fiscal-isolated-print .fiscal-sheet.fiscal-landscape {
      width: 280mm !important;
      min-width: 280mm !important;
      height: 193mm !important;
      min-height: 193mm !important;
    }
    body.fiscal-isolated-print .fiscal-standard-print.fiscal-landscape-print {
      width: 280mm !important;
    }`}
    body.fiscal-isolated-print .fiscal-sheet {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    body.fiscal-isolated-print .fiscal-sheet + .fiscal-sheet,
    body.fiscal-isolated-print > .fiscal-standard-print + .fiscal-standard-print .fiscal-sheet:first-child {
      break-before: page !important;
      page-break-before: always !important;
    }
    body.fiscal-isolated-print > .fiscal-standard-print:last-child .fiscal-sheet:last-child {
      break-after: auto !important;
      page-break-after: auto !important;
    }
    body.fiscal-isolated-print .cte-print {
      display: block !important;
      margin: 0 !important;
      page: fiscal-portrait !important;
      width: 190mm !important;
    }
    body.fiscal-isolated-print .cte-sheet {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      min-height: 277mm !important;
      margin: 0 !important;
      width: 190mm !important;
    }
    body.fiscal-isolated-print > .cte-print + .cte-print .cte-sheet {
      break-before: page !important;
      page-break-before: always !important;
    }

    /* Chrome/Edge: centralização explícita. O Chrome pode ignorar margin:auto
       em conteúdo paginado, então usamos margens físicas iguais dos dois lados. */
    body.fiscal-isolated-print.browser-chrome .fiscal-standard-print {
      width: 190mm !important;
      margin-left: ${forcePageSize ? "10mm" : "2mm"} !important;
      margin-right: ${forcePageSize ? "10mm" : "2mm"} !important;
    }
    body.fiscal-isolated-print.browser-chrome .fiscal-sheet.fiscal-portrait,
    body.fiscal-isolated-print.browser-chrome .cte-sheet {
      width: 190mm !important;
      min-width: 190mm !important;
      height: 276mm !important;
      min-height: 276mm !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
    }
    /* Chrome/Edge horizontal: mantém o DANFE inteiro em 280x193 mm e
       reduz o CONJUNTO no @media print. Assim os blocos internos de 193 mm
       não ficam maiores que a folha externa e a borda inferior não é cortada. */
    @media print {
      body.fiscal-isolated-print.browser-chrome .fiscal-standard-print.fiscal-landscape-print {
        width: 280mm !important;
        height: 193mm !important;
        min-height: 193mm !important;
        margin: 0 !important;
        overflow: visible !important;
      }
      body.fiscal-isolated-print.browser-chrome .fiscal-sheet.fiscal-landscape {
        width: 280mm !important;
        min-width: 280mm !important;
        height: 193mm !important;
        min-height: 193mm !important;
        margin: 0 !important;
        transform: translate(3.3mm, 1.5mm) scale(0.98) !important;
        transform-origin: top left !important;
      }
      body.fiscal-isolated-print.browser-chrome .fiscal-sheet.fiscal-landscape .official-landscape-main,
      body.fiscal-isolated-print.browser-chrome .fiscal-sheet.fiscal-landscape .official-landscape-receipt {
        height: 193mm !important;
        min-height: 193mm !important;
      }
    }

    /* Firefox: fecha as larguras da tabela em 100% exatos. Antes a soma
       ficava em 92% e o Firefox redistribuía o espaço restante no preview,
       deixando a descrição larga demais. */
    body.fiscal-isolated-print.browser-firefox .official-products {
      table-layout: fixed !important;
      width: 100% !important;
      border-collapse: collapse !important;
    }
    body.fiscal-isolated-print.browser-firefox .official-products th,
    body.fiscal-isolated-print.browser-firefox .official-products td {
      border: 0.30mm solid #000 !important;
    }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(1) { width: 7% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(2) { width: 16% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(3) { width: 7% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(4) { width: 5% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(5) { width: 6% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(6) { width: 4% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(7) { width: 8% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(8) { width: 9% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(9) { width: 9% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(10) { width: 8% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(11) { width: 6% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(12) { width: 5% !important; }
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(13),
    body.fiscal-isolated-print.browser-firefox .official-products th:nth-child(14) { width: 5% !important; }
  `;
}

async function printFiscalDocumentsIsolated(documentNodes, { single = false, forcedOrientation = null, waitForAfterPrint = false } = {}) {
  const nodes = documentNodes.filter(Boolean);
  if (!nodes.length) throw new Error("Documento fiscal ainda não está pronto para impressão.");

  const firstSheet = nodes[0].querySelector(".danfe-sheet, .cte-sheet") || nodes[0];
  const orientation = forcedOrientation || sheetOrientation(firstSheet);
  const landscape = orientation === "landscape";
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "Área temporária de impressão do documento fiscal");
  frame.style.cssText = `position:fixed;left:-12000px;top:0;width:${landscape ? "320mm" : "230mm"};height:320mm;border:0;opacity:0;pointer-events:none;`;
  document.body.append(frame);

  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    throw new Error("Não foi possível abrir a área de impressão.");
  }

  const stylesheetUrl = new URL("/chave-access.css?v=101", window.location.href).href;
  const cteStylesheetUrl = new URL("/cte.css?v=1", window.location.href).href;
  const userAgent = navigator.userAgent || "";
  const browserClass = /Firefox\//i.test(userAgent)
    ? "browser-firefox"
    : /(?:Chrome|Chromium|Edg)\//i.test(userAgent)
      ? "browser-chrome"
      : "browser-other";

  frameDocument.open();
  frameDocument.write(`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documento fiscal</title>
        <link rel="stylesheet" href="${stylesheetUrl}">
        <link rel="stylesheet" href="${cteStylesheetUrl}">
        <style>${isolatedPrintCss({ single, orientation, lockOrientation: Boolean(forcedOrientation) })}</style>
      </head>
      <body class="fiscal-isolated-print ${browserClass}">${nodes.map((node) => node.outerHTML).join("")}</body>
    </html>`);
  frameDocument.close();

  await waitForIsolatedPrintFrame(frame);

  const frameWindow = frame.contentWindow;
  if (!frameWindow) {
    frame.remove();
    throw new Error("Não foi possível iniciar a impressão.");
  }

  let cleaned = false;
  let finishPrint;
  const printFinished = new Promise((resolve) => {
    finishPrint = resolve;
  });
  const clean = () => {
    if (cleaned) return;
    cleaned = true;
    finishPrint();
    window.setTimeout(() => frame.remove(), 250);
  };

  frameWindow.addEventListener("afterprint", clean, { once: true });
  window.setTimeout(clean, 120_000);
  frameWindow.focus();
  frameWindow.print();

  if (waitForAfterPrint) await printFinished;
}

function currentSingleOfficialDocument() {
  return document.querySelector("#single-official-print-container .fiscal-standard-print, #single-official-print-container .cte-print")
    || document.querySelector("#root .fiscal-standard-print, #root .cte-print")
    || document.querySelector("#root .danfe-print, #root .cte-print");
}


let pdfCaptureFrame = null;
let pdfCaptureFrameReady = null;

function ensurePdfCaptureFrame() {
  if (pdfCaptureFrame && pdfCaptureFrame.isConnected && pdfCaptureFrameReady) {
    return pdfCaptureFrameReady.then(() => pdfCaptureFrame);
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "Área isolada para gerar o PDF");
  frame.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    "width:210mm",
    "height:297mm",
    "border:0",
    "background:#fff",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
  document.body.append(frame);

  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    return Promise.reject(new Error("Não foi possível preparar a página do PDF."));
  }

  const stylesheetUrl = new URL("/chave-access.css?v=101", window.location.href).href;
  const cteStylesheetUrl = new URL("/cte.css?v=1", window.location.href).href;
  frameDocument.open();
  frameDocument.write(`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${stylesheetUrl}">
        <link rel="stylesheet" href="${cteStylesheetUrl}">
        <style id="pdf-capture-layout"></style>
      </head>
      <body></body>
    </html>`);
  frameDocument.close();

  pdfCaptureFrame = frame;
  pdfCaptureFrameReady = waitForIsolatedPrintFrame(frame).then(() => frame);
  return pdfCaptureFrameReady;
}


function replaceLandscapeReceiptTextWithCanvas(frameDocument) {
  const receiptText = frameDocument.querySelector(
    ".fiscal-sheet.fiscal-landscape .official-landscape-receipt-text",
  );
  if (!receiptText) return;

  const message = String(receiptText.textContent || "").replace(/\s+/g, " ").trim();
  if (!message) return;

  // O html2canvas/Chrome pode perder ou recortar texto rotacionado com CSS.
  // Desenhamos a frase lateral em um canvas real, já rotacionada, para que
  // ela seja incorporada ao PDF exatamente como aparece no DANFE tipo 2.
  const cssWidth = 49;   // ~13 mm a 96 dpi
  const cssHeight = 680; // ~180 mm a 96 dpi (abaixo do bloco NOTA FISCAL)
  const pixelRatio = 3;
  const canvas = frameDocument.createElement("canvas");
  canvas.className = "official-landscape-receipt-canvas";
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  canvas.style.cssText = "display:block;width:100%;height:100%;margin:0;padding:0;background:#fff";

  const context = canvas.getContext("2d");
  if (!context) return;

  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = "#000";
  context.textAlign = "center";
  context.textBaseline = "middle";

  // Depois da rotação, a largura útil da frase passa a ser a altura da faixa.
  const maxLineWidth = cssHeight - 14;
  let fontPx = 5.6; // ~4,2 pt
  while (fontPx > 4.2) {
    context.font = `${fontPx}px Arial, Helvetica, sans-serif`;
    if (context.measureText(message).width <= maxLineWidth) break;
    fontPx -= 0.2;
  }

  context.save();
  context.translate(0, cssHeight);
  context.rotate(-Math.PI / 2);
  context.font = `${fontPx}px Arial, Helvetica, sans-serif`;
  context.fillText(message, cssHeight / 2, cssWidth / 2, maxLineWidth);
  context.restore();

  receiptText.replaceWith(canvas);
}

async function captureFiscalSheetCanvas(sheet, scale = 1.7) {
  if (!sheet) throw new Error("Página fiscal inválida para o PDF.");

  const orientation = sheetOrientation(sheet);
  const landscape = orientation === "landscape";
  const frame = await ensurePdfCaptureFrame();
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error("Não foi possível preparar a página do PDF.");

  frame.style.width = landscape ? "297mm" : "210mm";
  frame.style.height = landscape ? "210mm" : "297mm";

  const layoutStyle = frameDocument.querySelector("#pdf-capture-layout");
  if (layoutStyle) {
    layoutStyle.textContent = `
      html, body {
        background: #fff !important;
        color: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        min-height: 0 !important;
      }
      body {
        width: ${landscape ? "297mm" : "210mm"} !important;
        height: ${landscape ? "210mm" : "297mm"} !important;
        overflow: hidden !important;
      }
      .fiscal-sheet {
        display: ${landscape ? "grid" : "flex"} !important;
        margin: 0 !important;
        position: static !important;
      }
      .fiscal-sheet.fiscal-portrait {
        width: 210mm !important;
        min-width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
      }
      .cte-sheet {
        width: 190mm !important;
        min-width: 190mm !important;
        min-height: 277mm !important;
      }
      .fiscal-sheet.fiscal-landscape {
        width: 297mm !important;
        min-width: 297mm !important;
        height: 210mm !important;
        min-height: 210mm !important;
        grid-template-columns: 13mm 1fr !important;
        gap: 0 !important;
      }
      .official-landscape-main,
      .official-landscape-receipt {
        height: 210mm !important;
        min-height: 210mm !important;
      }
      /* DANFE tipo 2: o html2canvas recorta writing-mode vertical em alguns
         navegadores. Para o PDF em lote, usamos texto horizontal e giramos
         o bloco inteiro 90 graus dentro da faixa lateral. */
      .fiscal-sheet.fiscal-landscape .official-landscape-receipt {
        position: relative !important;
        overflow: hidden !important;
      }
      .fiscal-sheet.fiscal-landscape .official-landscape-receipt-text {
        box-sizing: border-box !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: absolute !important;
        width: 176mm !important;
        height: 11mm !important;
        left: -81.5mm !important;
        top: 114.5mm !important;
        padding: 0.8mm 1.2mm !important;
        margin: 0 !important;
        overflow: hidden !important;
        white-space: normal !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        transform: rotate(-90deg) !important;
        transform-origin: center center !important;
        font-size: 4.2pt !important;
        line-height: 1.12 !important;
      }
    `;
  }

  frameDocument.body.innerHTML = sheet.outerHTML;
  if (landscape) replaceLandscapeReceiptTextWithCanvas(frameDocument);
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

  const safeSheet = frameDocument.querySelector(".danfe-sheet, .cte-sheet, .fiscal-sheet") || frameDocument.body.firstElementChild;
  if (!safeSheet) throw new Error("Não foi possível localizar a página fiscal para o PDF.");

  return await window.html2canvas(safeSheet, {
    backgroundColor: "#ffffff",
    logging: false,
    scale,
    useCORS: true,
  });
}

function appendCanvasPage(pdf, canvas, hasPage, orientation) {
  const landscape = orientation === "landscape";
  const pageWidthMm = landscape ? 297 : 210;
  const pageHeightMm = landscape ? 210 : 297;

  // Firefox volta ao padrão que já funcionava bem para NF-e: 8 mm e sem
  // moldura externa. Chrome/Edge mantêm margem maior para evitar corte visual.
  const isFirefox = /Firefox\//i.test(navigator.userAgent);
  const marginMm = isFirefox ? 8 : 12;
  const imageWidthMm = pageWidthMm - (marginMm * 2);
  const imageHeightMm = pageHeightMm - (marginMm * 2);

  if (hasPage.value) pdf.addPage("a4", orientation);
  hasPage.value = true;
  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.94),
    "JPEG",
    marginMm,
    marginMm,
    imageWidthMm,
    imageHeightMm,
    undefined,
    "FAST",
  );

  if (!isFirefox) {
    const borderInsetMm = 4;
    pdf.setDrawColor(160, 160, 160);
    pdf.setLineWidth(0.25);
    pdf.rect(
      borderInsetMm,
      borderInsetMm,
      pageWidthMm - (borderInsetMm * 2),
      pageHeightMm - (borderInsetMm * 2),
    );
  }
}

async function downloadBatchPdf(panel, compatibilityMode = false) {
  if (!batchDocuments.length) return;

  const button = panel.querySelector("#batch-download-pdf");
  const printButton = panel.querySelector("#batch-print");
  const message = panel.querySelector("#batch-message");
  const originalText = button.firstChild.textContent;
  button.disabled = true;
  printButton.disabled = true;

  try {
    await loadPdfLibraries();
    const { jsPDF } = window.jspdf;
    const firstSheet = batchDocuments[0]?.node.querySelector(".danfe-sheet, .cte-sheet");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: sheetOrientation(firstSheet), compress: true });
    const hasPage = { value: false };

    for (let index = 0; index < batchDocuments.length; index += 1) {
      button.firstChild.textContent = `Gerando ${index + 1}/${batchDocuments.length} `;
      message.textContent = "O PDF está sendo montado localmente. Mantenha esta página aberta.";
      const sheets = [...batchDocuments[index].node.querySelectorAll(".danfe-sheet, .cte-sheet")];
      for (const sheet of sheets.length ? sheets : [batchDocuments[index].node]) {
        const canvas = await captureFiscalSheetCanvas(sheet, 1.7);
        appendCanvasPage(pdf, canvas, hasPage, sheetOrientation(sheet));
        canvas.width = 1;
        canvas.height = 1;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`documentos-fiscais-${date}.pdf`);
    message.textContent = compatibilityMode
      ? "PDF compatível baixado. Abra o arquivo e imprima normalmente."
      : "PDF gerado e baixado com sucesso.";
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Não foi possível gerar o PDF.";
  } finally {
    button.firstChild.textContent = originalText;
    button.disabled = false;
    printButton.disabled = false;
  }
}

function preparePdfViewerTab() {
  const viewer = window.open("", "_blank");
  if (!viewer) return null;

  try {
    viewer.document.open();
    viewer.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Preparando PDF…</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            p { line-height: 1.5; }
          </style>
        </head>
        <body>
          <p><strong>Preparando PDF único…</strong></p>
          <p>Aguarde. O PDF será aberto nesta aba assim que estiver pronto.</p>
        </body>
      </html>`);
    viewer.document.close();
    viewer.focus();
  } catch {
    // A aba já foi criada pelo clique do usuário; ainda podemos navegar para o blob.
  }

  return viewer;
}

async function printBatchDocuments(panel) {
  if (!batchDocuments.length) return;

  const message = panel.querySelector("#batch-message");
  const printButton = panel.querySelector("#batch-print");
  const originalText = printButton.firstChild?.textContent || "Imprimir todos ";

  const documents = batchDocuments
    .map((item) => item?.node)
    .filter(Boolean);

  if (!documents.length) {
    message.textContent = "Nenhum documento está pronto para impressão.";
    return;
  }

  printButton.disabled = true;
  if (printButton.firstChild) printButton.firstChild.textContent = "Preparando impressão ";
  message.textContent = `Preparando ${documents.length} documento${documents.length === 1 ? "" : "s"} em um único trabalho de impressão…`;

  try {
    // v46: imprime o HTML fiscal diretamente. Nada é convertido para canvas,
    // JPEG ou PDF intermediário. As páginas usam @page nomeadas para manter
    // DANFE vertical em A4 retrato e DANFE tipo 2 horizontal em A4 paisagem
    // dentro do mesmo trabalho. Ao escolher “Salvar como PDF”, o navegador
    // gera um único arquivo com todas as páginas e texto nítido.
    await printFiscalDocumentsIsolated(documents, {
      single: false,
      waitForAfterPrint: true,
    });
    message.textContent = "Impressão preparada. Todos os documentos foram enviados juntos.";
  } catch (error) {
    message.textContent = error instanceof Error
      ? error.message
      : "Não foi possível preparar a impressão dos documentos.";
  } finally {
    if (printButton.firstChild) printButton.firstChild.textContent = originalText;
    printButton.disabled = false;
  }
}

function enhanceBatchUpload(toolBody) {
  const input = document.querySelector(".file-input");
  const dropzone = document.querySelector(".dropzone");
  if (!input || !dropzone) return;

  ensureUploadWordStyles();
  input.multiple = true;
  input.accept = ".xml,.txt,.doc,.docx,text/xml,application/xml,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const dropzoneTitle = dropzone.querySelector("b");
  const dropzoneMeta = dropzone.querySelector("small");
  if (dropzoneTitle) {
    dropzoneTitle.textContent = 'Selecionar Arquivos';
  }
  if (dropzoneMeta) {
    dropzoneMeta.innerHTML = 'Aceita vários arquivos: XML de <strong>DANFE</strong> e <strong>DACTE</strong>, <strong class="upload-word-highlight">WORD</strong> e <strong class="upload-word-highlight">TXT</strong>';
  }

  let panel = document.querySelector("#batch-panel");
  if (!panel) {
    panel = buildBatchPanel();
    toolBody.append(panel);
    panel.querySelector("#batch-download-pdf").addEventListener("click", () => void downloadBatchPdf(panel));
    panel.querySelector("#batch-print").addEventListener("click", () => void printBatchDocuments(panel));
    panel.querySelector("#batch-clear").addEventListener("click", resetBatch);
  }

  if (input.dataset.batchBound !== "true") {
    input.dataset.batchBound = "true";
    input.addEventListener("change", (event) => {
      if (internalSingleDispatch) return;
      const files = [...(input.files || [])];
      if (files.length === 1) {
        const singleFile = files[0];
        if (!singleFile.name.toLowerCase().endsWith(".xml")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        void prepareSingleOfficialDocument(singleFile);
        return;
      }
      if (files.length === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void processBatchFiles(files);
    }, true);
  }

  if (dropzone.dataset.batchBound !== "true") {
    dropzone.dataset.batchBound = "true";
    dropzone.addEventListener("drop", (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length === 1) {
        const singleFile = files[0];
        if (!singleFile.name.toLowerCase().endsWith(".xml")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        void prepareSingleOfficialDocument(singleFile);
        return;
      }
      if (files.length === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void processBatchFiles(files);
    }, true);
  }
}

async function downloadSinglePdfForLegacy(button) {
  const container = ensureSinglePrintContainer();
  const sheets = [...container.querySelectorAll(".danfe-sheet, .cte-sheet")];
  if (!sheets.length) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Gerando PDF compatível…";

  try {
    await loadPdfLibraries();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: sheetOrientation(sheets[0]), compress: true });
    const hasPage = { value: false };

    for (const sheet of sheets) {
      const canvas = await captureFiscalSheetCanvas(sheet, 1.7);
      appendCanvasPage(pdf, canvas, hasPage, sheetOrientation(sheet));
      canvas.width = 1;
      canvas.height = 1;
    }

    const accessKey = container.querySelector(".fiscal-standard-print")?.dataset.accessKey || "documento-fiscal";
    pdf.save(`${accessKey}.pdf`);
    button.textContent = "PDF baixado — abra para imprimir";
    window.setTimeout(() => { button.textContent = originalText; }, 5_000);
  } catch {
    button.textContent = "Falha ao gerar PDF";
    window.setTimeout(() => { button.textContent = originalText; }, 5_000);
  } finally {
    button.disabled = false;
  }
}

function bindSinglePrint() {
  if (document.body.dataset.singlePrintBound === "true") return;
  document.body.dataset.singlePrintBound = "true";
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".result-actions-simple .print-button");
    if (!button) return;

    const officialDocument = currentSingleOfficialDocument();
    if (!officialDocument) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    // Usa exatamente o mesmo fluxo/configuração da impressão em lote,
    // mesmo quando existe apenas um XML. Assim @page, margens, orientação
    // e dimensões são idênticas nos dois casos.
    void printFiscalDocumentsIsolated([officialDocument], {
      single: false,
      waitForAfterPrint: true,
    }).catch(() => {
      void downloadSinglePdfForLegacy(button);
    });
  }, true);
}


function numberFromFiscal(value) {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLocalCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function summarizeLocalDocuments(documents) {
  const list = documents.filter(Boolean);
  const emitters = new Set();
  let nfe = 0;
  let cte = 0;
  let items = 0;
  let total = 0;

  for (const fiscal of list) {
    if (fiscal.kind === "nfe") {
      nfe += 1;
      items += Array.isArray(fiscal.items) ? fiscal.items.length : 0;
      total += numberFromFiscal(fiscal.totals?.invoice);
    } else if (fiscal.kind === "cte") {
      cte += 1;
      total += numberFromFiscal(fiscal.totalService || fiscal.amountReceivable);
    }

    const emitterKey = fiscal.emitter?.document || fiscal.emitter?.name;
    if (emitterKey) emitters.add(String(emitterKey));
  }

  return {
    count: list.length,
    nfe,
    cte,
    items,
    total,
    emitters: emitters.size,
  };
}

function buildStatBar(label, value, max, detail = "") {
  const percentage = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const row = document.createElement("div");
  row.className = "local-stat-bar-row";
  row.innerHTML = `
    <div class="local-stat-bar-label"><span>${label}</span><strong>${detail || value}</strong></div>
    <div class="local-stat-bar-track"><span style="width:${percentage}%"></span></div>
  `;
  return row;
}

function buildLocalStatisticsSection() {
  const section = document.createElement("section");
  section.id = "estatisticas-locais";
  section.className = "local-statistics-home";
  section.hidden = true;
  section.innerHTML = `
    <div class="local-statistics-heading">
      <span>RESUMO DOS ARQUIVOS</span>
      <h2>Seus documentos em números.</h2>
      <p>O resumo é calculado no seu navegador a partir dos XMLs carregados. Esses números não são enviados para criar o gráfico.</p>
    </div>
    <div class="local-stat-cards" aria-live="polite">
      <article><small>DOCUMENTOS</small><strong data-stat="count">0</strong><span>NF-e e CT-e analisados</span></article>
      <article><small>VALOR SOMADO</small><strong data-stat="total">R$ 0,00</strong><span>valor dos documentos do lote</span></article>
      <article><small>EMITENTES</small><strong data-stat="emitters">0</strong><span>emitentes diferentes</span></article>
      <article><small>ITENS DE NF-e</small><strong data-stat="items">0</strong><span>produtos encontrados</span></article>
    </div>
    <div class="local-stat-charts">
      <article class="local-stat-chart">
        <div><small>POR TIPO</small><h3>Documentos processados</h3></div>
        <div data-chart="types"></div>
      </article>
    </div>
  `;
  return section;
}

function updateLocalStatistics(documents) {
  localStatisticsDocuments = documents.filter(Boolean);
  const section = document.querySelector("#estatisticas-locais");
  if (!section) return;
  if (!localStatisticsDocuments.length) {
    section.hidden = true;
    return;
  }

  const stats = summarizeLocalDocuments(localStatisticsDocuments);
  section.hidden = false;
  section.querySelector('[data-stat="count"]').textContent = String(stats.count);
  section.querySelector('[data-stat="total"]').textContent = formatLocalCurrency(stats.total);
  section.querySelector('[data-stat="emitters"]').textContent = String(stats.emitters);
  section.querySelector('[data-stat="items"]').textContent = String(stats.items);

  const types = section.querySelector('[data-chart="types"]');
  types.replaceChildren();
  const typeMax = Math.max(stats.nfe, stats.cte, 1);
  types.append(
    buildStatBar("NF-e", stats.nfe, typeMax, `${stats.nfe} documento${stats.nfe === 1 ? "" : "s"}`),
    buildStatBar("CT-e", stats.cte, typeMax, `${stats.cte} documento${stats.cte === 1 ? "" : "s"}`),
  );

}

function clearLocalStatistics() {
  localStatisticsDocuments = [];
  const section = document.querySelector("#estatisticas-locais");
  if (section) section.hidden = true;
}

function buildNationalStatisticsSection() {
  const section = document.createElement("section");
  section.id = "nfe-em-numeros";
  section.className = "national-statistics-home";
  section.innerHTML = `
    <div class="national-statistics-copy">
      <span>NF-e EM NÚMEROS</span>
      <h2>Mais de 59 bilhões de NF-e já foram autorizadas no Brasil.</h2>
      <p>O Portal Nacional da NF-e calcula diariamente o total de documentos autorizados desde a implantação do projeto em 2006. O indicador não considera NF-e canceladas nem denegadas.</p>
      <div class="national-stat-source">
        <a href="https://www.nfe.fazenda.gov.br/portal/infoEstatisticas.aspx" target="_blank" rel="noopener noreferrer">Fonte: Portal Nacional da NF-e ↗</a>
        <a href="/estatisticas/">Entenda os números →</a>
      </div>
    </div>
    <div class="national-stat-visual" aria-label="Indicadores públicos da NF-e">
      <article class="national-stat-primary"><small>NF-e AUTORIZADAS</small><strong>59+ bi</strong><span>acumuladas desde 2006</span><div class="national-stat-meter"><i></i></div></article>
      <div class="national-stat-secondary">
        <article><small>EMISSORES</small><strong>≈ 3 mi</strong><span>ordem de grandeza divulgada pelo portal</span></article>
        <article><small>ATUALIZAÇÃO</small><strong>Diária</strong><span>estatística oficial acumulada</span></article>
      </div>
    </div>
  `;
  return section;
}

function buildImpostometroWidget() {
  const wrapper = document.createElement("aside");
  wrapper.id = "impostometro-flutuante";
  wrapper.className = "impostometro-floating";
  wrapper.setAttribute("aria-label", "Impostômetro do Brasil");
  wrapper.innerHTML = `
    <div class="impostometro-floating-label"><strong>Impostômetro</strong><a href="https://impostometro.com.br/" target="_blank" rel="noopener noreferrer">ACSP ↗</a></div>
    <iframe src="https://impostometro.com.br/widget/contador" title="Impostômetro do Brasil" loading="lazy" scrolling="no" frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe>
  `;
  return wrapper;
}

function buildHomeGuides() {
  const section = document.createElement("section");
  section.id = "guias";
  section.className = "guides-home";
  section.innerHTML = `
    <div class="guides-home-heading">
      <span>GUIAS PRÁTICOS</span>
      <h2>Entenda seus documentos fiscais.</h2>
      <p>Respostas diretas para baixar, validar e imprimir NF-e e CT-e com mais segurança.</p>
      <a href="/guias/">Ver todos os guias →</a>
    </div>
    <div class="guide-card-grid">
      <a class="guide-card" href="/guias/como-baixar-xml-nfe/">
        <small>NF-e</small><h3>Como baixar o XML</h3><p>Veja onde procurar o arquivo e quais caminhos são oficiais.</p><span>Ler guia →</span>
      </a>
      <a class="guide-card" href="/guias/xml-ou-danfe/">
        <small>CONCEITOS</small><h3>XML ou DANFE?</h3><p>Entenda a diferença e qual documento possui validade fiscal.</p><span>Ler guia →</span>
      </a>
      <a class="guide-card" href="/guias/chave-de-acesso-44-digitos/">
        <small>CHAVE</small><h3>As 44 posições</h3><p>Saiba o que a chave identifica e como conferir seu formato.</p><span>Ler guia →</span>
      </a>
      <a class="guide-card" href="/guias/cte-e-dacte/">
        <small>TRANSPORTE</small><h3>CT-e e DACTE</h3><p>Conheça a função de cada documento no transporte de cargas.</p><span>Ler guia →</span>
      </a>
    </div>
  `;
  return section;
}

function buildDashboardPromo() {
  const section = document.createElement("section");
  section.id = "procurando-dashboard";
  section.className = "dashboard-promo-home";
  section.innerHTML = `
    <div class="dashboard-promo-copy">
      <span>NOVA ÁREA</span>
      <h2>Aproveite e conheça dashboards para Power BI.</h2>
      <p>Veja modelos para finanças pessoais, investimentos, empresas, vendas, contas a pagar e outros usos. Baixe o template e conecte seus dados em Excel ou JSON diretamente no Power BI.</p>
      <a href="/procurandodashboard/">Conhecer o ProcurandoDashboardBI <b>→</b></a>
    </div>
    <div class="dashboard-promo-preview" aria-hidden="true">
      <div class="dashboard-promo-window">
        <div class="dashboard-promo-window-top"><i></i><i></i><i></i><strong>Resumo financeiro</strong></div>
        <div class="dashboard-promo-kpis"><span><small>RECEITAS</small><b>R$ 8.450</b></span><span><small>DESPESAS</small><b>R$ 5.210</b></span><span><small>SALDO</small><b>R$ 3.240</b></span></div>
        <div class="dashboard-promo-chart"><span style="height:42%"></span><span style="height:64%"></span><span style="height:49%"></span><span style="height:78%"></span><span style="height:62%"></span><span style="height:91%"></span></div>
      </div>
    </div>
  `;
  return section;
}

function enhanceSiteLinks() {
  const nav = document.querySelector(".site-header nav");
  if (nav) {
    const footerOnlyLabels = new Set(["segurança", "guias", "estatísticas", "entrar em contato"]);
    for (const link of nav.querySelectorAll("a")) {
      if (footerOnlyLabels.has(link.textContent.trim().toLocaleLowerCase("pt-BR"))) {
        link.remove();
      }
    }
  }
  if (nav && !nav.querySelector('[href="/procurandodashboard/"]')) {
    const dashboard = document.createElement("a");
    dashboard.href = "/procurandodashboard/";
    dashboard.textContent = "ProcurandoDashboardBI";
    dashboard.className = "dashboard-nav-link";
    nav.append(dashboard);
  }
  for (const footerLinks of document.querySelectorAll("footer > div")) {
    if (![...footerLinks.querySelectorAll("a")].some((link) => link.textContent.trim() === "Segurança")) {
      const security = document.createElement("a");
      security.href = "/#seguranca";
      security.textContent = "Segurança";
      footerLinks.prepend(security);
    }
    if (!footerLinks.querySelector('[href="/guias/"]')) {
      const guides = document.createElement("a");
      guides.href = "/guias/";
      guides.textContent = "Guias";
      footerLinks.prepend(guides);
    }
    if (!footerLinks.querySelector('[href="/estatisticas/"]')) {
      const statistics = document.createElement("a");
      statistics.href = "/estatisticas/";
      statistics.textContent = "Estatísticas";
      footerLinks.append(statistics);
    }
    if (!footerLinks.querySelector('[href="/procurandodashboard/"]')) {
      const dashboard = document.createElement("a");
      dashboard.href = "/procurandodashboard/";
      dashboard.textContent = "ProcurandoDashboardBI";
      footerLinks.append(dashboard);
    }
    if (!footerLinks.querySelector('[href="/sobre/"]')) {
      const about = document.createElement("a");
      about.href = "/sobre/";
      about.textContent = "Sobre";
      footerLinks.append(about);
    }
    if (!footerLinks.querySelector('[href="/contato/"]')) {
      const contact = document.createElement("a");
      contact.href = "/contato/";
      contact.textContent = "Entrar em contato";
      footerLinks.append(contact);
    }
  }
}

function buildKeyPanel() {
  const panel = document.createElement("section");
  panel.id = "key-query-panel";
  panel.className = "key-query-panel";
  panel.hidden = true;
  panel.setAttribute("role", "tabpanel");
  panel.innerHTML = `
    <div class="panel-heading">
      <span class="panel-number">1</span>
      <div>
        <h2>Consulte pela chave</h2>
        <p>Disponível para NF-e modelo 55 e CT-e modelo 57. Alguns CT-es podem não estar disponíveis.</p>
        <p class="free-service-note">Consulta e impressão de DANFE 100% grátis.</p>
      </div>
    </div>
    <form id="key-query-form" novalidate>
      <label class="key-field" for="access-key-input">
        <span>Chave de acesso <small><b id="key-count">0</b>/44</small></span>
        <input id="access-key-input" type="text" inputmode="numeric" autocomplete="off"
          spellcheck="false" maxlength="54" placeholder="Digite os 44 caracteres da chave" />
      </label>
      <button class="primary-button key-submit" type="submit" disabled>
        Consultar documento <span>→</span>
      </button>
      <p class="integration-note">Consulta externa protegida pelo servidor. O site não mantém um banco próprio de documentos.</p>
      <p id="key-message" class="key-message" role="alert" aria-live="polite"></p>
    </form>
    <section id="key-result" class="key-result" hidden aria-live="polite">
      <span class="ready-check" aria-hidden="true">✓</span>
      <small id="key-result-type">DOCUMENTO LOCALIZADO</small>
      <h2 id="key-result-title">Documento e XML prontos</h2>
      <p id="key-result-number"></p>
      <div class="key-downloads">
        <a id="download-key-xml" class="primary-button" href="#">Baixar XML <span>↓</span></a>
        <button id="open-key-pdf" class="print-button" type="button">Abrir / imprimir DANFE</button>
      </div>
      <button id="change-key" class="change-xml-button" type="button">Consultar outra chave</button>
    </section>
  `;
  return panel;
}

function bindKeyPanel(panel) {
  if (panel.dataset.bound === "true") return;
  panel.dataset.bound = "true";

  const form = panel.querySelector("#key-query-form");
  const input = panel.querySelector("#access-key-input");
  const count = panel.querySelector("#key-count");
  const submit = panel.querySelector(".key-submit");
  const message = panel.querySelector("#key-message");
  const result = panel.querySelector("#key-result");
  const number = panel.querySelector("#key-result-number");
  const resultType = panel.querySelector("#key-result-type");
  const resultTitle = panel.querySelector("#key-result-title");
  const downloadXml = panel.querySelector("#download-key-xml");
  const openPdf = panel.querySelector("#open-key-pdf");
  const changeKey = panel.querySelector("#change-key");

  input.addEventListener("input", () => {
    const chave = normalizeKey(input.value);
    input.value = chave.replace(/(.{4})/g, "$1 ").trim();
    count.textContent = String(chave.length);
    submit.disabled = chave.length !== 44;
    message.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const chave = normalizeKey(input.value);

    if (chave.length !== 44) {
      message.textContent = "Informe os 44 caracteres da chave de acesso.";
      return;
    }

    const modelo = chave.slice(20, 22);
    if (modelo !== "55" && modelo !== "57") {
      message.textContent = "A consulta por chave aceita NF-e modelo 55 e CT-e modelo 57.";
      return;
    }

    submit.disabled = true;
    submit.classList.add("is-loading");
    submit.firstChild.textContent = "Consultando documento ";
    message.textContent = "Aguarde enquanto o documento é localizado…";
    releaseDownloads();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Não foi possível consultar esta chave.");
      }

      const pdfBase64 = data.pdf_base64;
      const xmlBase64 = data.xml_base64;
      const xmlText = typeof data.xml === "string" ? data.xml : "";

      if (!pdfBase64 || (!xmlBase64 && !xmlText)) {
        throw new Error("A consulta não retornou o DANFE e o XML completos.");
      }

      pdfUrl = URL.createObjectURL(base64ToBlob(pdfBase64, "application/pdf"));
      const xmlBlob = xmlBase64
        ? base64ToBlob(xmlBase64, "application/xml")
        : new Blob([xmlText], { type: "application/xml;charset=utf-8" });
      xmlUrl = URL.createObjectURL(xmlBlob);

      try {
        const parsedFiscal = parseFiscalXml(await xmlBlob.text());
        updateLocalStatistics([parsedFiscal]);
      } catch {
        clearLocalStatistics();
      }

      downloadXml.href = xmlUrl;
      downloadXml.download = `${data.chave || chave}.xml`;
      const type = data.tipo === "CTE" || modelo === "57" ? "CT-e" : "NF-e";
      resultType.textContent = `${type.toUpperCase()} LOCALIZADO`;
      resultTitle.textContent = type === "CT-e" ? "DACTE e XML prontos" : "DANFE e XML prontos";
      openPdf.textContent = type === "CT-e" ? "Abrir / imprimir DACTE" : "Abrir / imprimir DANFE";
      number.textContent = `Chave: ${data.chave || chave}`;
      form.hidden = true;
      result.hidden = false;
      message.textContent = "";
    } catch (error) {
      message.textContent = error instanceof Error
        ? error.message
        : "Não foi possível consultar esta chave.";
    } finally {
      submit.classList.remove("is-loading");
      submit.firstChild.textContent = "Consultar documento ";
      submit.disabled = normalizeKey(input.value).length !== 44;
    }
  });

  openPdf.addEventListener("click", () => {
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
  });

  changeKey.addEventListener("click", () => {
    releaseDownloads();
    clearLocalStatistics();
    result.hidden = true;
    form.hidden = false;
    input.select();
    input.focus();
  });
}

function enhanceHome() {
  document.title = "ProcurandoNFe";
  const toolBody = document.querySelector(".tool-body");
  const tabs = document.querySelectorAll(".tabs button");
  if (!toolBody || tabs.length < 2) return;

  ensureSinglePrintContainer();

  let panel = document.querySelector("#key-query-panel");
  if (!panel) {
    panel = buildKeyPanel();
    toolBody.append(panel);
    bindKeyPanel(panel);
  }

  enhanceBatchUpload(toolBody);
  bindSinglePrint();

  const xmlTab = tabs[0];
  const keyTab = tabs[1];
  keyTab.disabled = false;
  keyTab.removeAttribute("aria-disabled");
  keyTab.title = "Consultar NF-e ou CT-e pela chave de acesso";
  keyTab.querySelector(".soon-badge")?.remove();

  if (xmlTab.dataset.queryBound !== "true") {
    xmlTab.dataset.queryBound = "true";
    xmlTab.addEventListener("click", () => showMode("xml"));
  }

  if (keyTab.dataset.queryBound !== "true") {
    keyTab.dataset.queryBound = "true";
    keyTab.addEventListener("click", () => showMode("key"));
  }

  showMode(document.body.dataset.consultaMode || "xml");

  const footer = document.querySelector(".site-content > footer");
  if (footer) {
    if (!document.querySelector("#estatisticas-locais")) {
      footer.before(buildLocalStatisticsSection());
      updateLocalStatistics(localStatisticsDocuments);
    }
    if (!document.querySelector("#nfe-em-numeros")) {
      footer.before(buildNationalStatisticsSection());
    }
    if (!document.querySelector("#procurando-dashboard")) {
      footer.before(buildDashboardPromo());
    }
    if (!document.querySelector("#guias")) {
      footer.before(buildHomeGuides());
    }
  }

  if (!document.querySelector("#impostometro-flutuante")) {
    document.body.append(buildImpostometroWidget());
  }
}

function updatePrivacyPage() {
  if (window.location.pathname.replace(/\/$/, "") !== "/privacidade") return;

  const sections = [...document.querySelectorAll(".policy-card section")];
  const processing = sections.find((section) => section.querySelector("h2")?.textContent.startsWith("1."));
  const thirdParties = sections.find((section) => section.querySelector("h2")?.textContent.startsWith("3."));
  const retention = sections.find((section) => section.querySelector("h2")?.textContent.startsWith("5."));
  const rights = sections.find((section) => section.querySelector("h2")?.textContent.startsWith("6."));
  const policyCard = document.querySelector(".policy-card");
  const updated = document.querySelector(".policy-intro small");
  const summary = document.querySelector(".policy-highlight p");

  if (processing) {
    processing.querySelector("h2").textContent = "1. Processamento do XML e da chave";
    processing.querySelector("p").textContent =
      "No envio de XML, inclusive em lote, os arquivos e o PDF gerado são processados localmente no navegador. Na consulta por chave, a chave e o documento retornado passam temporariamente pela infraestrutura do Cloudflare e pelo serviço MeuDanfe para localizar a NF-e ou o CT-e. O ProcurandoNFe não grava cópias em banco de dados.";
  }

  if (thirdParties && !thirdParties.querySelector("[data-meudanfe-notice]")) {
    const paragraph = document.createElement("p");
    paragraph.dataset.meudanfeNotice = "true";
    paragraph.textContent =
      "A consulta por chave utiliza a API MeuDanfe como serviço externo. Os documentos consultados podem permanecer na área da conta da integração, conforme a política e os termos próprios do provedor.";
    thirdParties.append(paragraph);
  }

  if (retention) {
    retention.querySelector("p").textContent =
      "O ProcurandoNFe não mantém banco próprio com cópias dos XMLs ou DANFEs consultados. A resposta é transmitida ao navegador e descartada pelo mini backend após a solicitação. O provedor externo pode conservar o documento e registros técnicos conforme suas próprias regras.";
  }

  if (rights) {
    const paragraph = rights.querySelector("p");
    if (paragraph) {
      paragraph.innerHTML = 'Para dúvidas sobre privacidade, tratamento de dados ou uso da ferramenta, use nossa <a href="/contato/">página de contato</a>.';
    }
  }

  if (policyCard && !policyCard.querySelector("[data-dashboard-purchase-privacy]")) {
    const purchase = document.createElement("section");
    purchase.dataset.dashboardPurchasePrivacy = "true";
    const heading = document.createElement("h2");
    heading.textContent = "8. Compra de dashboards por e-mail";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Ao clicar em Comprar, o navegador abre uma mensagem no Gmail com o dashboard e o preço preenchidos. Nome, e-mail de entrega e comprovante somente são enviados quando o próprio usuário confirma o envio. O site não armazena essas informações; o tratamento da mensagem também depende do provedor de e-mail utilizado.";
    purchase.append(heading, paragraph);
    policyCard.insertBefore(purchase, policyCard.querySelector(".policy-highlight"));
  }

  if (updated) updated.textContent = "Última atualização: 17 de agosto de 2026";
  if (summary) {
    summary.textContent =
      "O XML enviado permanece no dispositivo. A consulta por chave usa um serviço externo apenas para localizar e devolver a NF-e ou o CT-e.";
  }
}

function enhance() {
  if (window.location.pathname === "/" || window.location.pathname === "") enhanceHome();
  updatePrivacyPage();
  enhanceSiteLinks();
}

enhance();

const observer = new MutationObserver(() => {
  window.clearTimeout(observer.timer);
  observer.timer = window.setTimeout(enhance, 30);
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["disabled", "aria-disabled"],
});

window.addEventListener("pagehide", () => {
  releaseDownloads();
  batchDocuments = [];
  document.querySelector("#batch-print-container")?.replaceChildren();
  document.querySelector("#single-official-print-container")?.replaceChildren();
});

export { appendCanvasPage, requiresPdfPrintFallback, sheetOrientation };
