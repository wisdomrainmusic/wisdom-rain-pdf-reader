(function () {
  // PDF.js global init (tek kez)
  if (typeof window.pdfjsLib !== 'undefined') {
    // already loaded
  } else if (typeof window['pdfjs-dist/build/pdf'] !== 'undefined') {
    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
  }

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    // Versiyonu plugin’de enqueue ettiğin PDF.js ile eşleştir!
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const modal = document.getElementById('wrpr-modal');
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
  let rendering = false;
  let pending = null;

  function showModal() {
    modal.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
  }
  function hideModal() {
    modal.style.display = 'none';
    document.documentElement.style.overflow = '';
    // temizle
    container.innerHTML = '';
    pdfDoc = null;
  }

  async function renderPage(num) {
    if (!pdfDoc || rendering) { pending = num; return; }
    rendering = true;
    try {
      const page = await pdfDoc.getPage(num);
      // responsive ölçek: genişliğe göre
      const targetWidth = Math.min(1000, Math.floor(window.innerWidth * 0.9));
      const viewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / viewport.width;
      const scaledVp = page.getViewport({ scale });

      // canvas kur
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = scaledVp.width;
      canvas.height = scaledVp.height;

      container.innerHTML = '';
      container.appendChild(canvas);

      await page.render({ canvasContext: ctx, viewport: scaledVp }).promise;

      currentPage = num;
      pageNumEl.textContent = String(currentPage);
      localStorage.setItem(`wrpr_progress_${readerId}_${pdfUrl}`, String(currentPage));
    } catch (e) {
      console.error('PDF render error:', e);
      container.innerHTML = '<div style="padding:16px;color:#b00;font-weight:600">PDF yüklenemedi. (CORS/URL kontrol edin)</div>';
    } finally {
      rendering = false;
      if (pending !== null && pending !== currentPage) {
        const next = pending; pending = null; renderPage(next);
      }
    }
  }

  async function openPdf(url, rId) {
    if (!window.pdfjsLib) {
      console.error('PDF.js bulunamadı.');
      return;
    }
    pdfUrl = url;
    readerId = rId;
    showModal();
    container.innerHTML = '<div style="padding:16px">Loading…</div>';

    try {
      const loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
      pdfDoc = await loadingTask.promise;

      pageCountEl.textContent = String(pdfDoc.numPages);
      const saved = parseInt(localStorage.getItem(`wrpr_progress_${readerId}_${pdfUrl}`) || '1', 10);
      const startPage = Math.min(Math.max(1, saved), pdfDoc.numPages);

      await renderPage(startPage);
    } catch (e) {
      console.error('PDF load error:', e);
      container.innerHTML = '<div style="padding:16px;color:#b00;font-weight:600">PDF açılamadı. (URL/CORS)</div>';
    }
  }

  // Delege tıklama – dinamik DOM’da güvenilir
  document.addEventListener('click', function (e) {
    const openBtn = e.target.closest('.wrpr-read-btn');
    if (openBtn) {
      e.preventDefault();
      const url = openBtn.getAttribute('data-pdf') || '';
      const rid = openBtn.getAttribute('data-reader') || '';
      if (!url) return;
      openPdf(url, rid);
    }
  });

  // Navigasyon
  btnPrev && btnPrev.addEventListener('click', function () {
    if (!pdfDoc) return;
    if (currentPage <= 1) return;
    renderPage(currentPage - 1);
  });
  btnNext && btnNext.addEventListener('click', function () {
    if (!pdfDoc) return;
    if (currentPage >= pdfDoc.numPages) return;
    renderPage(currentPage + 1);
  });
  btnClose && btnClose.addEventListener('click', hideModal);

  // Resize’da yeniden çiz (isteğe bağlı)
  window.addEventListener('resize', function () {
    if (pdfDoc && modal.style.display === 'flex') renderPage(currentPage);
  });
})();
