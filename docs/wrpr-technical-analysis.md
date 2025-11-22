# WRPR PDF/HTML Reader Teknik Analiz ve Akış Raporu

## Dosya & Yapı Haritası
- **Ana eklenti bootstrap**: `wisdom-rain-pdf-reader.php` – path/url sabitleri, admin & shortcode yükleme, asset enqueue ve modal shell çıkışı burada yapılır.【F:wisdom-rain-pdf-reader.php†L17-L88】
- **Shortcode loader**: `includes/class-wrpr-shortcode.php` – `[wrpr_reader]` shortcode’unu tanımlar ve ön yüzde liste/okuma düğmelerini üretir.【F:includes/class-wrpr-shortcode.php†L8-L99】
- **Admin bootstrap**: `includes/wrpr-admin.php` – admin menüleri ve şablon fallback’ini kurar (reader akışıyla sınırlı temas: admin’deki frontend-reader şablonu).【F:includes/wrpr-admin.php†L13-L94】
- **JS**: `assets/js/wrpr-renderer.js` – modal reader, sayfalama motoru, localStorage geri yükleme, responsive repaginate mantığı.【F:assets/js/wrpr-renderer.js†L7-L342】
- **CSS**: `assets/css/wrpr-style.css` – kitap listesi, modal, sayfa kaplaması ve A6 teması dahil tüm görsel tanımlar.【F:assets/css/wrpr-style.css†L12-L536】
- **Template**: `templates/frontend-reader.php` – admin için basit “Manage Readers/Categories” yönlendirme şablonu (reader runtime’ına dokunmuyor).【F:templates/frontend-reader.php†L1-L15】

## Shortcode & Flow Analizi
### Shortcode → PHP Render → HTML → JS Init → Pagination → Player/Nav
1. **Shortcode tanımı**: `[wrpr_reader id="..."]` `WRPR_Shortcode::render_reader` ile kayıtlı.【F:includes/class-wrpr-shortcode.php†L8-L35】
2. **PHP render**: Seçilen reader’ın kitapları `wrpr-read-btn` düğmeleriyle listelenir; dil filtresi `wrpr-lang-select` ile gelir.【F:includes/class-wrpr-shortcode.php†L46-L96】
3. **Modal shell**: Footer’da global modal (`#wrpr-modal`, `#wrpr-reader-content`, nav butonları) basılır; JS bu yapıya bağlanır.【F:wisdom-rain-pdf-reader.php†L66-L88】
4. **JS init**: `wrpr-renderer.js` sayfa yüklendiğinde modal referanslarını alır, her `.wrpr-reader-wrapper` için `bindReader` ile click handler ekler; `wrpr-read-btn` tıklandığında `openHTMLReader` çağrılır.【F:assets/js/wrpr-renderer.js†L15-L314】
5. **HTML fetch & parse**: `openHTMLReader` uzak HTML’i fetch eder, `DOMParser` ile body’yi çıkarır, `ORIGINAL_BODY` klonlanır.【F:assets/js/wrpr-renderer.js†L200-L240】
6. **PAGE_HEIGHT seçimi**: Mobilde `window.innerHeight * 0.82`, desktop’ta `720px` olarak set edilir.【F:assets/js/wrpr-renderer.js†L231-L237】
7. **Pagination**: `paginateFixed` klon gövdeyi dolaşarak `PAGE_HEIGHT` dolana kadar node ekler, taşarsa yeni `.wr-page` açar.【F:assets/js/wrpr-renderer.js†L37-L118】
8. **Render & nav**: `renderPage` seçilen sayfanın HTML’ini `#wrpr-reader-content` içine yerleştirir ve nav durumlarını günceller; prev/next butonları dinleyicileri ile sayfa değiştirir.【F:assets/js/wrpr-renderer.js†L120-L199】【F:assets/js/wrpr-renderer.js†L262-L337】
9. **Progress**: localStorage key’i `wrpr_page_<reader>_A6`; açılışta eski key’ler temizlenir, sayfa değişiminde `saveProgress` çalışır, açılışta `restoreProgress` başlangıç sayfasını belirler.【F:assets/js/wrpr-renderer.js†L200-L249】【F:assets/js/wrpr-renderer.js†L152-L167】

### Word → Mammoth → HTML → Reader Pipeline (mevcut koddan türetim)
- **Heading mapping**: Mammoth’tan gelen `h1/h2/h3` doğrudan `.wr-page` içinde render edilir; CSS uppercase ve letter-spacing uygular.【F:assets/css/wrpr-style.css†L255-L269】
- **Paragraf yapısı**: `paginateFixed` boş `<p>` ve boş text node’ları atlar; her paragraf `margin-bottom:14px` (desktop) veya medya query ile daha dar padding alır.【F:assets/js/wrpr-renderer.js†L63-L93】【F:assets/css/wrpr-style.css†L271-L286】
- **Boş satırlar**: Boş `<p>`’ler skip edildiği için ardışık boşluklar sayfayı büyütmüyor.【F:assets/js/wrpr-renderer.js†L69-L72】
- **Bold/italic dönüşümü**: CSS `strong/em/a` için altın renk, `font-weight:700`; içerik yapısını JS değiştirmiyor, tamamen HTML’den gelir.【F:assets/css/wrpr-style.css†L275-L279】【F:assets/css/wrpr-style.css†L475-L479】
- **Sayfa bölme kritik noktaları**: `PAGE_HEIGHT` aşılınca son eklenen node çıkarılıp yeni sayfa açılıyor; clone tek başına da sayfaya sığmazsa sayfa hemen kapanıyor, bu da başlık/tek eleman sayfa üretimine sebep olabilir.【F:assets/js/wrpr-renderer.js†L94-L108】

## JS Pagination Engine Derin Analiz (wrpr-renderer.js)
- **paginateFixed(bodyElement)**
  - **Girdi**: HTML body DOM’u (klon). **Çıktı**: `.wr-page` outerHTML dizisi.【F:assets/js/wrpr-renderer.js†L37-L118】
  - **Ölçüm**: `measurementContainer` gizli mutlak container; genişlik `readerContent` genişliğinden türetilir; her aday `.wr-page` burada oluşturulur.【F:assets/js/wrpr-renderer.js†L41-L61】
  - **Akış**: Node klonlanır, break-inside avoid stilleri atanır, eklenir. `scrollHeight > PAGE_HEIGHT` olursa çıkarılır, mevcut sayfa push edilir, yeni sayfaya eklenir. Tek node bile sığmazsa tek başına sayfa push edilir.【F:assets/js/wrpr-renderer.js†L86-L108】
  - **Paragraf ortasından bölünme riski**: Node parça bazında (blok komple) taşır; iç metni bölmüyor. Ancak tek büyük paragraf `PAGE_HEIGHT`’i aşarsa tek çocuk olarak sayfaya eklenip hemen push edilir, yüksekliği aşsa bile bölünmez; bu “paragraf ortasından değil ama tek çocuk taşması” riskidir.【F:assets/js/wrpr-renderer.js†L94-L108】
- **measureContainer()**: Ayrı fonksiyon yok; ölçüm mantığı `paginateFixed` içinde `measurementContainer` kurulumu ve `readerContent` genişliğine bakışla yapılır.【F:assets/js/wrpr-renderer.js†L41-L61】
- **splitIntoPages()**: Ayrı isimli fonksiyon yok; sayfa bölme `paginateFixed`’in döngü ve limit kontrolü ile sağlanıyor (fiili “split” aynı blok içinde).【F:assets/js/wrpr-renderer.js†L63-L118】
- **isMobile, PAGE_HEIGHT, syncReaderHeight() zinciri**:
  - `isMobile` flag açılışta `window.innerWidth <= 600`, açılışta ve `repaginateOnResize`’de güncelleniyor fakat başka yerde kullanılmıyor; gerçek yükseklik seçimi `window.innerWidth < 768` kontrolüyle yapılıyor (tutarsız eşikler).【F:assets/js/wrpr-renderer.js†L31-L237】【F:assets/js/wrpr-renderer.js†L258-L340】
  - `PAGE_HEIGHT` mobilde `0.82 * window.innerHeight`, desktop’ta sabit `720`. Resize event’inde yeniden hesaplanıp MODAL açık ise yeniden paginate + render yapılıyor.【F:assets/js/wrpr-renderer.js†L231-L337】
  - `syncReaderHeight()` modal gövdesi için `maxHeight`’i `window.innerHeight*0.85` ile günceller; orientationchange ve ilk yüklemede çağrılıyor, PAGE_HEIGHT’tan bağımsız.【F:assets/js/wrpr-renderer.js†L252-L341】
- **Event tetikleyicileri**: `resize` → PAGE_HEIGHT güncelle, repaginate, mevcut sayfa korunmaya çalışılır. `orientationchange` → yalnızca `syncReaderHeight` + `repaginateOnResize` (flag). Açılışta da `paginateFixed` çalışır. Nav butonları click, ESC keydown dinlenir.【F:assets/js/wrpr-renderer.js†L262-L341】
- **Tek çocuk/single child sorunu**: `workingPage.childNodes.length === 1` koşulu, tek node’lu sayfa ikinci kez push edilmesine yol açabiliyor; büyük bloklarda sürekli tek-eleman sayfaları üretebilir.【F:assets/js/wrpr-renderer.js†L102-L108】
- **PAGE_HEIGHT seti**: Global değişken; açılışta mobil/desktop koşuluna göre, resize’da tekrar set; sabit 720px desktop hedefi nedeniyle gerçek A6 oranı CSS paddings ile büyüyebilir.【F:assets/js/wrpr-renderer.js†L8-L10】【F:assets/js/wrpr-renderer.js†L231-L337】

## CSS Tarafı – Yükseklik ve Layout Riskleri
- `.wr-page` için width max 700px, padding 25–48px, border-radius ve box-shadow mevcut; padding ve shadow faktörü içerik alanını daraltıp efektif yüksekliği azaltıyor, taşmaya katkı verebilir.【F:assets/css/wrpr-style.css†L218-L227】【F:assets/css/wrpr-style.css†L436-L449】
- `.wrpr-reader-content` `max-height: calc(100vh - 160px)` ve overflow hidden; JS ayrıca `maxHeight` set ediyor, çifte kısıtlama var.【F:assets/css/wrpr-style.css†L430-L434】【F:assets/js/wrpr-renderer.js†L252-L256】
- Modal ve nav: `.wrpr-page-info` absolute bottom:120px; nav butonlarının boyutları 55px; bu overlay’ler içerik alanı ölçümüne dahil değil ama görsel taşma yaratabilir.【F:assets/css/wrpr-style.css†L316-L333】【F:assets/css/wrpr-style.css†L488-L500】
- Global body/html reset yok; ancak `.wrpr-reader-wrapper` ve modal yüksek padding/background kullanıyor, pagination ölçümünde `padding` sayfa yüksekliğini fiilen azaltıyor.【F:assets/css/wrpr-style.css†L12-L63】【F:assets/css/wrpr-style.css†L218-L227】
- Media queries: 768px ve 600px altında `.wr-page` padding ve width değişiyor; mobilde `width:90vw` + azaltılmış padding, sayfa iç yüksekliğini değiştirerek toplam sayfa sayısında sapmaya yol açabilir.【F:assets/css/wrpr-style.css†L249-L292】【F:assets/css/wrpr-style.css†L502-L535】
- PDF.js kalıntıları: CSS’de PDF.js sınıfı yok; JS açıklaması PDF.js’in kaldırıldığını belirtiyor, ancak eski `wrpr-fs-btn`, `wrpr-modal.open` gibi legacy stiller devam ediyor ve layout’a gölge bırakabilir.【F:assets/js/wrpr-renderer.js†L1-L5】【F:assets/css/wrpr-style.css†L349-L394】

## PDF.js Dönemi Kalıntıları
- **JS**: Başlık yorumları PDF.js’in kaldırıldığını belirtiyor; ancak ölçüm yaklaşımı hala PDF sayfa yüksekliği sabitlemesine benzer (sabit `WRPR_PAGE_HEIGHT_DESKTOP`). Kullanılmayan `isMobile` flag (sadece set, çoğu yerde kullanılmıyor) legacy olabilir.【F:assets/js/wrpr-renderer.js†L1-L10】【F:assets/js/wrpr-renderer.js†L31-L259】
- **CSS**: `wrpr-fs-btn`, modal open classları ve yoğun shadow/padding, PDF viewer overlay estetiğini hatırlatıyor; spesifik PDF.js class’ı yok ama eski tema kalıntıları layout’u etkileyebilir.【F:assets/css/wrpr-style.css†L349-L394】

## Player Navigation & localStorage Restore
- **Navigation**: Prev/next butonları `renderPage` çağırarak `WR_PAGES` üzerinde gezinir; nav state `updateNavState` ile buton disable edilir.【F:assets/js/wrpr-renderer.js†L120-L199】【F:assets/js/wrpr-renderer.js†L262-L337】
- **localStorage**: Key formatı `wrpr_page_<reader>_A6`; açılışta eski non-A6 anahtarları temizlenir. Kayıt `saveProgress` (render sonrası), geri yükleme `restoreProgress` ile yapılır.【F:assets/js/wrpr-renderer.js†L200-L249】【F:assets/js/wrpr-renderer.js†L152-L167】
- **Restore sırası**: `openHTMLReader` → fetch + parse → `PAGE_HEIGHT` set → `paginateFixed` → `restoreProgress` ile start index → `renderPage`. `renderPage` içinde saveProgress tekrar çağrılır, böylece açılışta bile state güncellenir.【F:assets/js/wrpr-renderer.js†L200-L249】【F:assets/js/wrpr-renderer.js†L169-L198】
- **Race/timing riskleri**: Resize event’i MODAL açıkken hemen repaginate edip mevcut `CURRENT_PAGE`’i azaltabilir; localStorage restore edilmiş index, yeni sayfa sayısından büyükse min clamp uygulanıyor fakat içerik yüklenmeden önce `syncReaderHeight` veya isMobile flag tutarsızlığı farklı PAGE_HEIGHT üretebilir.【F:assets/js/wrpr-renderer.js†L316-L337】【F:assets/js/wrpr-renderer.js†L200-L241】

## Bilinen Semptomlara Göre Olası Sebepler
- **A6 sabit yükseklik sağlanamıyor / mobil-desktop sapmaları**: Desktop’ta sabit 720px, mobilde viewport oranı; CSS padding/shadow efektif alanı değiştiriyor, media queries padding’i farklılaştırıyor.【F:assets/js/wrpr-renderer.js†L8-L10】【F:assets/css/wrpr-style.css†L218-L227】【F:assets/css/wrpr-style.css†L502-L535】
- **Bazı sayfalarda scroll çıkıyor**: `.wrpr-reader-content` max-height kısıtı + JS maxHeight; sayfa iç padding’i ve box-shadow’u içerik yüksekliğini aşabilir, ölçüm container’ı shadow’ı dikkate almadan sadece scrollHeight bakıyor.【F:assets/css/wrpr-style.css†L430-L449】【F:assets/js/wrpr-renderer.js†L41-L118】
- **Büyük başlıklar satır ortasında kesiliyor/tek sayfa kaplıyor**: Tek node sığmazsa `workingPage.childNodes.length===1` kontrolü sayfayı hemen push ediyor; başlık blokları tek başına sayfa olabilir.【F:assets/js/wrpr-renderer.js†L102-L108】
- **Boş sayfalar**: Eğer ilk node PAGE_HEIGHT’i aşıyorsa push sonrası boş yeni sayfa oluşturulabilir; ayrıca short paragraf istisnası sadece <25 karakter için geçerli, diğer kısa bloklar boş sayfa bırakabilir.【F:assets/js/wrpr-renderer.js†L74-L108】
- **Dikey bant/kenar boşluk kayması**: `.wr-page` padding + border-radius + shadow farklı cihazlarda içerik alanını değiştiriyor; media queries padding’i azaltıyor, nav/info overlay’i absolute konumlandırılmış.【F:assets/css/wrpr-style.css†L218-L227】【F:assets/css/wrpr-style.css†L316-L333】【F:assets/css/wrpr-style.css†L502-L535】
- **Mobil/desktop sayfa sayısı değişiyor**: PAGE_HEIGHT hesaplaması farklı, CSS padding’leri de değişiyor; bu doğal sapma üretir.【F:assets/js/wrpr-renderer.js†L231-L337】【F:assets/css/wrpr-style.css†L281-L292】
- **240–300 sayfa hedefi sapması**: Dinamik PAGE_HEIGHT + padding değişimi + tek çocuk sayfa kuralları toplam sayfa sayısını öngörülemez kılar.【F:assets/js/wrpr-renderer.js†L94-L108】【F:assets/css/wrpr-style.css†L218-L227】
- **Resize sonrası yanlış repaginate/state**: `resize` doğrudan `paginateFixed` çağırıp `CURRENT_PAGE` clamp’liyor; debouncing yok, `isMobile` flag farklı eşikte set, `syncReaderHeight` çağrısı PAGE_HEIGHT’tan bağımsız, race ihtimali var.【F:assets/js/wrpr-renderer.js†L252-L341】

## Önerilen Fix Planı (3 Aşamalı)
### JS Tarafı
- **Sabit A6 yüksekliği**: PAGE_HEIGHT’i CSS’deki gerçek içerik yüksekliğine göre hesapla (A6 oranı + padding düşümü); mobil/desktop için aynı fiziksel px yüksekliği kullan, sadece ölçekleme yap.【F:assets/js/wrpr-renderer.js†L8-L10】【F:assets/css/wrpr-style.css†L218-L227】
- **Paragraf güvenli kırılım**: Tek blok > PAGE_HEIGHT ise kelime/harf bazlı bölme (range ölçümü) ile iki bloğa böl; mevcut “tek blok push” davranışını kaldır.【F:assets/js/wrpr-renderer.js†L94-L108】
- **Büyük başlık korunumu**: H1/H2 için `breakInside:avoid` yanında “eğer ilk eleman ve yüksekliği > PAGE_HEIGHT*0.4 ise sonraki paragrafı aynı sayfaya alma, yoksa sonraki sayfaya taşı” koşulu eklenebilir.【F:assets/js/wrpr-renderer.js†L74-L108】
- **Tek çocuk senaryosu**: `workingPage.childNodes.length === 1` push kuralını kaldırıp gerçek yükseklik karşılaştırması yap; bölünebilir içerik için metin parçalama, bölünemez için scale/overflow stratejisi belirle.【F:assets/js/wrpr-renderer.js†L102-L108】
- **Resize repaginate**: `resize` handler’ı debounce (örn. 200ms) ve sadece modal açıksa tetikle; `isMobile` eşiğini tek noktaya indir (örn. 768px). `syncReaderHeight` ile PAGE_HEIGHT ayarını aynı yerde güncelle; repaginate öncesi progress kaydet, sonrası restore et.【F:assets/js/wrpr-renderer.js†L252-L341】

### CSS Tarafı
- **.wr-page height/padding**: İçerik yüksekliğini sabitlemek için `box-sizing:border-box` + net A6 yüksekliğe denk gelecek `height:min(720px, calc(...))` veya JS ile inline height; padding’i 16–24px aralığında tutup shadow’u dış wrapper’a taşı.【F:assets/css/wrpr-style.css†L218-L227】【F:assets/css/wrpr-style.css†L436-L449】
- **A6 oranı mobil/desktop**: `max-width` yerine sabit aspect ratio (örn. `aspect-ratio: 105/148`) + responsive scale; böylece padding değişimlerinin etkisi azalır.【F:assets/css/wrpr-style.css†L218-L227】
- **Font/line-height normalize**: `.wr-page` font-size 16–18px, `line-height:1.5`; heading’lerde margin/padding sabit tutarak sayfa kırılımını öngörülebilir kıl.【F:assets/css/wrpr-style.css†L255-L279】【F:assets/css/wrpr-style.css†L436-L479】
- **Görsel unsurlar**: Shadow/border’ı dış kapsayıcıya taşıyıp gerçek içerik ölçümünden hariç bırak; background/border radius içerik alanını etkilemesin.【F:assets/css/wrpr-style.css†L436-L449】

### Word → Mammoth → HTML → Player Stabilizasyonu
- **Heading mapping**: H1 kapak, H2 bölüm başı, H3 alt başlık olarak CSS’te hiyerarşi; JS sayfalama öncesi başlık bloklarını “tek paragraf + sonraki paragraf” paketleriyle birlikte değerlendirmeli.【F:assets/css/wrpr-style.css†L255-L269】
- **Spacing normalization**: Mammoth çıktısında paragraflara standart `margin-bottom` (14px) uygula; bölüm öncesi/sonrası ekstra boşluk eklenmemesi için boş `<p>`’leri kaldırmaya devam et.【F:assets/js/wrpr-renderer.js†L69-L72】【F:assets/css/wrpr-style.css†L271-L279】
- **Bold normalization**: `strong/b` sadece kelime içi vurgu için; tam paragraf bold geliyorsa dönüştürme sırasında class ekleyip CSS ile normal ağırlığa çekilebilir.【F:assets/css/wrpr-style.css†L275-L279】【F:assets/css/wrpr-style.css†L475-L479】
- **“A6 clean mode”**: Mammoth sonrası minimal wrapper (sadece p/h tags), inline stil yok, liste marjinleri standart; pagination öncesi gereksiz div/span’lar temizlenip ölçüm doğruluğu artırılmalı.【F:assets/js/wrpr-renderer.js†L37-L118】
