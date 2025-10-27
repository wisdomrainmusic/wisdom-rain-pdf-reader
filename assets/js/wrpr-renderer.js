if (!window.pdfjsLib) {
    window.pdfjsLib = pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('wrpr-modal');
    const pdfContainer = document.getElementById('wrpr-pdf-container');
    const closeButton = document.getElementById('wrpr-close');
    let pdfLoadingTask = null;

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

    document.querySelectorAll('.wrpr-open-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();

            if (!modal || !pdfContainer) {
                return;
            }

            const pdfUrl = btn.dataset.pdf;
            const readerWrapper = btn.closest('.wrpr-reader-wrapper');
            const readerId = readerWrapper ? readerWrapper.dataset.readerId : '';

            pdfContainer.innerHTML = '';

            try {
                await renderPDF(pdfUrl, 'wrpr-pdf-container', readerId);
                modal.style.display = 'block';
            } catch (error) {
                console.error('PDF load error:', error);
                modal.style.display = 'none';
            }
        });
    });

    if (closeButton && modal) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
            if (pdfContainer) {
                pdfContainer.innerHTML = '';
            }
        });
    }

    async function renderPDF(url, containerId, readerId) {
        const container = document.getElementById(containerId);

        if (!container) {
            throw new Error('PDF container not found.');
        }

        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js not loaded.');
        }

        if (pdfLoadingTask && typeof pdfLoadingTask.destroy === 'function') {
            try {
                await pdfLoadingTask.destroy();
            } catch (destroyError) {
                // Ignore destroy errors and continue with the new load task.
            }
        }

        pdfLoadingTask = pdfjsLib.getDocument(url);
        const pdf = await pdfLoadingTask.promise;
        pdfLoadingTask = null;

        const savedPage = parseInt(localStorage.getItem('wrpr_progress_' + readerId), 10);
        const startPage = Number.isInteger(savedPage) && savedPage > 0 ? Math.min(savedPage, pdf.numPages) : 1;

        let renderQueue = Promise.resolve();

        function queueRender(pageNum) {
            renderQueue = renderQueue.then(() => drawPage(pageNum));
            renderQueue = renderQueue.catch(error => {
                renderQueue = Promise.resolve();
                throw error;
            });
            return renderQueue;
        }

        async function drawPage(pageNum) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            container.innerHTML = '';
            container.appendChild(canvas);

            await page.render({ canvasContext: context, viewport }).promise;
            localStorage.setItem('wrpr_progress_' + readerId, pageNum);
        }

        await queueRender(startPage);
    }
});
