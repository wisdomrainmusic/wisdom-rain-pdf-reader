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
    const html = `
      <div id="wrpr-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.85);z-index:99999;align-items:center;justify-content:center;">
        <div id="wrpr-pdf-shell" style="background:#fff;width:90%;height:90%;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
          <div id="wrpr-toolbar" style="background:#e60000;color:#fff;padding:8px;text-align:center;">
            <button id="wrpr-prev">◀</button>
            <span id="wrpr-page-info">Page <span id="wrpr-page-num">1</span> / <span id="wrpr-page-count">1</span></span>
            <button id="wrpr-next">▶</button>
            <button id="wrpr-close" style="float:right;">✕</button>
          </div>
          <div id="wrpr-pdf-container" style="flex:1;display:flex;align-items:center;justify-content:center;background:#222;"></div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('wrpr-modal');
  }

  const container = document.getElementById('wrpr-pdf-container');
  const btnPrev = document.getElementById('wrpr-prev');
  const btnNext = document.getElementById('wrpr-next');
  const btnClose = document.getElementById('wrpr-close');
  const pageNumEl = document.getElementById('wrpr-page-num');
  const pageCountEl = document.getElementById('wrpr-page-count');

  let pdfDoc = null;
  let currentPage = 1;
  let readerId = '';
  let pdfUrl = '';

  function showModal() {
    modal.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
  }

  function hideModal() {
    modal.style.display = 'none';
    document.documentElement.style.overflow = '';
    container.innerHTML = '';
    pdfDoc = null;
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(num);
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min((window.innerWidth * 0.9) / vp.width, (window.innerHeight * 0.8) / vp.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      container.innerHTML = '';
      container.appendChild(canvas);
      await page.render({ canvasContext: ctx, viewport }).promise;
      currentPage = num;
      pageNumEl.textContent = num;
      localStorage.setItem(`wrpr_progress_${readerId}_${pdfUrl}`, num);
    } catch (err) {
      container.innerHTML = `<div style="color:#fff;">PDF render error: ${err}</div>`;
    }
  }

  async function openPDF(url, rid) {
    readerId = rid;
    pdfUrl = url;
    showModal();
    container.innerHTML = `<div style="color:#fff;">Loading PDF...</div>`;
    if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
      container.innerHTML = '<div style="color:#f55;">PDF.js is not available.</div>';
      return;
    }
    try {
      const loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl });
      pdfDoc = await loadingTask.promise;
      pageCountEl.textContent = pdfDoc.numPages;
      const stored = parseInt(localStorage.getItem(`wrpr_progress_${rid}_${url}`) || '1', 10);
      const startPage = Number.isFinite(stored) ? Math.min(Math.max(1, stored), pdfDoc.numPages) : 1;
      await renderPage(startPage);
    } catch (err) {
      container.innerHTML = `<div style="color:#f55;">PDF load error: ${err.message}</div>`;
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
