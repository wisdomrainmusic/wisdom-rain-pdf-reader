/**
 * Wisdom Rain Reader (HTML/Word Edition)
 * - Uses HTML/Word-converted pages with .wr-page elements instead of PDF.js canvases.
 * - PDF.js has been fully removed; rendering is DOM-based for translation friendliness.
 * - Page navigation with localStorage progress resume is preserved.
 */
// --- WRPR A6 PAGE CONSTANTS ---
let PAGE_HEIGHT = 0; // runtime'da set edilecek
const WRPR_PAGE_HEIGHT_DESKTOP = 720; // A6 sabit yükseklik (px)
const WRPR_PAGE_HEIGHT_MOBILE_RATIO = 0.82; // ekranın %82'si (vh bazlı)
let ORIGINAL_BODY = null;
let CURRENT_PAGE = 0;
let CURRENT_READER_ID = null;
let MODAL_OPEN = false;
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
  let storageKey = '';
  let isMobile = window.innerWidth <= 600;

  function setPageInfo(text) {
    if (pageInfoEl) pageInfoEl.textContent = text;
  }

  function paginateFixed(bodyElement) {
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

    for (let node of Array.from(source.childNodes)) {
      // Skip empty text nodes
      if (node.nodeType === 3 && !node.textContent.trim()) {
        continue;
      }

      // Skip empty paragraphs
      if (node.tagName === 'P' && node.textContent.trim().length === 0) {
        continue;
      }

      const clone = node.cloneNode(true);
      if (clone.nodeType === Node.ELEMENT_NODE) {
        clone.style.breakInside = 'avoid';
        clone.style.pageBreakInside = 'avoid';
        clone.style.webkitColumnBreakInside = 'avoid';
      }
      workingPage.appendChild(clone);

      if (workingPage.scrollHeight > PAGE_HEIGHT) {
        workingPage.removeChild(clone);

        if (workingPage.childNodes.length) {
          pages.push(workingPage.outerHTML);
          workingPage = createPage();
        }

        workingPage.appendChild(clone);

        if (workingPage.scrollHeight > PAGE_HEIGHT || workingPage.childNodes.length === 1) {
          pages.push(workingPage.outerHTML);
          workingPage = createPage();
        }
      }
    }

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
    MODAL_OPEN = true;
  }

  function clearReader() {
    if (readerContent) readerContent.innerHTML = '';
    WR_PAGES = [];
    currentPage = 0;
    readerId = '';
    htmlUrl = '';
    storageKey = '';
  }

  function hideModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    MODAL_OPEN = false;
    clearReader();
    setPageInfo('Page 1 / 1');
    updateNavState();
  }

  function saveProgress() {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, CURRENT_PAGE);
    } catch (err) {
      console.warn('WRPR: unable to save progress', err);
    }
  }

  function restoreProgress() {
    if (!storageKey) return 0;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return 0;
    const page = parseInt(saved);
    return isNaN(page) ? 0 : page;
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
    CURRENT_PAGE = index;
    setPageInfo(`Page ${index + 1} / ${WR_PAGES.length}`);
    saveProgress();
    updateNavState();
  }

  async function openHTMLReader(url, rid) {
    readerId = rid || '';
    CURRENT_READER_ID = readerId;
    htmlUrl = url || '';
    const KEY = `wrpr_page_${readerId}_A6`;

    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(`wrpr_page_${readerId}`) && !k.endsWith('_A6')) {
        localStorage.removeItem(k);
      }
    });

    storageKey = KEY;

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
      ORIGINAL_BODY = body.cloneNode(true);
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        PAGE_HEIGHT = Math.floor(window.innerHeight * WRPR_PAGE_HEIGHT_MOBILE_RATIO);
      } else {
        PAGE_HEIGHT = WRPR_PAGE_HEIGHT_DESKTOP;
      }

      WR_PAGES = paginateFixed(ORIGINAL_BODY);
      const startIndex = Math.min(restoreProgress(), Math.max(WR_PAGES.length - 1, 0));
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
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      PAGE_HEIGHT = Math.floor(window.innerHeight * WRPR_PAGE_HEIGHT_MOBILE_RATIO);
    } else {
      PAGE_HEIGHT = WRPR_PAGE_HEIGHT_DESKTOP;
    }

    if (!MODAL_OPEN) return;

    const savedPage = CURRENT_PAGE || 0;

    WR_PAGES = paginateFixed(ORIGINAL_BODY);
    CURRENT_PAGE = Math.min(CURRENT_PAGE, WR_PAGES.length - 1);

    const maxPage = WR_PAGES.length - 1;
    const nextPage = Math.min(savedPage, maxPage);

    renderPage(nextPage);
  });
  window.addEventListener('orientationchange', () => {
    syncReaderHeight();
    repaginateOnResize();
  });
})();
