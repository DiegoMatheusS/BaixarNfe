(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const setStatus = (text, type = '') => {
    const node = $('#tool-status');
    if (!node) return;
    node.textContent = text || '';
    node.className = `tool-status${type ? ` is-${type}` : ''}`;
  };

  const downloadCanvas = (canvas, filename, mime = 'image/png', quality) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus('Não foi possível gerar o arquivo.', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    }, mime, quality);
  };

  function setupCurrency() {
    const form = $('#currency-form');
    if (!form) return;
    const amount = $('#currency-amount');
    const from = $('#currency-from');
    const to = $('#currency-to');
    const result = $('#currency-result-value');
    const meta = $('#currency-result-meta');
    const swap = $('#currency-swap');
    if (from.value === to.value) to.value = from.value === 'USD' ? 'BRL' : 'USD';

    const formatMoney = (value, currency) => new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency, maximumFractionDigits: 4,
    }).format(value);

    const convert = async () => {
      const rawAmount = Number(String(amount.value).replace(',', '.'));
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        setStatus('Informe um valor maior que zero.', 'error');
        return;
      }
      if (from.value === to.value) {
        result.textContent = formatMoney(rawAmount, to.value);
        meta.textContent = `1 ${from.value} = 1 ${to.value}`;
        setStatus('Conversão concluída.', 'success');
        return;
      }

      setStatus('Buscando a cotação de referência…');
      try {
        const url = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from.value)}/${encodeURIComponent(to.value)}`;
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('cotacao_indisponivel');
        const data = await response.json();
        const rate = Number(data.rate);
        if (!Number.isFinite(rate)) throw new Error('cotacao_invalida');
        result.textContent = formatMoney(rawAmount * rate, to.value);
        meta.textContent = `1 ${from.value} = ${rate.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} ${to.value} · referência de ${data.date || 'data mais recente'}`;
        setStatus('Cotação carregada.', 'success');
      } catch (error) {
        console.error(error);
        setStatus('Não foi possível consultar a cotação agora. Tente novamente em instantes.', 'error');
      }
    };

    form.addEventListener('submit', (event) => { event.preventDefault(); convert(); });
    swap?.addEventListener('click', () => {
      const old = from.value;
      from.value = to.value;
      to.value = old;
      convert();
    });
    convert();
  }

  function setupQr() {
    const form = $('#qr-form');
    const canvas = $('#qr-canvas');
    if (!form || !canvas) return;
    const text = $('#qr-text');
    const size = $('#qr-size');
    const download = $('#qr-download');

    const draw = () => {
      const value = text.value.trim();
      if (!value) {
        setStatus('Digite um texto ou endereço para gerar o QR Code.', 'error');
        return;
      }
      if (!window.QRCodeMatrix || !window.QRErrorCorrectLevel) {
        setStatus('O gerador de QR Code não carregou corretamente.', 'error');
        return;
      }
      try {
        const qr = new window.QRCodeMatrix(0, window.QRErrorCorrectLevel.M);
        qr.addData(value);
        qr.make();
        const count = qr.getModuleCount();
        const quiet = 4;
        const px = Number(size.value) || 320;
        const total = count + quiet * 2;
        const scale = Math.max(1, Math.floor(px / total));
        const actual = total * scale;
        canvas.width = actual;
        canvas.height = actual;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, actual, actual);
        ctx.fillStyle = '#000';
        for (let row = 0; row < count; row += 1) {
          for (let col = 0; col < count; col += 1) {
            if (qr.isDark(row, col)) {
              ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
            }
          }
        }
        download.disabled = false;
        setStatus('QR Code gerado no seu navegador.', 'success');
      } catch (error) {
        console.error(error);
        setStatus('O conteúdo é grande demais para este QR Code. Reduza o texto e tente novamente.', 'error');
      }
    };

    form.addEventListener('submit', (event) => { event.preventDefault(); draw(); });
    download.addEventListener('click', () => downloadCanvas(canvas, 'qrcode.png'));
    draw();
  }

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('arquivo_invalido'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem_invalida')); };
      img.src = url;
    });
  }

  function fitCanvas(canvas, image, maxSide = 2200) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    return scale;
  }

  function setupImageConverter() {
    const input = $('#convert-file');
    const canvas = $('#convert-canvas');
    const format = $('#convert-format');
    const quality = $('#convert-quality');
    const qualityOut = $('#convert-quality-out');
    const button = $('#convert-download');
    if (!input || !canvas) return;
    let sourceImage = null;

    const redraw = () => {
      if (!sourceImage) return;
      fitCanvas(canvas, sourceImage, 2600);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (format.value === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    };

    input.addEventListener('change', async () => {
      try {
        sourceImage = await loadImageFile(input.files?.[0]);
        redraw();
        button.disabled = false;
        setStatus(`Imagem carregada: ${sourceImage.naturalWidth} × ${sourceImage.naturalHeight}px.`, 'success');
      } catch (error) {
        console.error(error);
        sourceImage = null;
        button.disabled = true;
        setStatus('Escolha uma imagem JPG, PNG ou WEBP válida.', 'error');
      }
    });
    format.addEventListener('change', redraw);
    quality.addEventListener('input', () => { qualityOut.value = `${quality.value}%`; });
    button.addEventListener('click', () => {
      if (!sourceImage) return;
      redraw();
      const mime = format.value;
      const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
      const q = Math.max(.1, Math.min(1, Number(quality.value) / 100));
      downloadCanvas(canvas, `imagem-convertida.${ext}`, mime, q);
    });
  }

  function setupBackgroundRemoval() {
    const input = $('#bg-file');
    const sourceCanvas = $('#bg-source-canvas');
    const resultCanvas = $('#bg-result-canvas');
    const tolerance = $('#bg-tolerance');
    const toleranceOut = $('#bg-tolerance-out');
    const removeButton = $('#bg-remove');
    const downloadButton = $('#bg-download');
    if (!input || !sourceCanvas || !resultCanvas) return;
    let sourceImage = null;

    const drawSource = () => {
      if (!sourceImage) return;
      fitCanvas(sourceCanvas, sourceImage, 1800);
      resultCanvas.width = sourceCanvas.width;
      resultCanvas.height = sourceCanvas.height;
      const ctx = sourceCanvas.getContext('2d');
      ctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      ctx.drawImage(sourceImage, 0, 0, sourceCanvas.width, sourceCanvas.height);
      resultCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
    };

    input.addEventListener('change', async () => {
      try {
        sourceImage = await loadImageFile(input.files?.[0]);
        drawSource();
        removeButton.disabled = false;
        downloadButton.disabled = true;
        setStatus('Imagem carregada. Ajuste a tolerância se o fundo não for totalmente uniforme.', 'success');
      } catch (error) {
        console.error(error);
        sourceImage = null;
        removeButton.disabled = true;
        downloadButton.disabled = true;
        setStatus('Escolha uma imagem válida.', 'error');
      }
    });

    tolerance.addEventListener('input', () => { toleranceOut.value = tolerance.value; });

    removeButton.addEventListener('click', () => {
      if (!sourceImage) return;
      drawSource();
      const src = sourceCanvas.getContext('2d');
      const out = resultCanvas.getContext('2d');
      const imageData = src.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const d = imageData.data;
      const w = sourceCanvas.width;
      const h = sourceCanvas.height;
      const sampleAt = (x, y) => {
        const i = (y * w + x) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };
      const padX = Math.max(0, Math.min(w - 1, Math.round(w * .015)));
      const padY = Math.max(0, Math.min(h - 1, Math.round(h * .015)));
      const samples = [sampleAt(padX, padY), sampleAt(w - 1 - padX, padY), sampleAt(padX, h - 1 - padY), sampleAt(w - 1 - padX, h - 1 - padY)];
      const limit = Number(tolerance.value) || 55;
      const feather = 26;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let min = Infinity;
        for (const s of samples) {
          const dr = r - s[0], dg = g - s[1], db = b - s[2];
          min = Math.min(min, Math.sqrt(dr * dr + dg * dg + db * db));
        }
        if (min <= limit) d[i + 3] = 0;
        else if (min < limit + feather) d[i + 3] = Math.round(255 * ((min - limit) / feather));
      }
      out.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
      out.putImageData(imageData, 0, 0);
      downloadButton.disabled = false;
      setStatus('Fundo processado no navegador. Confira a prévia antes de baixar.', 'success');
    });

    downloadButton.addEventListener('click', () => downloadCanvas(resultCanvas, 'imagem-sem-fundo.png'));
  }

  const tool = document.body.dataset.tool;
  if (tool === 'currency') setupCurrency();
  if (tool === 'qr') setupQr();
  if (tool === 'convert-image') setupImageConverter();
  if (tool === 'remove-bg') setupBackgroundRemoval();
})();
