/**
 * Wisdom Rain Reader (HTML/Word Edition)
 * - Uses HTML/Word-converted pages with .wr-page elements instead of PDF.js canvases.
 * - PDF.js has been fully removed; rendering is DOM-based for translation friendliness.
 * - Page navigation with localStorage progress resume is preserved.
 */
// --- WRPR A6 PAGE CONSTANTS ---
const WRPR_BASE_PAGE_HEIGHT = 680; // A6 içerik yüksekliği (px)
const WRPR_MODAL_BUFFER = 180; // nav/info yüksekliği için ek alan
const WRPR_RESIZE_DEBOUNCE = 180;

let PAGE_HEIGHT = 0; // runtime'da set edilecek
let ORIGINAL_BODY = null;
let CURRENT_PAGE = 0;
let CURRENT_READER_ID = null;
let MODAL_OPEN = false;

async function cleanRemoteHTML(html) {
  if (!html || typeof wrprCleanerData === 'undefined' || !wrprCleanerData.ajaxUrl) {
    return html || '';
  }

  try {
    const params = new URLSearchParams();
    params.append('action', 'wrpr_clean_html');
    params.append('nonce', wrprCleanerData.nonce || '');
    params.append('html', html);

    const response = await fetch(wrprCleanerData.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: params,
    });

    if (!response.ok) return html;
    const result = await response.json();
    if (result && result.success && typeof result.data === 'string') {
      return result.data;
    }
  } catch (err) {
    console.warn('WRPR cleanHTML failed', err);
  }

  return html;
}

function computePageHeight() {
  const viewportCap = Math.floor(window.innerHeight * 0.92);
  return Math.max(400, Math.min(WRPR_BASE_PAGE_HEIGHT, viewportCap));
}
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
  let resizeTimer = null;

  function setPageInfo(text) {
    if (pageInfoEl) pageInfoEl.textContent = text;
  }

  function createCloneWithText(node, text) {
    const shallow = node.cloneNode(false);
    shallow.textContent = text;
    shallow.style.breakInside = 'avoid';
    shallow.style.pageBreakInside = 'avoid';
    shallow.style.webkitColumnBreakInside = 'avoid';
    return shallow;
  }

  function splitTextNodeToFit(node, page, maxHeight) {
    const originalText = (node.textContent || '').trim();
    if (!originalText) return null;

    const attemptSplit = (parts) => {
      let low = 1;
      let high = parts.length;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const firstText = parts.slice(0, mid).join(' ');
        const clone = createCloneWithText(node, firstText);
        page.appendChild(clone);
        const fits = page.scrollHeight <= maxHeight;
        page.removeChild(clone);

        if (fits) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (!best) return null;

      const first = createCloneWithText(node, parts.slice(0, best).join(' '));
      const remainder = parts.slice(best).join(' ');
      const second = remainder ? createCloneWithText(node, remainder) : null;
      return { first, second };
    };

    const words = originalText.split(/\s+/).filter(Boolean);
    let result = attemptSplit(words);

    if (!result && words.length === 1) {
      const chars = originalText.split('');
      result = attemptSplit(chars);
    }

    return result;
  }

  function cleanWrapperNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.tagName === 'SPAN' && !node.attributes.length && !node.textContent.trim()) {
        toRemove.push(node);
      }
      if (node.tagName === 'DIV' && !node.attributes.length && !node.textContent.trim()) {
        toRemove.push(node);
      }
    }
    toRemove.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
  }

  function paginateFixed(bodyElement) {
    const pages = [];
    const source = bodyElement.cloneNode(true);
    cleanWrapperNodes(source);

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
      page.style.height = `${PAGE_HEIGHT}px`;
      measurementContainer.appendChild(page);
      return page;
    };

    let workingPage = createPage();
    const nodes = Array.from(source.childNodes);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (node.nodeType === 3 && !node.textContent.trim()) continue;
      if (node.tagName === 'P' && node.textContent.trim().length === 0) continue;

      const isHeading = ['H1', 'H2', 'H3'].includes(node.tagName);
      const nextNode = nodes[i + 1];

      const prepareClone = (n) => {
        const c = n.cloneNode(true);
        if (c.nodeType === Node.ELEMENT_NODE) {
          c.style.breakInside = 'avoid';
          c.style.pageBreakInside = 'avoid';
          c.style.webkitColumnBreakInside = 'avoid';
        }
        return c;
      };

      if (isHeading && workingPage.childNodes.length === 0 && nextNode) {
        const headingClone = prepareClone(node);
        workingPage.appendChild(headingClone);
        const headingHeight = workingPage.scrollHeight;
        if (headingHeight <= PAGE_HEIGHT * 0.4) {
          const nextClone = prepareClone(nextNode);
          workingPage.appendChild(nextClone);
          if (workingPage.scrollHeight > PAGE_HEIGHT) {
            workingPage.removeChild(nextClone);
          } else {
            i += 1;
            continue;
          }
        }
        workingPage.removeChild(headingClone);
      }

      const clone = prepareClone(node);
      workingPage.appendChild(clone);

      if (workingPage.scrollHeight > PAGE_HEIGHT) {
        workingPage.removeChild(clone);

        if (clone.tagName === 'P' || ['H1', 'H2', 'H3'].includes(clone.tagName)) {
          const splitResult = splitTextNodeToFit(clone, workingPage, PAGE_HEIGHT);
          if (splitResult) {
            workingPage.appendChild(splitResult.first);
            if (workingPage.scrollHeight <= PAGE_HEIGHT) {
              pages.push(workingPage.outerHTML);
              workingPage = createPage();
            } else {
              workingPage.removeChild(splitResult.first);
            }

            if (splitResult.second) {
              nodes.splice(i + 1, 0, splitResult.second);
            }
            continue;
          }
        }

        if (workingPage.childNodes.length) {
          pages.push(workingPage.outerHTML);
          workingPage = createPage();
        }

        workingPage.appendChild(clone);

        if (workingPage.scrollHeight > PAGE_HEIGHT) {
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

  function applyPageHeight() {
    PAGE_HEIGHT = computePageHeight();
    document.documentElement.style.setProperty('--wrpr-page-height', `${PAGE_HEIGHT}px`);
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
    if (pageEl) {
      const shell = document.createElement('div');
      shell.className = 'wr-page-shell';
      shell.appendChild(pageEl);
      readerContent.appendChild(shell);
    }

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

    showModal();
    setPageInfo('Loading...');
    updateNavState();

    try {
      const response = await fetch(htmlUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rawHtml = await response.text();
      const cleanHtml = await cleanRemoteHTML(rawHtml);

      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanHtml, 'text/html');
      const body = doc.body || doc.documentElement;
      ORIGINAL_BODY = body.cloneNode(true);

      applyPageHeight();
      syncReaderHeight();

      WR_PAGES = paginateFixed(ORIGINAL_BODY);
      const restoredIndex = restoreProgress();
      const maxIndex = Math.max(WR_PAGES.length - 1, 0);
      const startIndex = Math.min(restoredIndex, maxIndex);
      CURRENT_PAGE = startIndex;
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
    const modalMax = Math.min(
      Math.floor(window.innerHeight * 0.95),
      PAGE_HEIGHT + WRPR_MODAL_BUFFER
    );
    readerContent.style.maxHeight = `${modalMax}px`;
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

  applyPageHeight();
  syncReaderHeight();

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyPageHeight();
      syncReaderHeight();

      if (!MODAL_OPEN || !ORIGINAL_BODY) return;

      const savedPage = CURRENT_PAGE || 0;
      const pages = paginateFixed(ORIGINAL_BODY);
      WR_PAGES = pages;

      const maxIndex = Math.max(WR_PAGES.length - 1, 0);
      const targetIndex = Math.min(Math.max(savedPage, 0), maxIndex);
      CURRENT_PAGE = targetIndex;
      renderPage(targetIndex);
    }, WRPR_RESIZE_DEBOUNCE);
  });

  window.addEventListener('orientationchange', () => {
    applyPageHeight();
    syncReaderHeight();
    if (!MODAL_OPEN || !ORIGINAL_BODY) return;
    const pages = paginateFixed(ORIGINAL_BODY);
    WR_PAGES = pages;
    const maxIndex = Math.max(WR_PAGES.length - 1, 0);
    const targetIndex = Math.min(Math.max(CURRENT_PAGE, 0), maxIndex);
    CURRENT_PAGE = targetIndex;
    renderPage(targetIndex);
  });
})();
