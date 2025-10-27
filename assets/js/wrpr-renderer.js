document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('wrpr-modal');
    const canvas = document.getElementById('wrpr-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let pdfDoc = null;
    let currentPage = 1;
    let pdfUrl = '';
    let readerId = '';

    if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Language filter
    document.querySelectorAll('.wrpr-language-filter').forEach(select => {
        select.addEventListener('change', e => {
            const val = e.target.value;
            document.querySelectorAll('.wrpr-book-card').forEach(card => {
                if (val === 'all' || card.dataset.language === val) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // Open PDF
    document.querySelectorAll('.wrpr-open-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            pdfUrl = e.target.dataset.pdf;
            readerId = e.target.closest('.wrpr-reader-wrapper').dataset.readerId;
            if (!modal || !canvas || !ctx) {
                return;
            }

            modal.style.display = 'block';

            const savedPage = localStorage.getItem('wrpr_progress_' + readerId);
            currentPage = savedPage ? parseInt(savedPage, 10) : 1;

            if (typeof pdfjsLib === 'undefined') {
                console.error('PDF.js not loaded.');
                return;
            }

            pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
                pdfDoc = pdf;
                renderPage(currentPage);
            });
        });
    });

    function renderPage(num) {
        if (!pdfDoc || !canvas || !ctx) {
            return;
        }

        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale: 1.2 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = { canvasContext: ctx, viewport: viewport };
            page.render(renderContext);

            localStorage.setItem('wrpr_progress_' + readerId, num);
        });
    }

    const closeButton = document.getElementById('wrpr-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
});
