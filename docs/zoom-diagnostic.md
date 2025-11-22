# Zoom Diagnostic

This note tracks the zoom/pinch behaviour issues identified for the Wisdom Rain PDF Reader and the mitigations applied to keep A6 pagination stable while allowing native zoom controls to function on mobile and desktop.

## Applied Fixes
- Root scroll lock html → body.wrpr-modal-open sınıfı ile değiştirildi.
- .wrpr-reader-content / .wr-page overflow ayarları zoom sırasında hafif kaydırmaya izin verecek şekilde güncellendi.
- touch-action: pinch-zoom pan-y ile reader bölgesi gesture-friendly hale getirildi.
- runtime viewport normalizer ile tüm meta viewport etiketleri user-scalable=yes ve maximum-scale=5 ile normalize ediliyor.
