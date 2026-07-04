(function(){
  if (window.__yaserEmployeeCheckReady) return;
  window.__yaserEmployeeCheckReady = true;
  function numberText(value) { return Number(value || 0).toLocaleString(); }
  function setCounter(name, delta) {
    var node = document.querySelector('[data-counter="' + name + '"]');
    if (!node) return;
    var next = Math.max(0, Number(node.getAttribute('data-value') || '0') + delta);
    node.setAttribute('data-value', String(next));
    node.textContent = numberText(next);
  }
  document.addEventListener('change', function(event) {
    var target = event.target;
    if (!target || !target.matches || !target.matches('form[action="/employee"] select')) return;
    if (target.form && target.form.requestSubmit) target.form.requestSubmit();
  });
  document.addEventListener('click', function(event) {
    var target = event.target;
    var button = target && target.closest ? target.closest('button[data-action]') : null;
    if (!button) return;
    var card = button.closest('[data-product-id]');
    if (!card || button.getAttribute('data-saving') === 'true') return;
    event.preventDefault();
    event.stopPropagation();
    var productId = card.getAttribute('data-product-id') || '';
    var status = button.getAttribute('data-action') === 'out' ? 'OUT_OF_STOCK' : 'IN_STOCK';
    var anchor = card.nextElementSibling || card.previousElementSibling;
    var anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;
    var scrollY = window.scrollY;
    Array.prototype.forEach.call(card.querySelectorAll('button[data-action]'), function(btn) {
      btn.disabled = true;
      btn.setAttribute('data-saving', 'true');
    });
    card.style.opacity = '0.45';
    fetch('/employee/check', {
      method: 'POST',
      body: new URLSearchParams({ productId: productId, status: status }),
      headers: { accept: 'application/json', 'x-requested-with': 'employee-live-check', 'content-type': 'application/x-www-form-urlencoded' }
    }).then(function(response) {
      if (!response.ok) throw new Error('Save failed');
      return response.json();
    }).then(function(result) {
      if (!result.ok) throw new Error('Save failed');
      card.remove();
      setCounter('visible', -1);
      setCounter('checked', 1);
      if (status === 'IN_STOCK') setCounter('in-report', 1);
      if (status === 'OUT_OF_STOCK') setCounter('out-report', 1);
      window.scrollTo({ top: scrollY });
    }).catch(function() {
      card.style.opacity = '';
      Array.prototype.forEach.call(card.querySelectorAll('button[data-action]'), function(btn) {
        btn.disabled = false;
        btn.removeAttribute('data-saving');
      });
    });
  }, true);
})();
