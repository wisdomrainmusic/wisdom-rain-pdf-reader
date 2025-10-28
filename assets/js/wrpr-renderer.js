(function () {
  // --- PDF.js init ---
  if (typeof window.pdfjsLib === 'undefined' && window['pdfjs-dist/build/pdf']) {
    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
  }

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // --- Modal setup ---
  let modal = document.getElementById('wrpr-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wrpr-modal';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'PDF reader');
    modal.innerHTML = `
      <div id="wrpr-modal-content">
        <span id="wrpr-close">&times;</span>
        <canvas id="wrpr-pdf-canvas"></canvas>
        <div class="wrpr-page-info">Page 1</div>
        <div class="wrpr-nav">
          <button id="wrpr-prev"><i class="fas fa-backward"></i></button>
          <button id="wrpr-next"><i class="fas fa-forward"></i></button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const canvasEl = document.getElementById('wrpr-pdf-canvas');
  const btnPrev = document.getElementById('wrpr-prev');
  const btnNext = document.getElementById('wrpr-next');
  const btnClose = document.getElementById('wrpr-close');
  const pageInfoEl = modal.querySelector('.wrpr-page-info');

  let pdfDoc = null;
  let currentPage = 1;
  let readerId = '';
  let pdfUrl = '';

  function setPageInfo(text) {
    if (pageInfoEl) {
      pageInfoEl.textContent = text;
    }
  }

  function updatePageInfo() {
    if (!pdfDoc) {
      setPageInfo('Loading PDF...');
      return;
    }
    setPageInfo(`Page ${currentPage} / ${pdfDoc.numPages}`);
  }

  function updateNavState() {
    const hasDoc = !!pdfDoc;
    if (btnPrev) {
      btnPrev.disabled = !hasDoc || currentPage <= 1;
    }
    if (btnNext) {
      btnNext.disabled = !hasDoc || (pdfDoc ? currentPage >= pdfDoc.numPages : true);
    }
  }

  function showModal() {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }

  function hideModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
    }
    pdfDoc = null;
    currentPage = 1;
    updateNavState();
    setPageInfo('Loading PDF...');
  }

  async function renderPage(num) {
    if (!pdfDoc || !canvasEl) return;
    try {
      const page = await pdfDoc.getPage(num);
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min((window.innerWidth * 0.9) / vp.width, (window.innerHeight * 0.8) / vp.height);
      const viewport = page.getViewport({ scale });
      const ctx = canvasEl.getContext('2d');
      if (!ctx) {
        return;
      }
      canvasEl.classList.add('wrpr-flip');
      window.setTimeout(() => canvasEl.classList.remove('wrpr-flip'), 250);
      const outputScale = window.devicePixelRatio || 1;
      canvasEl.width = viewport.width * outputScale;
      canvasEl.height = viewport.height * outputScale;
      canvasEl.style.width = `${viewport.width}px`;
      canvasEl.style.height = `${viewport.height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      const renderContext = { canvasContext: ctx, viewport };
      if (outputScale !== 1) {
        renderContext.transform = [outputScale, 0, 0, outputScale, 0, 0];
      }
      await page.render(renderContext).promise;
      currentPage = num;
      updatePageInfo();
      updateNavState();
      localStorage.setItem(`wrpr_progress_${readerId}_${pdfUrl}`, num);
    } catch (err) {
      setPageInfo(`PDF render error: ${err.message || err}`);
    }
  }

  async function openPDF(url, rid) {
    readerId = rid;
    pdfUrl = url;
    showModal();
    setPageInfo('Loading PDF...');
    updateNavState();
    if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
      setPageInfo('PDF.js is not available.');
      return;
    }
    try {
      const loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl });
      pdfDoc = await loadingTask.promise;
      updateNavState();
      const stored = parseInt(localStorage.getItem(`wrpr_progress_${rid}_${url}`) || '1', 10);
      const startPage = Number.isFinite(stored) ? Math.min(Math.max(1, stored), pdfDoc.numPages) : 1;
      await renderPage(startPage);
    } catch (err) {
      setPageInfo(`PDF load error: ${err.message}`);
      pdfDoc = null;
      updateNavState();
    }
  }

  // --- Button bindings ---
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.wrpr-read-btn');
    if (btn) {
      e.preventDefault();
      const pdf = btn.dataset.pdf || '';
      if (!pdf) return;
      const rid = btn.dataset.reader || '';
      openPDF(pdf, rid);
    }
  });

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (pdfDoc && currentPage > 1) renderPage(currentPage - 1);
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (pdfDoc && currentPage < pdfDoc.numPages) renderPage(currentPage + 1);
    });
  }
  if (btnClose) {
    btnClose.addEventListener('click', hideModal);
  }

  updateNavState();

  document
    .querySelector('.wrpr-language-filter')
    ?.addEventListener('change', (e) => {
      const lang = e.target.value;
      document.querySelectorAll('.wrpr-book-card').forEach((card) => {
        const match = lang === 'All' || card.dataset.lang === lang;
        card.style.display = match ? 'flex' : 'none';
      });
    });
})();
