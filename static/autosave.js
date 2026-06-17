(function () {
  const intervalMs = 10000;
  const pageKey = `autosave:${window.location.pathname}${window.location.search}`;
  let lastSavedText = '';

  function fieldKey(el, index) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `[name="${el.name}"]:${index}`;
    return `${el.tagName.toLowerCase()}:${index}`;
  }

  function readFields() {
    const fields = {};
    const elements = [...document.querySelectorAll('input, select, textarea')];
    elements.forEach((el, index) => {
      if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
      const key = fieldKey(el, index);
      if (el.type === 'checkbox' || el.type === 'radio') {
        fields[key] = { checked: el.checked, value: el.value, type: el.type };
      } else {
        fields[key] = { value: el.value, type: el.type || el.tagName.toLowerCase() };
      }
    });
    return fields;
  }

  function findField(key) {
    if (key.startsWith('#')) return document.querySelector(key);
    const nameMatch = key.match(/^\[name="(.+)"\]:(\d+)$/);
    if (nameMatch) {
      const matches = [...document.querySelectorAll(`[name="${nameMatch[1]}"]`)];
      return matches[Number(nameMatch[2])] || null;
    }
    const fallback = key.match(/^([a-z]+):(\d+)$/);
    if (fallback) {
      const matches = [...document.querySelectorAll(fallback[1])];
      return matches[Number(fallback[2])] || null;
    }
    return null;
  }

  function restoreFields(fields) {
    Object.entries(fields || {}).forEach(([key, data]) => {
      const el = findField(key);
      if (!el) return;
      if (data.type === 'checkbox' || data.type === 'radio') {
        el.checked = Boolean(data.checked);
      } else if (typeof data.value === 'string') {
        el.value = data.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function updateBadge(text) {
    let badge = document.getElementById('autosave-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'autosave-badge';
      badge.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:14px',
        'z-index:80',
        'font:11px DM Mono, monospace',
        'color:#9ca3af',
        'background:#13161b',
        'border:1px solid #262b35',
        'border-radius:6px',
        'padding:7px 10px',
        'box-shadow:0 8px 24px rgba(0,0,0,.28)'
      ].join(';');
      document.body.appendChild(badge);
    }
    badge.textContent = text;
  }

  async function autosave() {
    const fields = readFields();
    const snapshot = {
      page: pageKey,
      url: window.location.href,
      fields,
      saved_at: new Date().toISOString()
    };
    const text = JSON.stringify(snapshot);
    if (text === lastSavedText) return;
    lastSavedText = text;
    localStorage.setItem(pageKey, text);

    try {
      const res = await fetch('/autosave-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });
      if (res.ok) updateBadge(`Autosaved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`);
    } catch (err) {
      updateBadge('Autosaved locally');
    }
  }

  function restore() {
    const raw = localStorage.getItem(pageKey);
    if (!raw) return;
    try {
      const snapshot = JSON.parse(raw);
      restoreFields(snapshot.fields);
      updateBadge('Draft restored');
    } catch (err) {
      localStorage.removeItem(pageKey);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(restore, 350);
    setInterval(autosave, intervalMs);
    document.addEventListener('input', () => {
      window.clearTimeout(window.__autosaveTimer);
      window.__autosaveTimer = window.setTimeout(autosave, 1200);
    });
    updateBadge('Autosave on');
  });

  window.addEventListener('beforeunload', autosave);
})();
