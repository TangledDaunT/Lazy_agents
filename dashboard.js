const BACKEND_HTTP = 'http://localhost:8766';
const SKIN_OPTIONS = ['suit', 'casual', 'beach', 'dress', 'corporate'];

let AGENTS = {};

async function load() {
  const res = await fetch('agents_config.json');
  AGENTS = await res.json();
  render();
}

function render() {
  const container = document.getElementById('agent-forms');
  container.innerHTML = '';

  for (const id of Object.keys(AGENTS)) {
    const cfg = AGENTS[id];
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '20px';

    wrap.innerHTML = `
      <div class="mascot-preview" aria-label="${cfg.displayName} mascot preview"></div>
      <div class="row">
        <label>Name</label>
        <input data-id="${id}" data-field="displayName" value="${cfg.displayName}">
      </div>
      <div class="row">
        <label>Wake word</label>
        <input data-id="${id}" data-field="wakeWord" value="${cfg.wakeWord || ''}">
      </div>
      <div class="row">
        <label>Piper voice</label>
        <input data-id="${id}" data-field="piperVoice" value="${cfg.piperVoice}">
      </div>
      <div class="row">
        <label>Skin</label>
        <select data-id="${id}" data-field="defaultSkin">
          ${SKIN_OPTIONS.map((s) => `<option value="${s}" ${s === cfg.defaultSkin ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="row">
        <label>Accent</label>
        <input type="color" data-id="${id}" data-field="accentColor" value="${cfg.accentColor || '#f5d061'}">
      </div>
    `;
    wrap.querySelector('.mascot-preview').appendChild(window.MascotSystem.createMascot({
      agentId: id,
      accentColor: cfg.accentColor,
      outfit: cfg.defaultSkin,
      state: 'idle',
    }));
    container.appendChild(wrap);
  }
}

document.getElementById('save-btn').addEventListener('click', async () => {
  document.querySelectorAll('[data-field]').forEach((el) => {
    AGENTS[el.dataset.id][el.dataset.field] = el.value;
  });
  await fetch(`${BACKEND_HTTP}/agents_config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(AGENTS),
  });
  alert('Saved. Agent outfits and accents are now live in the council.');
});

load();
