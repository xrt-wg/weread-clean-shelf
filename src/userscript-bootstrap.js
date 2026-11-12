// ==UserScript==
// @name         微信读书 · 清爽书架
// @namespace    https://github.com/xrt-wg/weread-clean-shelf
// @version      __WR_REA_VERSION__
// @description  可排序分组、纯封面书架、主题切换；独立运行，自动更新。
// @author       xrt-wg
// @license      MIT
// @homepageURL  https://github.com/xrt-wg/weread-clean-shelf
// @supportURL   https://github.com/xrt-wg/weread-clean-shelf/issues
// @updateURL    https://raw.githubusercontent.com/xrt-wg/weread-clean-shelf/release/src/weread-shelf.user.js
// @downloadURL  https://raw.githubusercontent.com/xrt-wg/weread-clean-shelf/release/src/weread-shelf.user.js
// @match        https://weread.qq.com/*
// @run-at       document-start
// @sandbox      DOM
__WR_REA_GRANTS__
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const fallbackSource =
    /* WR_REA_SOURCE_START */ __WR_REA_SOURCE__ /* WR_REA_SOURCE_END */;
  let activeSource = fallbackSource;

  function apply(source) {
    const script = document.createElement('script');
    script.textContent = source;
    (document.head || document.documentElement).append(script);
    script.remove();
  }

  // Install the shelf paint guard before the native page gets its first paint.
  // At document-start, head/body are not guaranteed to exist yet.
  if(document.documentElement) apply(fallbackSource);
  else {
    const initial=new MutationObserver(()=>{if(document.documentElement){initial.disconnect();apply(activeSource);}});
    initial.observe(document,{childList:true});
  }

/* WR_REA_DEVELOPMENT */
})();
