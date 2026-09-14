(() => {
  const OUTFITS = ['suit', 'casual', 'beach', 'dress', 'corporate'];
  const STATES = ['idle', 'listening', 'working', 'awaiting-approval'];

  function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function svgMarkup(agentId, accentColor, outfit) {
    const safeAccent = escapeAttribute(accentColor || '#f5d061');
    const safeOutfit = OUTFITS.includes(outfit) ? outfit : 'corporate';
    return `
      <svg class="mascot-art" viewBox="0 0 120 120" role="img" aria-label="${escapeAttribute(agentId)} mascot" style="--mascot-accent:${safeAccent}">
        <defs>
          <filter id="glow-${escapeAttribute(agentId)}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle class="mascot-glow" cx="60" cy="60" r="44" fill="none" stroke="var(--mascot-accent)" stroke-width="2" opacity=".35" filter="url(#glow-${escapeAttribute(agentId)})"/>
        <g class="mascot-base">
          <path class="mascot-body" d="M27 104c1-24 14-37 33-37s32 13 33 37" fill="#2a292e" stroke="var(--mascot-accent)" stroke-width="2"/>
          <circle class="mascot-face" cx="60" cy="43" r="22" fill="#d99c76" stroke="#f5d4b8" stroke-width="2"/>
          <path d="M39 42c2-18 39-23 43 1-9-6-27-8-43-1Z" fill="#202126"/>
          <circle cx="52" cy="47" r="2" fill="#131317"/><circle cx="68" cy="47" r="2" fill="#131317"/>
          <path d="M54 57q6 5 12 0" fill="none" stroke="#7b463d" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g class="mascot-outfit outfit-suit"><path d="M27 104l15-31 18 14 18-14 15 31" fill="#303d61" stroke="var(--mascot-accent)" stroke-width="2"/><path d="M60 87l-8-14h16Z" fill="#f4f1e7"/><path d="M60 79v25" stroke="var(--mascot-accent)" stroke-width="2"/></g>
        <g class="mascot-outfit outfit-casual"><path d="M27 104l7-28q26-12 52 0l7 28" fill="#35695f" stroke="var(--mascot-accent)" stroke-width="2"/><path d="M45 77q15 9 30 0" fill="none" stroke="#8dd9c6" stroke-width="2"/></g>
        <g class="mascot-outfit outfit-beach"><path d="M27 104l9-29q24-9 48 0l9 29" fill="#b46e35" stroke="var(--mascot-accent)" stroke-width="2"/><path d="M38 72q22-17 44 0" fill="none" stroke="#f7d27a" stroke-width="5"/></g>
        <g class="mascot-outfit outfit-dress"><path d="M42 72q18-10 36 0l13 32H29Z" fill="#9c4e77" stroke="var(--mascot-accent)" stroke-width="2"/><path d="M43 74l17 13 17-13" fill="none" stroke="#f6b4d0" stroke-width="2"/></g>
        <g class="mascot-outfit outfit-corporate"><path d="M27 104l10-31q23-11 46 0l10 31" fill="#4a465d" stroke="var(--mascot-accent)" stroke-width="2"/><path d="M44 74h32" stroke="#b9b0d9" stroke-width="2"/><circle cx="60" cy="84" r="4" fill="var(--mascot-accent)"/></g>
        <g class="mascot-hands"><path d="M34 82q-9 5-4 15" fill="none" stroke="#d99c76" stroke-width="5" stroke-linecap="round"/><path d="M86 82q9 5 4 15" fill="none" stroke="#d99c76" stroke-width="5" stroke-linecap="round"/></g>
        <g class="mascot-phone"><rect x="51" y="82" width="18" height="29" rx="3" fill="#111217" stroke="var(--mascot-accent)" stroke-width="2"/><circle cx="60" cy="105" r="2" fill="var(--mascot-accent)"/></g>
        <g class="mascot-prayer"><path d="M51 89l9-10 9 10M54 87l-5 9M66 87l5 9" fill="none" stroke="#d99c76" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M51 98q9 7 18 0" fill="none" stroke="#8ecdf2" stroke-width="2"/></g>
        <g class="mascot-typing"><path d="M35 90l15 7M85 90L70 97" stroke="#d99c76" stroke-width="5" stroke-linecap="round"/><path d="M49 101h22" stroke="var(--mascot-accent)" stroke-width="3" stroke-linecap="round"/></g>
      </svg>`;
  }

  function setState(element, state) {
    const nextState = STATES.includes(state) ? state : 'idle';
    element.dataset.state = nextState;
    STATES.forEach((name) => element.classList.toggle(name, name === nextState));
  }

  function setOutfit(element, outfit) {
    const nextOutfit = OUTFITS.includes(outfit) ? outfit : 'corporate';
    element.dataset.outfit = nextOutfit;
    element.querySelectorAll('.mascot-outfit').forEach((layer) => layer.classList.toggle('active', layer.classList.contains(`outfit-${nextOutfit}`)));
  }

  function setAccent(element, accentColor) {
    element.style.setProperty('--mascot-accent', accentColor || '#f5d061');
    const svg = element.querySelector('.mascot-art');
    if (svg) svg.style.setProperty('--mascot-accent', accentColor || '#f5d061');
  }

  function createMascot({ agentId, accentColor, outfit = 'corporate', state = 'idle' }) {
    const element = document.createElement('div');
    element.className = 'mascot idle';
    element.id = `mascot-${agentId}`;
    element.dataset.agentId = agentId;
    element.innerHTML = svgMarkup(agentId, accentColor, outfit);
    setOutfit(element, outfit);
    setState(element, state);
    setAccent(element, accentColor);
    return element;
  }

  window.MascotSystem = { OUTFITS, STATES, createMascot, setState, setOutfit, setAccent, svgMarkup };
})();
