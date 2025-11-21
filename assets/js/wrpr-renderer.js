/**
 * Wisdom Rain Reader (HTML/Word Edition)
 * - Uses HTML/Word-converted pages with .wr-page elements instead of PDF.js canvases.
 * - PDF.js has been fully removed; rendering is DOM-based for translation friendliness.
 * - Page navigation with localStorage progress resume is preserved.
 */
(function () {
  const modal = document.getElementById('wrpr-modal');
  if (!modal) return;

  const modalContent = modal.querySelector('#wrpr-modal-content');
  const readerContent = modal.querySelector('#wrpr-reader-content');
  const btnPrev = modal.querySelector('#wrpr-prev-page, #wrpr-prev');
  const btnNext = modal.querySelector('#wrpr-next-page, #wrpr-next');
  const btnClose = modal.querySelector('#wrpr-close');
  const pageInfoEl = modal.querySelector('.wrpr-page-info');

  let WR_PAGES = [];
  let currentPage = 0;
  let readerId = '';
  let htmlUrl = '';
  let progressKey = '';
  let pageSource = null;

  function setPageInfo(text) {
    if (pageInfoEl) pageInfoEl.textContent = text;
  }

  function calculatePageLimit() {
    const isMobile = window.innerWidth <= 600;
    const maxHeight = Math.max(320, Math.floor(window.innerHeight * (isMobile ? 0.8 : 0.85)));
    return isMobile ? maxHeight : Math.min(Math.max(720, maxHeight), 780);
  }

  function splitIntoPages(htmlElement, pageHeightLimit) {
    const limit = Math.max(200, pageHeightLimit || calculatePageLimit());
    const pages = [];

    const measurementContainer = document.createElement('div');
    measurementContainer.style.position = 'absolute';
    measurementContainer.style.visibility = 'hidden';
    measurementContainer.style.pointerEvents = 'none';
    measurementContainer.style.left = '0';
    measurementContainer.style.top = '0';
    measurementContainer.style.width = readerContent ? `${readerContent.clientWidth || readerContent.offsetWidth || 640}px` : '100%';
    measurementContainer.style.opacity = '0';

    document.body.appendChild(measurementContainer);

    const createPage = (seedNode = null) => {
      const page = document.createElement('div');
      page.className = 'wr-page';
      if (seedNode) page.appendChild(seedNode);
      measurementContainer.appendChild(page);
      return page;
    };

    let workingPage = createPage();

    Array.from(htmlElement.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return;

      const clone = node.cloneNode(true);
      workingPage.appendChild(clone);

      if (workingPage.scrollHeight > limit) {
        workingPage.removeChild(clone);

        if (workingPage.childNodes.length) {
          pages.push(workingPage.cloneNode(true));
          workingPage.replaceChildren();
          workingPage.appendChild(clone);
        }

        if (workingPage.scrollHeight > limit) {
          pages.push(workingPage.cloneNode(true));
          workingPage.replaceChildren();
        }
      }
    });

    if (workingPage.childNodes.length) {
      pages.push(workingPage.cloneNode(true));
    }

    document.body.removeChild(measurementContainer);

    return pages;
  }

  function updateNavState() {
    const hasPages = WR_PAGES.length > 0;
    if (btnPrev) btnPrev.disabled = !hasPages || currentPage <= 0;
    if (btnNext) btnNext.disabled = !hasPages || currentPage >= WR_PAGES.length - 1;
  }

  function showModal() {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }

  function clearReader() {
    if (readerContent) readerContent.innerHTML = '';
    WR_PAGES = [];
    currentPage = 0;
    readerId = '';
    htmlUrl = '';
    progressKey = '';
    pageSource = null;
  }

  function hideModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    clearReader();
    setPageInfo('Page 1 / 1');
    updateNavState();
  }

  function saveProgress() {
    if (!progressKey) return;
    try {
      localStorage.setItem(progressKey, String(currentPage));
    } catch (err) {
      console.warn('WRPR: unable to save progress', err);
    }
  }

  function restoreProgress(totalPages) {
    if (!progressKey) return 0;
    try {
      const raw = localStorage.getItem(progressKey);
      const idx = parseInt(raw || '0', 10);
      if (Number.isFinite(idx) && idx >= 0 && idx < totalPages) return idx;
    } catch (err) {
      console.warn('WRPR: unable to restore progress', err);
    }
    return 0;
  }

  function renderPage(index) {
    if (!readerContent) return;
    if (!WR_PAGES.length) {
      readerContent.innerHTML = '<div class="wr-page"><p>No content available.</p></div>';
      setPageInfo('Page 0 / 0');
      updateNavState();
      return;
    }
    const page = WR_PAGES[index];
    if (!page) return;

    const clone = page.cloneNode(true);
    clone.setAttribute('data-page', index + 1);
    if (!clone.classList.contains('wr-page')) clone.classList.add('wr-page');

    readerContent.innerHTML = '';
    readerContent.appendChild(clone);

    currentPage = index;
    setPageInfo(`Page ${index + 1} / ${WR_PAGES.length}`);
    saveProgress();
    updateNavState();
  }

  function paginateFromSource(targetIndex = 0) {
    if (!pageSource) return;

    const limit = calculatePageLimit();
    WR_PAGES = splitIntoPages(pageSource, limit);
    const safeIndex = Math.min(Math.max(0, targetIndex), Math.max(WR_PAGES.length - 1, 0));
    renderPage(safeIndex);
  }

  async function openHTMLReader(url, rid) {
    readerId = rid || '';
    htmlUrl = url || '';
    progressKey = `wrpr_page_${readerId || 'default'}`;

    if (!htmlUrl) return;

    showModal();
    setPageInfo('Loading...');
    updateNavState();

    try {
      const response = await fetch(htmlUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      pageSource = doc.body || doc.documentElement;

      WR_PAGES = splitIntoPages(pageSource, calculatePageLimit());
      const startIndex = Math.min(restoreProgress(WR_PAGES.length), Math.max(WR_PAGES.length - 1, 0));
      renderPage(startIndex);
    } catch (err) {
      console.error('WRPR load error', err);
      if (readerContent) {
        readerContent.innerHTML = `<div class="wr-page"><p>${err.message}</p></div>`;
      }
      setPageInfo('Load error');
      updateNavState();
    }
  }

  function syncReaderHeight() {
    if (!readerContent || !modalContent) return;
    const maxHeight = Math.max(200, Math.floor(window.innerHeight * 0.85));
    readerContent.style.maxHeight = `${maxHeight}px`;
  }

  function repaginateOnResize() {
    if (!pageSource || modal.getAttribute('aria-hidden') === 'true') return;
    const target = Math.min(currentPage, Math.max(WR_PAGES.length - 1, 0));
    paginateFromSource(target);
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentPage > 0) renderPage(currentPage - 1);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (currentPage < WR_PAGES.length - 1) renderPage(currentPage + 1);
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', hideModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      hideModal();
    }
  });

  function bindReader(wrapper) {
    const wrapperReaderId = wrapper.dataset.readerId || '';
    const bookCards = [...wrapper.querySelectorAll('.wrpr-book-card')];

    wrapper.querySelectorAll('.wrpr-read-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const html = btn.dataset.html || btn.dataset.pdf || '';
        if (!html) return;
        const rid = btn.dataset.reader || wrapperReaderId || 'default';
        openHTMLReader(html, rid);
      });
    });

    const langSelects = wrapper.querySelectorAll('.wrpr-lang-select');
    if (!langSelects.length || !bookCards.length) return;

    const applyFilter = (value) => {
      const active = value === 'All' ? null : value;
      bookCards.forEach((card) => {
        card.style.display = !active || card.dataset.lang === active ? 'flex' : 'none';
      });
    };

    langSelects.forEach((select) => {
      select.addEventListener('change', (e) => applyFilter(e.target.value));
      applyFilter(select.value);
    });
  }

  document.querySelectorAll('.wrpr-reader-wrapper').forEach((wrapper) => bindReader(wrapper));

  syncReaderHeight();
  window.addEventListener('resize', () => {
    syncReaderHeight();
    repaginateOnResize();
  });
  window.addEventListener('orientationchange', () => {
    syncReaderHeight();
    repaginateOnResize();
  });
})();
