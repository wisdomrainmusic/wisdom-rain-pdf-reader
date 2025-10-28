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
  const modal = document.getElementById('wrpr-modal');
  const canvasEl = modal ? modal.querySelector('#wrpr-pdf-canvas') : null;
  const btnPrev = modal ? modal.querySelector('#wrpr-prev') : null;
  const btnNext = modal ? modal.querySelector('#wrpr-next') : null;
  const btnClose = modal ? modal.querySelector('#wrpr-close') : null;
  const pageInfoEl = modal ? modal.querySelector('.wrpr-page-info') : null;
  const hasFullscreenSupport =
    !!modal && typeof modal.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function';

  function wrprAddFullscreenButton(targetModal) {
    if (!targetModal || targetModal.querySelector('.wrpr-fs-btn')) {
      return null;
    }

    const fsBtn = document.createElement('button');
    fsBtn.className = 'wrpr-fs-btn';
    fsBtn.type = 'button';
    fsBtn.innerHTML = '⤢';
    fsBtn.title = 'Toggle Fullscreen';
    fsBtn.setAttribute('aria-pressed', 'false');
    fsBtn.setAttribute('aria-label', 'Toggle fullscreen');

    const syncState = () => {
      const isActive = document.fullscreenElement === targetModal;
      fsBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      fsBtn.classList.toggle('wrpr-fs-btn--active', isActive);
    };

    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        targetModal.requestFullscreen().catch(console.warn);
      } else {
        if (typeof document.exitFullscreen === 'function') {
          const result = document.exitFullscreen();
          if (result && typeof result.catch === 'function') {
            result.catch(console.warn);
          }
        }
      }
    });

    document.addEventListener('fullscreenchange', syncState);
    syncState();

    targetModal.appendChild(fsBtn);
    return fsBtn;
  }

  if (hasFullscreenSupport) {
    wrprAddFullscreenButton(modal);
  }

  let pdfDoc = null;
  let currentPage = 1;
  let readerId = '';
  let pdfUrl = '';
  let loadingTask = null;
  let pendingPage = null;
  let progressKey = '';
  let progressTimer = null;
  let pendingProgress = null;
  let renderCycle = 0;
  let renderFrameToken = null;

  if (typeof window.renderLock !== 'boolean') {
    window.renderLock = false;
  }

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
      const disabled = !hasDoc || currentPage <= 1;
      btnPrev.disabled = disabled;
      btnPrev.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      btnPrev.classList.toggle('is-disabled', disabled);
    }
    if (btnNext) {
      const disabled = !hasDoc || (pdfDoc ? currentPage >= pdfDoc.numPages : true);
      btnNext.disabled = disabled;
      btnNext.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      btnNext.classList.toggle('is-disabled', disabled);
    }
  }

  function showModal() {
    if (!modal) {
      return;
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }

  function hideModal() {
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    document.documentElement.style.overflow = '';
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      canvasEl.classList.remove('wrpr-canvas-fade-out');
      canvasEl.removeAttribute('width');
      canvasEl.removeAttribute('height');
      canvasEl.style.removeProperty('width');
      canvasEl.style.removeProperty('height');
    }
    if (pdfDoc) {
      try {
        pdfDoc.destroy();
      } catch (err) {
        // Ignore destruction errors.
      }
    }
    pdfDoc = null;
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        loadingTask.destroy();
      } catch (err) {
        // Ignore destruction errors.
      }
    }
    loadingTask = null;
    flushProgressWrite();
    progressKey = '';
    pendingProgress = null;
    if (progressTimer) {
      window.clearTimeout(progressTimer);
      progressTimer = null;
    }
    if (renderFrameToken !== null) {
      window.cancelAnimationFrame(renderFrameToken);
      renderFrameToken = null;
    }
    pendingPage = null;
    renderCycle = 0;
    window.renderLock = false;
    currentPage = 1;
    updateNavState();
    setPageInfo('Loading PDF...');
  }

  function saveProgress(page) {
    if (!progressKey) return;
    pendingProgress = page;
    if (progressTimer) {
      window.clearTimeout(progressTimer);
    }
    progressTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(progressKey, String(pendingProgress));
      } catch (err) {
        // Ignore storage errors (e.g., private mode, quota exceeded)
      }
      progressTimer = null;
    }, 200);
  }

  function flushProgressWrite() {
    if (!progressKey) return;
    if (progressTimer) {
      window.clearTimeout(progressTimer);
      progressTimer = null;
    }
    if (pendingProgress != null) {
      try {
        localStorage.setItem(progressKey, String(pendingProgress));
      } catch (err) {
        // Ignore storage errors.
      }
    }
  }

  function getSafeAreaInsets() {
    const rootStyle = window.getComputedStyle(document.documentElement);
    const parseInset = (name) => {
      const raw = rootStyle.getPropertyValue(`--wrpr-safe-area-${name}`);
      const value = parseFloat(raw);
      return Number.isFinite(value) ? value : 0;
    };
    return {
      top: parseInset('top'),
      right: parseInset('right'),
      bottom: parseInset('bottom'),
      left: parseInset('left'),
    };
  }

  function computeResponsiveScale(viewport) {
    const safe = getSafeAreaInsets();
    const usableWidth = Math.max(0, window.innerWidth - safe.left - safe.right);
    const usableHeight = Math.max(0, window.innerHeight - safe.top - safe.bottom);
    const widthScale = viewport.width ? (usableWidth * 0.96) / viewport.width : 1;
    const heightScale = viewport.height ? (usableHeight * 0.9) / viewport.height : 1;
    const result = Math.min(widthScale, heightScale);
    return result > 0 ? result : 1;
  }

  function ensureRenderLoop() {
    if (renderFrameToken !== null) {
      return;
    }
    renderFrameToken = window.requestAnimationFrame(() => {
      renderFrameToken = null;
      if (window.renderLock) {
        ensureRenderLoop();
        return;
      }
      processRenderQueue();
    });
  }

  function requestRender(num) {
    if (!pdfDoc || !canvasEl) return;
    pendingPage = num;
    ensureRenderLoop();
  }

  async function processRenderQueue() {
    if (!pdfDoc || !canvasEl) {
      window.renderLock = false;
      return;
    }
    if (window.renderLock) {
      return;
    }
    window.renderLock = true;
    try {
      while (pendingPage !== null) {
        const targetPage = pendingPage;
        pendingPage = null;
        await renderPageInternal(targetPage);
      }
    } finally {
      window.renderLock = false;
      if (pendingPage !== null && pdfDoc && canvasEl) {
        ensureRenderLoop();
      }
    }
  }

  async function renderPageInternal(num) {
    if (!pdfDoc || !canvasEl) return;
    const activeDoc = pdfDoc;
    const activeKey = progressKey;
    try {
      const cycleId = ++renderCycle;
      canvasEl.classList.add('wrpr-canvas-fade-out');

      const page = await activeDoc.getPage(num);
      const vp = page.getViewport({ scale: 1 });
      const scale = computeResponsiveScale(vp);
      const viewport = page.getViewport({ scale });
      const ctx = canvasEl.getContext('2d');
      if (!ctx) {
        if (canvasEl) {
          canvasEl.classList.remove('wrpr-canvas-fade-out');
        }
        return;
      }
      const outputScale = window.devicePixelRatio || 1;
      const targetWidth = Math.floor(viewport.width * outputScale);
      const targetHeight = Math.floor(viewport.height * outputScale);
      if (canvasEl.width !== targetWidth) {
        canvasEl.width = targetWidth;
      }
      if (canvasEl.height !== targetHeight) {
        canvasEl.height = targetHeight;
      }
      const cssWidth = `${viewport.width}px`;
      const cssHeight = `${viewport.height}px`;
      if (canvasEl.style.width !== cssWidth) {
        canvasEl.style.width = cssWidth;
      }
      if (canvasEl.style.height !== cssHeight) {
        canvasEl.style.height = cssHeight;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      const renderContext = { canvasContext: ctx, viewport };
      if (outputScale !== 1) {
        renderContext.transform = [outputScale, 0, 0, outputScale, 0, 0];
      }
      await page.render(renderContext).promise;
      if (!pdfDoc || pdfDoc !== activeDoc) {
        canvasEl.classList.remove('wrpr-canvas-fade-out');
        return;
      }
      if (cycleId !== renderCycle) {
        canvasEl.classList.remove('wrpr-canvas-fade-out');
        return;
      }
      window.requestAnimationFrame(() => {
        if (canvasEl && cycleId === renderCycle) {
          canvasEl.classList.remove('wrpr-canvas-fade-out');
        }
      });
      currentPage = num;
      updatePageInfo();
      updateNavState();
      if (progressKey === activeKey) {
        saveProgress(num);
      }
    } catch (err) {
      canvasEl.classList.remove('wrpr-canvas-fade-out');
      setPageInfo(`PDF render error: ${err.message || err}`);
    }
  }

  async function openPDF(url, rid) {
    if (!modal || !canvasEl) {
      // Modal shell is required for the reader to operate.
      return;
    }
    readerId = rid;
    pdfUrl = url;
    flushProgressWrite();
    progressKey = `wrpr_progress_${readerId}_${pdfUrl}`;
    pendingProgress = null;
    showModal();
    setPageInfo('Loading PDF...');
    updateNavState();
    if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
      setPageInfo('PDF.js is not available.');
      return;
    }
    try {
      if (loadingTask && typeof loadingTask.destroy === 'function') {
        try {
          loadingTask.destroy();
        } catch (err) {
          // Ignore errors from destroying stale loading tasks.
        }
      }
      loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl });
      pdfDoc = await loadingTask.promise;
      updateNavState();
      const stored = parseInt(localStorage.getItem(progressKey) || '1', 10);
      const startPage = Number.isFinite(stored) ? Math.min(Math.max(1, stored), pdfDoc.numPages) : 1;
      currentPage = startPage;
      updatePageInfo();
      pendingPage = null;
      requestRender(startPage);
    } catch (err) {
      setPageInfo(`PDF load error: ${err.message}`);
      pdfDoc = null;
      updateNavState();
    }
  }

  // --- Button bindings ---
  function debounce(fn, wait) {
    let timer = null;
    let queuedArgs = null;
    return (...args) => {
      if (!timer) {
        fn(...args);
        timer = window.setTimeout(() => {
          timer = null;
          if (queuedArgs) {
            const latest = queuedArgs;
            queuedArgs = null;
            fn(...latest);
          }
        }, wait);
        return;
      }

      queuedArgs = args;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (queuedArgs) {
          const latest = queuedArgs;
          queuedArgs = null;
          fn(...latest);
        }
      }, wait);
    };
  }

  if (btnPrev) {
    const handlePrev = debounce(() => {
      if (pdfDoc && currentPage > 1) {
        requestRender(currentPage - 1);
      }
    }, 150);
    btnPrev.addEventListener('click', () => handlePrev());
  }
  if (btnNext) {
    const handleNext = debounce(() => {
      if (pdfDoc && pdfDoc.numPages && currentPage < pdfDoc.numPages) {
        requestRender(currentPage + 1);
      }
    }, 150);
    btnNext.addEventListener('click', () => handleNext());
  }
  if (btnClose) {
    btnClose.addEventListener('click', hideModal);
  }

  updateNavState();

  function bindReader(wrapper) {
    const wrapperReaderId = wrapper.dataset.readerId || '';
    const bookCards = Array.from(wrapper.querySelectorAll('.wrpr-book-card'));

    wrapper.querySelectorAll('.wrpr-read-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const pdf = btn.dataset.pdf || '';
        if (!pdf) {
          return;
        }
        const rid = btn.dataset.reader || wrapperReaderId;
        openPDF(pdf, rid);
      });
    });

    const langSelects = wrapper.querySelectorAll('.wrpr-lang-select');
    if (!langSelects.length || !bookCards.length) {
      return;
    }

    const applyFilter = (value) => {
      const active = value === 'All' ? null : value;
      bookCards.forEach((card) => {
        const match = !active || card.dataset.lang === active;
        card.style.display = match ? 'flex' : 'none';
      });
    };

    langSelects.forEach((select) => {
      select.addEventListener('change', (event) => {
        applyFilter(event.target.value);
      });
      applyFilter(select.value);
    });
  }

  document.querySelectorAll('.wrpr-reader-wrapper').forEach((wrapper) => {
    bindReader(wrapper);
  });

  const handleViewportChange = debounce(() => {
    if (pdfDoc && canvasEl && currentPage) {
      requestRender(currentPage);
    }
  }, 120);

  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  document.addEventListener('fullscreenchange', () => {
    if (!modal) {
      return;
    }
    if (document.fullscreenElement === modal || !document.fullscreenElement) {
      handleViewportChange();
    }
  });
})();
