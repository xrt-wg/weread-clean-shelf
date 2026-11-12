  // Included only in the optional development build, never the release file.
  const developmentOrigin = __WR_REA_ORIGIN__;
  let pending = false;
  const requestedMode = new URL(location.href).searchParams.get('rea-dev');
  let developmentEnabled = requestedMode === '1';
  try {
    if (requestedMode === '0') sessionStorage.removeItem('wr-rea-development');
    if (developmentEnabled) sessionStorage.setItem('wr-rea-development','1');
    developmentEnabled ||= sessionStorage.getItem('wr-rea-development') === '1';
  } catch {}
  if (!developmentEnabled) return;

  function refreshDevelopmentSource() {
    if (pending || document.visibilityState !== 'visible' || !location.pathname.startsWith('/web/shelf')) return;
    pending = true;
    GM_xmlhttpRequest({
      method:'GET', url:`${developmentOrigin}/weread-shelf.user.js?development=1`,
      anonymous:true, timeout:2000, headers:{'Cache-Control':'no-cache'},
      onload(response) {
        pending=false;
        if(response.status!==200 || response.responseText.length>200000) return;
        const startMarker='/* WR_REA_SOURCE_START */',endMarker='/* WR_REA_SOURCE_END */';
        const start=response.responseText.indexOf(startMarker),end=response.responseText.indexOf(endMarker,start+startMarker.length);
        if(start<0 || end<0) return;
        try {
          const source=JSON.parse(response.responseText.slice(start+startMarker.length,end).trim());
          if(typeof source!=='string' || !source.startsWith('// WeRead REA shelf runtime') || source===activeSource) return;
          apply(source); activeSource=source;
        } catch {}
      },
      onerror(){pending=false;}, ontimeout(){pending=false;},
    });
  }
  setInterval(refreshDevelopmentSource,2500);
  document.addEventListener('visibilitychange',refreshDevelopmentSource);
  refreshDevelopmentSource();
