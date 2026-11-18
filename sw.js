/* 装机比价 Service Worker（GitHub Pages 版）
   让主屏幕图标在没网 / 电脑合盖时也能打开，看到上次联网的页面快照。
   商品数据在私有仓库，通过 API 现取，不缓存在这里，避免换设备看到旧数据。
   路径全部用相对根目录 scope，兼容 /仓库名/ 这种子目录站点。 */
const CACHE = "zhuangji-v3";
const HOME = new URL("./", self.registration.scope).href;
/* OCR 静态资源：随页面一起装进缓存，保证离线也能认字。
   大文件单独缓存，失败不影响页面安装。 */
const OCR_ASSETS = [
  "ocr/tesseract.min.js",
  "ocr/worker.min.js",
  "ocr/tesseract-core-simd-lstm.wasm.js",
  "ocr/tesseract-core-lstm.wasm.js",
  "ocr/lang/chi_sim.traineddata.gz"
].map(p => new URL(p, self.registration.scope).href);

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add(HOME).then(() => Promise.allSettled(OCR_ASSETS.map(u => c.add(u)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // 写操作绝不缓存
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // GitHub API 等外部请求放行
  if (url.pathname.indexOf("/api/") !== -1) return;

  // 页面文档：网络优先，断网退回缓存
  if (req.mode === "navigate" || url.href === HOME || /index\.html$/.test(url.pathname)) {
    e.respondWith(
      fetch(req, { cache: "reload" }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(HOME, copy)).catch(()=>{}); }
        return res;
      }).catch(() => caches.match(HOME))
    );
    return;
  }

  // 图标 / manifest：缓存优先
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{}); }
      return res;
    }))
  );
});
