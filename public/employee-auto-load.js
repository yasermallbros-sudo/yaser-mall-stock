(function(){
  if (window.__yaserEmployeeAutoLoadReady) return;
  window.__yaserEmployeeAutoLoadReady = true;
  var loading = false;
  var pageSize = 60;
  function numberText(value){ return Number(value || 0).toLocaleString(); }
  function currentParts(){
    return {
      grid: document.querySelector('[data-products-grid]'),
      sentinel: document.querySelector('[data-load-more-sentinel]'),
      button: document.querySelector('[data-auto-load-more]')
    };
  }
  function nearBottom(){
    var page = document.documentElement;
    return page.scrollHeight - window.scrollY - window.innerHeight < 1400;
  }
  function nextUrl(nextLimit){
    var url = new URL(window.location.href);
    url.searchParams.set('limit', String(nextLimit));
    return url.pathname + '?' + url.searchParams.toString();
  }
  function loadMore(){
    var parts = currentParts();
    if (loading || !parts.grid || !parts.sentinel) return;
    var loaded = Number(parts.sentinel.getAttribute('data-loaded') || document.querySelectorAll('[data-product-id]').length || 0);
    var total = Number(parts.sentinel.getAttribute('data-total') || 0);
    if (!total || loaded >= total) return;
    var nextLimit = Math.min(total, loaded + pageSize);
    var scrollY = window.scrollY;
    loading = true;
    if (parts.button) parts.button.textContent = 'Loading more items...';
    fetch(nextUrl(nextLimit), { headers: { accept: 'text/html', 'x-employee-auto-load': '1' } })
      .then(function(response){ if (!response.ok) throw new Error('Load failed'); return response.text(); })
      .then(function(html){
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var nextGrid = doc.querySelector('[data-products-grid]');
        var nextSentinel = doc.querySelector('[data-load-more-sentinel]');
        if (!nextGrid) throw new Error('Missing grid');
        parts.grid.innerHTML = nextGrid.innerHTML;
        if (nextSentinel && parts.sentinel) {
          parts.sentinel.setAttribute('data-loaded', nextSentinel.getAttribute('data-loaded') || String(nextLimit));
          parts.sentinel.setAttribute('data-total', nextSentinel.getAttribute('data-total') || String(total));
          parts.sentinel.innerHTML = nextSentinel.innerHTML;
        } else if (parts.sentinel) {
          parts.sentinel.remove();
        }
        window.history.replaceState(null, '', nextUrl(nextLimit));
        window.scrollTo({ top: scrollY });
      })
      .catch(function(){ if (parts.button) parts.button.textContent = 'Load more (' + numberText(loaded) + ' / ' + numberText(total) + ')'; })
      .finally(function(){ loading = false; });
  }
  function check(){ if (nearBottom()) loadMore(); }
  document.addEventListener('click', function(event){
    var button = event.target && event.target.closest ? event.target.closest('[data-auto-load-more]') : null;
    if (!button) return;
    event.preventDefault();
    loadMore();
  }, true);
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  window.setInterval(check, 600);
})();
