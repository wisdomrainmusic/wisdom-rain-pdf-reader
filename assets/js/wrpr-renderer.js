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
  let isMobile = window.innerWidth <= 600;

  function setPageInfo(text) {
    if (pageInfoEl) pageInfoEl.textContent = text;
  }

  function paginateFixed(bodyElement, pageHeight) {
    const pages = [];
    const source = bodyElement.cloneNode(true);

    const measurementContainer = document.createElement('div');
    measurementContainer.style.position = 'absolute';
    measurementContainer.style.visibility = 'hidden';
    measurementContainer.style.pointerEvents = 'none';
    measurementContainer.style.left = '0';
    measurementContainer.style.top = '0';
    measurementContainer.style.width = readerContent
      ? `${readerContent.clientWidth || readerContent.offsetWidth || 640}px`
      : '100%';
    measurementContainer.style.opacity = '0';

    document.body.appendChild(measurementContainer);

    const createPage = () => {
      const page = document.createElement('div');
      page.className = 'wr-page';
      measurementContainer.appendChild(page);
      return page;
    };

    let workingPage = createPage();

    Array.from(source.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return;

      const clone = node.cloneNode(true);
      workingPage.appendChild(clone);

      if (workingPage.scrollHeight > pageHeight) {
        workingPage.removeChild(clone);

        if (workingPage.childNodes.length) {
          pages.push(workingPage.outerHTML);
          workingPage = createPage();
        }

        workingPage.appendChild(clone);

        if (workingPage.scrollHeight > pageHeight || workingPage.childNodes.length === 1) {
          pages.push(workingPage.outerHTML);
          workingPage = createPage();
        }
      }
    });

    if (workingPage.childNodes.length) {
      pages.push(workingPage.outerHTML);
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

    const pageHTML = WR_PAGES[index];
    if (!pageHTML) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = pageHTML;
    const pageEl = wrapper.firstElementChild;

    if (pageEl) {
      pageEl.setAttribute('data-page', index + 1);
      if (!pageEl.classList.contains('wr-page')) pageEl.classList.add('wr-page');
    }

    readerContent.innerHTML = '';
    if (pageEl) readerContent.appendChild(pageEl);

    currentPage = index;
    setPageInfo(`Page ${index + 1} / ${WR_PAGES.length}`);
    saveProgress();
    updateNavState();
  }

  async function openHTMLReader(url, rid) {
    readerId = rid || '';
    htmlUrl = url || '';
    progressKey = `wrpr_page_${readerId || 'default'}`;

    if (!htmlUrl) return;

    isMobile = window.innerWidth <= 600;

    showModal();
    setPageInfo('Loading...');
    updateNavState();

    try {
      const response = await fetch(htmlUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const body = doc.body || doc.documentElement;
      const PAGE_HEIGHT = isMobile ? 1100 : 1400;

      WR_PAGES = paginateFixed(body, PAGE_HEIGHT);
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
    isMobile = window.innerWidth <= 600;
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
        const html = btn.dataset.html || '';
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
