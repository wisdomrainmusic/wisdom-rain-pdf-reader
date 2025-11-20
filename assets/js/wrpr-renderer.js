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
  const modalContent = modal ? modal.querySelector('#wrpr-modal-content') : null;
  const canvasEl = modal ? modal.querySelector('#wrpr-pdf-canvas') : null;
  const btnPrev = modal ? modal.querySelector('#wrpr-prev') : null;
  const btnNext = modal ? modal.querySelector('#wrpr-next') : null;
  const btnClose = modal ? modal.querySelector('#wrpr-close') : null;
  const pageInfoEl = modal ? modal.querySelector('.wrpr-page-info') : null;
  const hasFullscreenSupport =
    !!modal && typeof modal.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function';

  // --------------------------------------------------
  //  FAST CLICK HELPER (tap latency fix)
  // --------------------------------------------------
  function bindFastAction(element, handler) {
    if (!element || typeof handler !== 'function') {
      return;
    }

    const getNow = () =>
      typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    let lastFastInvocation = 0;

    element.addEventListener('click', (event) => {
      if (getNow() - lastFastInvocation < 250) {
        return;
      }
      handler(event);
    });

    const invokeFast = (event) => {
      lastFastInvocation = getNow();
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      handler(event);
    };

    if (window.PointerEvent) {
      element.addEventListener(
        'pointerup',
        (event) => {
          if (event.pointerType && event.pointerType !== 'mouse') {
            invokeFast(event);
          }
        },
        { passive: false }
      );
    } else {
      element.addEventListener(
        'touchend',
        (event) => {
          invokeFast(event);
        },
        { passive: false }
      );
    }
  }

  // --------------------------------------------------
  //  SAFE AREA (NOTCH) DESTEK
  // --------------------------------------------------
  let safeAreaCache = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  let safeAreaDirty = true;

  function refreshSafeAreaCache() {
    const rootStyle = window.getComputedStyle(document.documentElement);
    const parseInset = (name) => {
      const raw = rootStyle.getPropertyValue(`--wrpr-safe-area-${name}`);
      const value = parseFloat(raw);
      return Number.isFinite(value) ? value : 0;
    };
    safeAreaCache = {
      top: parseInset('top'),
      right: parseInset('right'),
      bottom: parseInset('bottom'),
      left: parseInset('left'),
    };
    safeAreaDirty = false;
  }

  function markSafeAreaDirty() {
    safeAreaDirty = true;
  }

  function getSafeAreaInsets() {
    if (safeAreaDirty) {
      refreshSafeAreaCache();
    }
    return safeAreaCache;
  }

  // --------------------------------------------------
  //  FULLSCREEN BUTONU (SADECE DESKTOP)
  // --------------------------------------------------
  function wrprAddFullscreenButton(targetModal) {
    if (!targetModal || targetModal.querySelector('.wrpr-fs-btn')) {
      return null;
    }

    // Mobilde hiç ekleme
    if (window.innerWidth <= 1024) {
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

    bindFastAction(fsBtn, () => {
      if (!document.fullscreenElement) {
        targetModal.requestFullscreen().catch(console.warn);
      } else if (typeof document.exitFullscreen === 'function') {
        const result = document.exitFullscreen();
        if (result && typeof result.catch === 'function') {
          result.catch(console.warn);
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

  // --------------------------------------------------
  //  RENDER DURUM STATE
  // --------------------------------------------------
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

  // --------------------------------------------------
  //  ZOOM & PAN STATE (ALTIN SET)
  // --------------------------------------------------
  let zoomLevel = 1;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;

  let offsetX = 0;
  let offsetY = 0;

  function resetTransform() {
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    applyCanvasTransform();
  }

  function applyCanvasTransform() {
    if (!canvasEl) return;
    if (zoomLevel === 1 && offsetX === 0 && offsetY === 0) {
      canvasEl.style.transform = 'translate3d(0,0,0) scale(1)';
    } else {
      canvasEl.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${zoomLevel})`;
    }
  }

  // --------------------------------------------------
  //  MODAL AÇ/KAPA
  // --------------------------------------------------
  function showModal() {
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }

  function clearCanvas() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
    canvasEl.classList.remove('wrpr-canvas-fade-out');
    canvasEl.removeAttribute('width');
    canvasEl.removeAttribute('height');
    canvasEl.style.removeProperty('width');
    canvasEl.style.removeProperty('height');
    canvasEl.style.transform = 'translate3d(0,0,0) scale(1)';
  }

  function hideModal() {
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    document.documentElement.style.overflow = '';

    clearCanvas();
    resetTransform();

    if (pdfDoc) {
      try {
        pdfDoc.destroy();
      } catch (_) {}
    }
    pdfDoc = null;

    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        loadingTask.destroy();
      } catch (_) {}
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

  // --------------------------------------------------
  //  PROGRESS LOCALSTORAGE
  // --------------------------------------------------
  function saveProgress(page) {
    if (!progressKey) return;
    pendingProgress = page;
    if (progressTimer) {
      window.clearTimeout(progressTimer);
    }
    progressTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(progressKey, String(pendingProgress));
      } catch (_) {}
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
      } catch (_) {}
    }
  }

  // --------------------------------------------------
  //  RESPONSIVE SCALE (PAGE FIT)
  // --------------------------------------------------
  function computeResponsiveScale(viewport) {
    const safe = getSafeAreaInsets();

    let containerWidth;
    let containerHeight;

    if (modalContent) {
      const rect = modalContent.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = rect.height;
    } else {
      containerWidth = window.innerWidth - safe.left - safe.right;
      containerHeight = window.innerHeight - safe.top - safe.bottom;
    }

    const maxWidth = Math.max(0, containerWidth * 0.98);
    const maxHeight = Math.max(0, containerHeight * 0.86);

    const widthScale = viewport.width ? maxWidth / viewport.width : 1;
    const heightScale = viewport.height ? maxHeight / viewport.height : 1;

    const result = Math.min(widthScale, heightScale);
    return result > 0 ? result : 1;
  }

  // --------------------------------------------------
  //  RENDER QUEUE
  // --------------------------------------------------
  function ensureRenderLoop() {
    if (renderFrameToken !== null) return;
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
    if (window.renderLock) return;

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

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = computeResponsiveScale(baseViewport);
      const viewport = page.getViewport({ scale });

      const ctx = canvasEl.getContext('2d');
      if (!ctx) {
        canvasEl.classList.remove('wrpr-canvas-fade-out');
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

      // Yeni sayfa render sonrası: zoom / pan reset
      resetTransform();

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

  // --------------------------------------------------
  //  PDF AÇMA
  // --------------------------------------------------
  async function openPDF(url, rid) {
    if (!modal || !canvasEl) {
      return;
    }

    readerId = rid;
    pdfUrl = url;

    flushProgressWrite();
    progressKey = `wrpr_progress_${readerId}_${pdfUrl}`;
    pendingProgress = null;

    resetTransform();
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
        } catch (_) {}
      }

      loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl });
      pdfDoc = await loadingTask.promise;

      updateNavState();

      const stored = parseInt(localStorage.getItem(progressKey) || '1', 10);
      const startPage = Number.isFinite(stored)
        ? Math.min(Math.max(1, stored), pdfDoc.numPages)
        : 1;

      currentPage = startPage;
      updatePageInfo();

      pendingPage = null;
      requestRender(startPage);

      // İlk açılışta küçük görünme bug fix – bir kez daha render
      setTimeout(() => {
        if (pdfDoc && currentPage === startPage) {
          requestRender(startPage);
        }
      }, 40);
    } catch (err) {
      setPageInfo(`PDF load error: ${err.message}`);
      pdfDoc = null;
      updateNavState();
    }
  }

  // --------------------------------------------------
  //  BUTTON BINDINGS
  // --------------------------------------------------
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
    bindFastAction(btnPrev, () => handlePrev());
  }

  if (btnNext) {
    const handleNext = debounce(() => {
      if (pdfDoc && pdfDoc.numPages && currentPage < pdfDoc.numPages) {
        requestRender(currentPage + 1);
      }
    }, 150);
    bindFastAction(btnNext, () => handleNext());
  }

  if (btnClose) {
    bindFastAction(btnClose, () => hideModal());
  }

  updateNavState();

  // --------------------------------------------------
  //  WRAPPER BINDING (READ BUTTON + LANG FILTER)
  // --------------------------------------------------
  function bindReader(wrapper) {
    const wrapperReaderId = wrapper.dataset.readerId || '';
    const bookCards = Array.from(wrapper.querySelectorAll('.wrpr-book-card'));

    wrapper.querySelectorAll('.wrpr-read-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const pdf = btn.dataset.pdf || '';
        if (!pdf) return;
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

  // --------------------------------------------------
  //  TOUCH ENGINE – PINCH ZOOM + PAN + SWIPE
  // --------------------------------------------------
  if (canvasEl && modalContent) {
    let isPinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    let singleTouchActive = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let totalDeltaX = 0;
    let totalDeltaY = 0;
    let swipeConsumed = false;

    function getTouchDistance(e) {
      if (e.touches.length < 2) return 0;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function clampZoom(z) {
      if (z < MIN_ZOOM) return MIN_ZOOM;
      if (z > MAX_ZOOM) return MAX_ZOOM;
      return z;
    }

    function handleTouchStart(e) {
      if (!pdfDoc) return;

      if (e.touches.length === 2) {
        // Pinch başlıyor
        isPinching = true;
        singleTouchActive = false;
        swipeConsumed = true;
        pinchStartDist = getTouchDistance(e);
        pinchStartZoom = zoomLevel;
        e.preventDefault();
        return;
      }

      if (e.touches.length === 1) {
        // Tek parmak – zoom'a göre pan ya da swipe
        isPinching = false;
        singleTouchActive = true;
        swipeConsumed = false;

        const t = e.touches[0];
        touchStartX = lastTouchX = t.clientX;
        touchStartY = lastTouchY = t.clientY;
        totalDeltaX = 0;
        totalDeltaY = 0;
      }
    }

    function handleTouchMove(e) {
      if (!pdfDoc) return;

      // Pinch
      if (isPinching && e.touches.length >= 2) {
        const dist = getTouchDistance(e);
        if (pinchStartDist > 0 && dist > 0) {
          const ratio = dist / pinchStartDist;
          const newZoom = clampZoom(pinchStartZoom * ratio);
          zoomLevel = newZoom;
          applyCanvasTransform();
        }
        e.preventDefault();
        return;
      }

      if (!singleTouchActive || e.touches.length !== 1) {
        return;
      }

      const t = e.touches[0];
      const dx = t.clientX - lastTouchX;
      const dy = t.clientY - lastTouchY;
      lastTouchX = t.clientX;
      lastTouchY = t.clientY;
      totalDeltaX = t.clientX - touchStartX;
      totalDeltaY = t.clientY - touchStartY;

      // Zoom varsa → pan
      if (zoomLevel > 1.01) {
        offsetX += dx;
        offsetY += dy;
        applyCanvasTransform();
        swipeConsumed = true;
        e.preventDefault();
      }
    }

    function handleTouchEnd(e) {
      if (!pdfDoc) return;

      if (isPinching && e.touches.length < 2) {
        isPinching = false;
      }

      if (!singleTouchActive) {
        return;
      }

      // Tek dokunuş bitti
      singleTouchActive = false;

      // Zoom aktifken swipe yok
      if (zoomLevel > 1.01 || swipeConsumed) {
        return;
      }

      // Swipe dedect – Altın Set
      const absX = Math.abs(totalDeltaX);
      const absY = Math.abs(totalDeltaY);

      const SWIPE_MIN = 60;

      if (absX > SWIPE_MIN && absX > absY * 1.5) {
        if (totalDeltaX < 0 && pdfDoc && currentPage < pdfDoc.numPages) {
          // sola kaydırma → sonraki sayfa
          requestRender(currentPage + 1);
        } else if (totalDeltaX > 0 && pdfDoc && currentPage > 1) {
          // sağa kaydırma → önceki sayfa
          requestRender(currentPage - 1);
        }
      }
    }

    canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvasEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Desktop için hafif zoom (Ctrl + wheel)
    canvasEl.addEventListener(
      'wheel',
      (e) => {
        if (!pdfDoc) return;
        if (!e.ctrlKey) return; // native scroll bozulmasın

        e.preventDefault();
        const delta = e.deltaY;
        const factor = delta > 0 ? 0.9 : 1.1;
        zoomLevel = clampZoom(zoomLevel * factor);
        applyCanvasTransform();
      },
      { passive: false }
    );
  }

  // --------------------------------------------------
  //  RESIZE / ORIENTATION / FULLSCREEN
  // --------------------------------------------------
  const handleViewportChange = debounce(() => {
    if (pdfDoc && canvasEl && currentPage) {
      requestRender(currentPage);
    }
  }, 120);

  window.addEventListener('resize', () => {
    markSafeAreaDirty();
    handleViewportChange();
  });

  window.addEventListener('orientationchange', () => {
    markSafeAreaDirty();
    handleViewportChange();
  });

  document.addEventListener('fullscreenchange', () => {
    if (!modal) return;
    markSafeAreaDirty();
    if (document.fullscreenElement === modal || !document.fullscreenElement) {
      handleViewportChange();
    }
  });

  // İlk safe-area hesabı
  refreshSafeAreaCache();
})();
