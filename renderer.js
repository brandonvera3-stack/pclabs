// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function show(id) {
  // If the user is on a tool screen (Junk Cleaner / Game Optimizer) block every
  // show() call that would navigate them away from it. The only legitimate exit
  // from a tool screen is the nav click handler, which sets _activeToolScreen=null
  // before calling show(), so that path is always allowed through.
  if (typeof _activeToolScreen !== 'undefined' && _activeToolScreen && id !== _activeToolScreen) return;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showSec(id) {
  document.querySelectorAll('.rsec').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nb').forEach(b=>
    b.classList.toggle('active', b.dataset.sec===id.replace('sec-',''))
  );
}
function stepDone(id)   { const e=document.getElementById(id); if(e){ e.className='sstep done'; e.textContent='✓ '+e.textContent.replace(/[○▶✓] /,''); } }
function stepActive(id) { const e=document.getElementById(id); if(e){ e.className='sstep active'; e.textContent='▶ '+e.textContent.replace(/[○▶✓] /,''); } }
function scoreColor(n)    { return n>=80?'g':n>=55?'a':'r'; }
function scoreBarClass(n) { return n>=80?'bg':n>=55?'ba':'br'; }

// ── Nav ───────────────────────────────────────────────────────────────────────
document.querySelectorAll('.nb').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const sec = btn.dataset.sec;
    if (sec === 'junk') {
      showToolScreen('s-junk');
      renderJunkScreen();
    } else if (sec === 'optimizer') {
      showToolScreen('s-optimizer');
      renderOptimizerScreen();
    } else {
      _activeToolScreen = null;
      show('s-results');
      showSec('sec-'+sec);
    }
    document.querySelectorAll('.nb').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
  });
});

// ── Titlebar buttons ──────────────────────────────────────────────────────────
document.getElementById('tb-min').addEventListener('click',  ()=>window.pclabs?.minimize?.());
document.getElementById('tb-max').addEventListener('click',  ()=>window.pclabs?.maximize?.());
document.getElementById('tb-close').addEventListener('click', ()=>window.pclabs?.close?.());
document.getElementById('btn-feedback')?.addEventListener('click',  ()=>window.pclabs?.openFeedback?.());
document.getElementById('btn-results-pro')?.addEventListener('click', ()=>window.pclabs?.openExternal?.('https://thepclabs.com/pricing.html'));

// ── Pro license system ────────────────────────────────────────────────────────
const _PRO_STORAGE_KEY = 'pclabs_pro_key';
let _isPro = false;

function applyProState(isPro) {
  _isPro = isPro;

  // Results banner
  const def    = document.getElementById('pro-banner-default');
  const entry  = document.getElementById('pro-banner-keyentry');
  const active = document.getElementById('pro-banner-active');
  if (def && entry && active) {
    def.style.display    = isPro ? 'none'  : 'flex';
    entry.style.display  = 'none';
    active.style.display = isPro ? 'flex'  : 'none';
  }

  // Sidebar button
  const sbBtn = document.getElementById('btn-get-pro');
  if (sbBtn) {
    if (isPro) {
      sbBtn.textContent = 'Pro Active';
      sbBtn.classList.add('pro-sb-active');
    } else {
      sbBtn.textContent = 'Get Pro — $2.99';
      sbBtn.classList.remove('pro-sb-active');
    }
  }

  // Re-render tool screens if currently visible
  if (document.getElementById('s-junk')?.classList.contains('active')) renderJunkScreen();
  if (document.getElementById('s-optimizer')?.classList.contains('active')) renderOptimizerScreen();
}

async function initProState() {
  const stored = localStorage.getItem(_PRO_STORAGE_KEY);
  if (stored) {
    const valid = await window.pclabs?.validateKey?.(stored);
    if (valid) { applyProState(true); return; }
    localStorage.removeItem(_PRO_STORAGE_KEY); // stale/revoked
  }
  applyProState(false);
}

// Sidebar Pro button — open pricing page only when not Pro
document.getElementById('btn-get-pro')?.addEventListener('click', () => {
  if (_isPro) return;
  const url = 'https://thepclabs.com/pricing.html';
  if (window.pclabs?.openExternal) window.pclabs.openExternal(url);
  else window.open(url, '_blank');
});

// Show key entry
document.getElementById('btn-show-key-entry')?.addEventListener('click', () => {
  document.getElementById('pro-banner-default').style.display = 'none';
  document.getElementById('pro-banner-keyentry').style.display = 'flex';
  document.getElementById('pro-key-input').focus();
});

// Cancel key entry
document.getElementById('btn-cancel-key-entry')?.addEventListener('click', () => {
  document.getElementById('pro-banner-keyentry').style.display = 'none';
  document.getElementById('pro-banner-default').style.display = 'flex';
  document.getElementById('pro-key-error').textContent = '';
  document.getElementById('pro-key-input').value = '';
});

// Activate key
document.getElementById('btn-activate-key')?.addEventListener('click', async () => {
  const input  = document.getElementById('pro-key-input');
  const errEl  = document.getElementById('pro-key-error');
  const btn    = document.getElementById('btn-activate-key');
  const key    = input.value.trim().toUpperCase();

  if (!key) { errEl.textContent = 'Enter a key.'; return; }
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Checking…';

  const valid = await window.pclabs?.validateKey?.(key);
  if (valid) {
    localStorage.setItem(_PRO_STORAGE_KEY, key);
    applyProState(true);
  } else {
    errEl.textContent = 'Invalid key — check for typos.';
    btn.disabled = false;
    btn.textContent = 'Activate';
  }
});

// Auto-uppercase input as user types
document.getElementById('pro-key-input')?.addEventListener('input', function() {
  const pos = this.selectionStart;
  this.value = this.value.toUpperCase();
  this.setSelectionRange(pos, pos);
});

// Submit on Enter
document.getElementById('pro-key-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-activate-key')?.click();
});

// Init on load
let _lastOptResult = null;
const _savedOpt = localStorage.getItem('pclabs_opt_result');
if (_savedOpt) { try { _lastOptResult = JSON.parse(_savedOpt); } catch(_) {} }
initProState();

// ── Score display ─────────────────────────────────────────────────────────────
function setScore(id, barId, subId, val, label) {
  const el=document.getElementById(id), bar=document.getElementById(barId);
  el.textContent=val; el.className='sc-val '+scoreColor(val);
  if (bar) { bar.style.width=val+'%'; bar.className='sc-bar-fill '+scoreBarClass(val); }
  if (subId) document.getElementById(subId).textContent=label||'';
}

// ── Issues list ───────────────────────────────────────────────────────────────
function buildIssues(listId, issues) {
  const ul=document.getElementById(listId); if(!ul) return; ul.innerHTML='';
  if (!issues.length) {
    ul.innerHTML=`<div class="all-clear"><span class="all-clear-icon">✓</span> No significant findings detected.</div>`;
    return;
  }
  issues.forEach(iss=>{
    const li=document.createElement('li'); li.className='ii';
    const dot = iss.sev==='high'||iss.sev==='critical' ? 'h' : iss.sev==='medium' ? 'm' : iss.sev==='ok' ? 'ok' : 'l';
    li.innerHTML=`<div class="idot ${dot}"></div>
      <div class="ibody"><strong>${esc(iss.title)}</strong><span>${esc(iss.desc)}</span></div>`;
    ul.appendChild(li);
  });
}

// ── Actions list ──────────────────────────────────────────────────────────────
function buildActions(listId, actions) {
  const ul=document.getElementById(listId); if(!ul) return; ul.innerHTML='';
  if (!actions.length) {
    ul.innerHTML=`<div class="all-clear"><span class="all-clear-icon">✓</span> No priority actions needed.</div>`;
    return;
  }
  actions.slice(0,4).forEach(a=>{
    const li=document.createElement('li'); li.className='ai';
    li.innerHTML=`<span class="anum">${esc(a.n)}</span>
      <div class="atext"><strong>${esc(a.title)}</strong><span>${esc(a.desc)}</span></div>`;
    ul.appendChild(li);
  });
}

// ── Info card (compact hardware fact) ─────────────────────────────────────────
function renderInfoCard(f) {
  // Drive type HDD gets a subtle tint to indicate it's worth noting
  const hddClass = f.id && f.id.startsWith('disk-type') && f.sev==='low' ? ' hdd' : '';
  const noteHtml = (f.sev!=='ok' && f.action && !f.action.startsWith('No action'))
    ? `<div class="info-card-note">${esc(f.action)}</div>` : '';
  return `<div class="info-card${hddClass}">
  <div class="info-card-title">${esc(f.title)}</div>
  <div class="info-card-value">${esc(f.technical)}</div>
  ${noteHtml}
</div>`;
}

// ── Warning finding card (full detail) ───────────────────────────────────────
function renderWarningCard(f) {
  const sevLabel = f.sev==='critical'?'CRITICAL':f.sev==='high'?'HIGH':f.sev==='medium'?'MEDIUM':f.sev==='low'?'LOW':'INFO';
  const noAction = !f.action || f.action.startsWith('No action');
  const confHtml = f.confidence && f.confidence < 85
    ? `<span class="fc-conf">${f.confidence}% confidence</span>` : '';
  return `<div class="fc ${f.sev}">
  <div class="fc-top">
    <span class="sb ${f.sev}">${sevLabel}</span>
    <span class="fc-name">${esc(f.title)}</span>
    ${confHtml}
  </div>
  <div class="fc-tech">${esc(f.technical)}</div>
  <div class="fc-plain">${esc(f.plain)}</div>
  <div class="fc-impact"><span class="fc-impact-label">Impact</span>${esc(f.impact)}</div>
  ${noAction ? '' : `<div class="fc-act">
    <span class="fc-act-text"><b>What to do:</b> ${esc(f.action)}</span>
    <span class="fc-auto ${f.canAutomate?'safe':'manual'}">${f.canAutomate?'Auto-safe':'Manual'}</span>
  </div>`}
</div>`;
}

/**
 * Render a set of categories into a container.
 * Each category section shows:
 *   - an info grid of isInfo cards (hardware facts, healthy readings)
 *   - full warning cards for actual findings
 *   - "All clear" if no warnings in that category
 */
function renderCategories(containerEl, catIds, categories) {
  if (!containerEl || !categories) return;
  containerEl.innerHTML='';
  const toShow = catIds ? categories.filter(c=>catIds.includes(c.id)) : categories;

  toShow.forEach(cat=>{
    const infoFindings    = cat.findings.filter(f=>f.isInfo);
    const warningFindings = cat.findings.filter(f=>!f.isInfo && f.sev!=='ok' && f.sev!=='info');
    const issueCount      = warningFindings.filter(f=>['high','critical','medium'].includes(f.sev)).length;

    const badgeHtml = issueCount > 0
      ? `<span class="cat-badge-issues">${issueCount} finding${issueCount!==1?'s':''}</span>`
      : `<span class="cat-badge-clear">Ready</span>`;

    const div=document.createElement('div');
    div.className='cat-section';

    let inner=`<div class="cat-header">
  <span class="cat-icon">${esc(cat.icon)}</span>
  <span class="cat-title-text">${esc(cat.title)}</span>
  ${badgeHtml}
</div>`;

    // Info grid (always shown, compact)
    if (infoFindings.length > 0) {
      inner+=`<div class="info-group">`;
      infoFindings.forEach(f=>{ inner+=renderInfoCard(f); });
      inner+=`</div>`;
    }

    // Warning cards (only shown if there are findings to show)
    if (warningFindings.length > 0) {
      warningFindings.forEach(f=>{ inner+=renderWarningCard(f); });
    } else if (infoFindings.length > 0) {
      // Have info cards but no warnings → show a subtle all-clear
      inner+=`<div class="all-clear">
  <span class="all-clear-icon">✓</span>
  No issues found in this category.
</div>`;
    } else {
      inner+=`<div class="all-clear">
  <span class="all-clear-icon">✓</span>
  No issues detected.
</div>`;
    }

    div.innerHTML=inner;
    containerEl.appendChild(div);
  });
}

// ── Recommendations builder ───────────────────────────────────────────────────
function buildRecs(categories) {
  const ul=document.getElementById('r-recs'); if(!ul) return; ul.innerHTML='';
  const all=(categories||[]).flatMap(c=>
    c.findings
      .filter(f=>!f.isInfo && ['critical','high','medium','low'].includes(f.sev) && f.action && !f.action.startsWith('No action'))
      .map(f=>({...f, catTitle:c.title, catIcon:c.icon}))
  );
  const ord={critical:0,high:1,medium:2,low:3};
  all.sort((a,b)=>(ord[a.sev]??9)-(ord[b.sev]??9));
  const seen=new Set();
  const unique=all.filter(f=>{ if(seen.has(f.id)) return false; seen.add(f.id); return true; });

  function recItemHtml(f, i) {
    const sevClass = ['critical','high'].includes(f.sev)?'h':f.sev==='medium'?'m':'';
    const sevBadge = sevClass ? `<span class="ri-sev ${sevClass}">${f.sev==='critical'?'HIGH':f.sev.toUpperCase()}</span>` : '';
    const whyRow  = f.impact ? `<div class="ri-detail-row"><span class="ri-detail-label">Why this matters</span><span class="ri-detail-text">${esc(f.impact)}</span></div>` : '';
    const fixRow  = f.action ? `<div class="ri-detail-row"><span class="ri-detail-label">Suggested fix</span><span class="ri-detail-text">${esc(f.action)}</span></div>` : '';
    const detail  = (whyRow || fixRow) ? `<div class="ri-detail"><div class="ri-detail-inner">${whyRow}${fixRow}</div></div>` : '';
    return `<div class="ri" tabindex="0" onclick="this.classList.toggle('open')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.classList.toggle('open')}"><div class="ri-top">
<span class="ri-num">${String(i+1).padStart(2,'0')}</span>
<div class="ri-body">
  <strong>${sevBadge}${esc(f.title)}</strong>
  <div class="ri-cat">${esc(f.catIcon)} ${esc(f.catTitle)}</div>
</div>
<span class="ri-chevron">›</span>
</div>${detail}</div>`;
  }

  const urgent = unique.filter(f=>['critical','high'].includes(f.sev));
  const later  = unique.filter(f=>!['critical','high'].includes(f.sev));

  function renderGroup(items, label, desc, startIdx) {
    if (!items.length) return;
    const group = document.createElement('div'); group.className='ri-group';
    group.innerHTML=`<div class="ri-group-label">${label}</div><div class="ri-group-desc">${desc}</div><div class="ri-group-items">${items.map((f,j)=>recItemHtml(f,startIdx+j)).join('')}</div>`;
    ul.appendChild(group);
  }

  renderGroup(urgent, 'Needs attention', 'These items are most likely to affect stability or performance.', 1);
  renderGroup(later,  'Worth reviewing',  'These are lower-priority improvements you can address later.',   urgent.length+1);

  if (!unique.length) {
    ul.innerHTML=`<div style="padding:1rem 0">
  <div class="all-clear"><span class="all-clear-icon">✓</span> No specific recommendations — your system looks healthy.</div>
</div>`;
  }
}

// ── Module section helpers ────────────────────────────────────────────────────

/** Key-value cell for BIOS/Mobo grid. */
function kvCell(label, val, note) {
  const isNA = val === null || val === undefined || String(val).trim() === '';
  const valHtml = isNA
    ? '<span class="mod-kv-value na">Unavailable</span>'
    : `<div class="mod-kv-value">${esc(String(val))}</div>`;
  const noteHtml = note ? `<div class="mod-kv-note">${esc(note)}</div>` : '';
  return `<div class="mod-kv"><div class="mod-kv-label">${esc(label)}</div>${valHtml}${noteHtml}</div>`;
}

/** Cautious BIOS age note — never says "outdated". */
function biosAgeNote(age) {
  if (age === null || age === undefined) return null;
  if (age >= 7) return `Older BIOS release detected (${age} years old) — you may want to review the system or motherboard manufacturer's support page`;
  if (age >= 4) return `Released ${age} years ago`;
  return null;
}

/** Impact pill HTML. */
function impactPill(impact) {
  const label = impact==='high'?'HIGH IMPACT':impact==='medium'?'MEDIUM':impact==='low'?'LOW':'UNKNOWN';
  return `<span class="impact-pill ${impact||'unknown'}">${label}</span>`;
}

/** Overall startup load badge. */
function startupLoadLabel(count, heavyCount) {
  if (count === 0) return { cls:'ok', text:'None detected' };
  if (heavyCount >= 4) return { cls:'warn', text:`${heavyCount} potentially heavy apps` };
  if (heavyCount >= 2) return { cls:'warn', text:`${heavyCount} apps worth reviewing` };
  if (count > 15)      return { cls:'warn', text:`${count} startup items` };
  return { cls:'ok', text:'Manageable' };
}

// ── renderModuleSections ──────────────────────────────────────────────────────
// Renders BIOS & Motherboard, Startup Apps, Background Processes into #diag-modules.
// Uses structured module results from the scan return object.
// Never invents content — calm unavailable states when data is missing.

function renderModuleSections(data) {
  const container = document.getElementById('diag-modules');
  if (!container) return;
  container.innerHTML = '';

  // 1. BIOS & Motherboard
  (function() {
    const bm   = data.biosMotherboard || null;
    const bios = bm?.bios        || null;
    const mobo = bm?.motherboard || null;
    const sys  = bm?.system      || null;
    const age  = bios?.age ?? null;
    const ageNote = biosAgeNote(age);
    const badge = ageNote ? { cls:'warn', text:'Older release' }
      : (bios ? { cls:'ok', text:'Detected' } : { cls:'na', text:'Unavailable' });

    const bodyHtml = (!bios && !mobo) ? '<div class="mod-unavail">Data unavailable for this scan</div>' : `
<div class="mod-kv-grid">
  ${kvCell('BIOS Vendor',  bios?.manufacturer||null, null)}
  ${kvCell('BIOS Version', bios?.version||null, null)}
  ${kvCell('BIOS Date',    bios?.year ? `${bios.year}`+(bios.releaseDate?` (${String(bios.releaseDate).slice(0,10)})`:'') : null, ageNote)}
  ${kvCell('BIOS Status',  bios ? (ageNote ? 'Older release — verify updates' : 'No issues detected') : null, null)}
</div>
<div class="mod-kv-grid">
  ${kvCell('Motherboard',   mobo ? (`${mobo.manufacturer||''} ${mobo.model||''}`).trim()||null : null, null)}
  ${kvCell('Board Version', mobo?.version||null, null)}
  ${kvCell('System',        sys  ? (`${sys.manufacturer||''} ${sys.model||''}`).trim()||null  : null, null)}
  ${kvCell('Form Factor',   sys?.family||null, null)}
</div>`;

    const div = document.createElement('div');
    div.className = 'mod-section';
    div.innerHTML = `<div class="mod-header">
  <span class="mod-title-text">BIOS &amp; Motherboard</span>
  <span class="mod-badge ${badge.cls}">${esc(badge.text)}</span>
</div>${bodyHtml}`;
    container.appendChild(div);
  })();

  // 2. Startup Apps
  (function() {
    const sa         = data.startupApps || null;
    const count      = sa?.count      ?? null;
    const items      = Array.isArray(sa?.items)      ? sa.items      : [];
    const heavyItems = Array.isArray(sa?.heavyItems) ? sa.heavyItems : [];
    const heavyCount = sa?.heavyCount ?? heavyItems.length;
    const load = count !== null ? startupLoadLabel(count, heavyCount) : { cls:'na', text:'Unavailable' };

    // Dedup key: name + publisher + command prefix (first 40 chars).
    // Name-only dedup can collapse legitimately distinct entries from different publishers.
    const itemKey = i => `${(i.name||'').toLowerCase()}|${(i.publisher||'').toLowerCase()}|${(i.command||'').slice(0,40).toLowerCase()}`;
    const heavyKeys    = new Set(heavyItems.map(itemKey));
    const displayItems = [...heavyItems, ...items.filter(i => !heavyKeys.has(itemKey(i)))].slice(0, 5);

    const summaryHtml = count !== null ? `
<div class="mod-kv-grid">
  ${kvCell('Startup Items', count, null)}
  ${kvCell('Boot Impact',
    heavyCount > 0 ? `${heavyCount} potentially heavy app${heavyCount!==1?'s':''}` : 'Appears light',
    heavyCount === 0 && count > 0 ? 'No commonly heavy apps detected' : null)}
</div>` : '<div class="mod-unavail">Data unavailable for this scan</div>';

    const clearNote = (count !== null && heavyCount === 0 && count > 0)
      ? `<div class="all-clear"><span class="all-clear-icon">✓</span>Startup load appears light — no commonly resource-heavy apps detected.</div>` : '';

    const listHtml = displayItems.length > 0 ? `
<div class="mod-sub-label">Top startup items</div>
<div class="startup-list">${displayItems.map(item => {
  const sub = item.publisher && item.publisher !== item.name
    ? `<div class="startup-item-pub">${esc(item.publisher)}</div>`
    : (item.reason ? `<div class="startup-item-pub">${esc(item.reason)}</div>` : '');
  return `<div class="startup-item"><div class="startup-item-body"><div class="startup-item-name">${esc(item.name)}${impactPill(item.impact)}</div>${sub}</div></div>`;
}).join('')}</div>` : '';

    const div = document.createElement('div');
    div.className = 'mod-section';
    div.innerHTML = `<div class="mod-header">
  <span class="mod-title-text">Startup Apps</span>
  <span class="mod-badge ${load.cls}">${esc(load.text)}</span>
</div>${summaryHtml}${clearNote}${listHtml}`;
    container.appendChild(div);
  })();

  // 3. Background Processes
  (function() {
    const pd      = data.backgroundProcesses || null;
    const total   = pd?.totalCount ?? null;
    const topMem  = Array.isArray(pd?.topMemory)  ? pd.topMemory.slice(0,5)  : [];
    const topCpu  = Array.isArray(pd?.topCpu)     ? pd.topCpu.slice(0,4)     : [];
    const dups    = Array.isArray(pd?.duplicates) ? pd.duplicates.slice(0,3) : [];
    const flagged = Array.isArray(pd?.flagged)    ? pd.flagged.slice(0,3)    : [];

    const div = document.createElement('div');
    div.className = 'mod-section';

    if (!pd || total === null) {
      div.innerHTML = `<div class="mod-header">
  <span class="mod-icon">⚙️</span>
  <span class="mod-title-text">Background Processes</span>
  <span class="mod-badge na">Unavailable</span>
</div><div class="mod-unavail">Data unavailable for this scan</div>`;
      container.appendChild(div);
      return;
    }

    const badge = flagged.length > 0
      ? { cls:'warn', text:`${flagged.length} drain${flagged.length!==1?'s':''} noted` }
      : { cls:'ok',   text:'No drains noted' };

    // Summarise flagged names: show first 2 by name, then "+ N more" to avoid long lists
    const flaggedSummary = flagged.length === 0 ? 'None detected'
      : flagged.length <= 2 ? flagged.map(f => f.name).join(', ')
      : `${flagged.slice(0,2).map(f => f.name).join(', ')} +${flagged.length - 2} more`;

    const prow = (p, stat) =>
      `<div class="proc-row"><span class="proc-name">${esc(p.name)}</span><span class="proc-stat">${esc(stat)}</span></div>`;

    div.innerHTML = `<div class="mod-header">
  <span class="mod-icon">⚙️</span>
  <span class="mod-title-text">Background Processes</span>
  <span class="mod-badge ${badge.cls}">${esc(badge.text)}</span>
</div>
<div class="mod-kv-grid">
  ${kvCell('Total Processes', total, null)}
  ${kvCell('Performance Drains', flaggedSummary, null)}
</div>
${topMem.length > 0 ? `<div class="mod-sub-label">Top memory consumers</div><div class="proc-table">${topMem.map(p=>prow(p,`${p.memMB} MB RAM`)).join('')}</div>` : ''}
${topCpu.length > 0 ? `<div class="mod-sub-label">Top CPU consumers</div><div class="proc-table">${topCpu.map(p=>prow(p,`${p.cpuSec}s CPU time`)).join('')}</div>` : ''}
${dups.length > 0 ? `<div class="mod-sub-label">Multiple instances</div><div class="proc-table">${dups.map(d=>{const cnt=d.count!=null?d.count:'?';const mb=d.totalMemMB!=null?d.totalMemMB+' MB total':'';return`<div class="proc-row"><span class="proc-name">${esc(d.name)}</span><span class="proc-stat">${cnt} instances${mb?' · '+mb:''}</span></div>`;}).join('')}</div>` : ''}
${flagged.length > 0 ? `<div class="mod-sub-label">Flagged performance drains</div><div class="proc-table">${flagged.map(f=>`<div class="proc-row"><span class="proc-name">${esc(f.name)}</span><span class="proc-stat">${f.memMB!=null?f.memMB+' MB':''}</span><span class="proc-flag">${esc(f.reason)}</span></div>`).join('')}</div>` : ''}`;
    container.appendChild(div);
  })();

  // 4. Crash & Reliability
  (function() {
    const sr  = data.stabilityReport || null;
    const ri  = sr?.reliabilityIndex ?? null;

    const bsodCount = sr?.bsod?.count   ?? null;
    const kpCount   = sr?.kp?.count     ?? null;
    const acCount   = sr?.appCrash?.count7d ?? null;
    const wheaCount = sr?.whea?.count   ?? null;

    // Badge: if any real problem count > 0, show warn; else ok; else na
    const anyIssue = (bsodCount > 0 || kpCount > 0);
    const badge = sr === null
      ? { cls:'na', text:'Unavailable' }
      : anyIssue ? { cls:'warn', text:'Events detected' }
      : { cls:'ok', text:'Stable' };

    const riBarPct   = ri !== null ? Math.round((ri / 10) * 100) : 0;
    const riBarClass = ri === null ? '' : ri >= 7 ? 'g' : ri >= 4 ? 'a' : 'r';
    const riHtml = ri !== null ? `
<div class="ri-bar-wrap">
  <div class="ri-bar-track"><div class="ri-bar-fill ${riBarClass}" style="width:${riBarPct}%"></div></div>
  <div class="ri-bar-label">Windows Reliability Index: ${ri.toFixed(1)} / 10</div>
</div>` : '';

    // Recent BSODs table
    const bsodRecent = sr?.bsod?.recent?.filter(e => e.date).slice(0,3) || [];
    const bsodRowsHtml = bsodRecent.length > 0 ? `
<div class="mod-sub-label">Recent blue screens</div>
<div class="proc-table">${bsodRecent.map(e => {
  const label = e.codeName ? `${e.code} — ${e.codeName}` : (e.code || 'Unknown code');
  return `<div class="proc-row"><span class="proc-name">${esc(label)}</span><span class="proc-stat">${esc(e.date||'')}</span></div>`;
}).join('')}</div>` : '';

    // Top app crashers
    const crashers = sr?.appCrash?.topCrashers?.slice(0,3) || [];
    const crashersHtml = crashers.length > 0 && acCount >= 8 ? `
<div class="mod-sub-label">Most-crashed apps (last 7 days)</div>
<div class="proc-table">${crashers.map(c =>
  `<div class="proc-row"><span class="proc-name">${esc(c.name)}</span><span class="proc-stat">${c.count}× crash${c.count!==1?'es':''}</span></div>`
).join('')}</div>` : '';

    // Service failures
    const svcNames = sr?.svcFail?.services?.slice(0,3) || [];
    const svcHtml = svcNames.length > 0 ? `
<div class="mod-sub-label">Service failures (last 7 days)</div>
<div class="proc-table">${svcNames.map(n =>
  `<div class="proc-row"><span class="proc-name">${esc(n)}</span><span class="proc-stat">Unexpected stop</span></div>`
).join('')}</div>` : '';

    const div = document.createElement('div');
    div.className = 'mod-section';

    if (!sr) {
      div.innerHTML = `<div class="mod-header">
  <span class="mod-title-text">Crash &amp; Reliability</span>
  <span class="mod-badge na">Unavailable</span>
</div><div class="mod-unavail">Data unavailable for this scan</div>`;
      container.appendChild(div);
      return;
    }

    div.innerHTML = `<div class="mod-header">
  <span class="mod-title-text">Crash &amp; Reliability</span>
  <span class="mod-badge ${badge.cls}">${esc(badge.text)}</span>
</div>
${riHtml}
<div class="mod-kv-grid">
  ${kvCell('Blue Screens (30d)',       bsodCount !== null ? String(bsodCount) : null, null)}
  ${kvCell('Unexpected Shutdowns (30d)', kpCount !== null ? String(kpCount)   : null, null)}
  ${kvCell('App Crashes (7d)',         acCount  !== null ? String(acCount)    : null, null)}
  ${kvCell('Hardware Errors (WHEA)',   wheaCount !== null ? (wheaCount === 0 ? 'None' : String(wheaCount)) : null, wheaCount > 0 ? 'Low-level hardware faults — monitor for changes' : null)}
</div>
${bsodRowsHtml}
${crashersHtml}
${svcHtml}`;
    container.appendChild(div);
  })();
}

// ── Sidebar health dots ────────────────────────────────────────────────────────
function updateSidebarDots(data) {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const SEV = { critical:4, high:3, medium:2, low:1, ok:0, info:-1 };

  function worstColor(ids) {
    let worst = -2;
    categories.filter(c => ids.includes(c.id)).forEach(c => {
      (c.findings || []).filter(f => !f.isInfo).forEach(f => {
        const v = SEV[f.sev] ?? -1;
        if (v > worst) worst = v;
      });
    });
    if (worst >= 3) return 'r';
    if (worst >= 2) return 'a';
    if (worst >= 1) return 'b';
    return 'g';
  }

  const sc = typeof data.score === 'number' ? data.score : 0;
  const oc = scoreColor(sc);
  const map = {
    overview:        oc,
    diagnostics:     worstColor(['system','storage','stability','windows']),
    gaming:          worstColor(['performance','network']),
    recommendations: oc,
  };

  document.querySelectorAll('.nb').forEach(btn => {
    const color = map[btn.dataset.sec];
    const dot   = btn.querySelector('.nb-dot');
    if (dot && color) { dot.className = 'nb-dot ' + color; btn.classList.add('has-dot'); }
  });
}

// ── Scan flow ─────────────────────────────────────────────────────────────────
document.getElementById('btn-scan').addEventListener('click', runScan);
document.getElementById('btn-rescan')?.addEventListener('click', () => {
  document.querySelectorAll('.nb').forEach(btn => {
    btn.classList.remove('has-dot');
    const dot = btn.querySelector('.nb-dot');
    if (dot) dot.className = 'nb-dot';
  });
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.disabled = true;
  show('s-home');
});

async function runScan() {
  show('s-scanning');
  const status = document.getElementById('scan-status');

  // Steps advance on a real-time interval while the scan runs — no fake delays.
  const steps = [
    { id: 'st-hw',        label: 'Reading CPU, GPU and RAM…' },
    { id: 'st-storage',   label: 'Checking storage health…' },
    { id: 'st-stability', label: 'Checking crash and error history…' },
    { id: 'st-perf',      label: 'Analysing performance and startup…' },
    { id: 'st-windows',   label: 'Checking Windows health and security…' },
    { id: 'st-network',   label: 'Testing network connection…' },
  ];

  // Soft progress: percentage reflects animated step position, not collector precision.
  const pct = i => `${Math.round((i / (steps.length + 1)) * 100)}%`;
  const setStatus = i => { status.textContent = `${steps[i].label} ${pct(i + 1)}`; };

  let idx = 0;
  stepActive(steps[0].id);
  setStatus(0);

  const ticker = setInterval(() => {
    stepDone(steps[idx].id);
    idx++;
    if (idx < steps.length) {
      stepActive(steps[idx].id);
      setStatus(idx);
    }
  }, 2800);

  let data;
  try {
    data = await window.pclabs.runScan();
  } catch (err) {
    // Scan failed — show a clear error state, never substitute fake data
    clearInterval(ticker);
    steps.forEach(s => stepDone(s.id));
    stepDone('st-score');
    show('s-home');
    const btn = document.getElementById('btn-scan');
    if (btn) {
      const orig = btn.innerHTML;
      btn.textContent = 'Scan failed — check app is running on Windows';
      btn.style.background = 'var(--red)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 4000);
    }
    return;
  }

  clearInterval(ticker);
  // Mark any steps the ticker hadn't reached yet as done
  for (let i = idx; i < steps.length; i++) stepDone(steps[i].id);
  stepActive('st-score');
  status.textContent = 'Building your report… 95%';
  await new Promise(r => setTimeout(r, 400));
  stepDone('st-score');
  status.textContent = '100%';
  await new Promise(r => setTimeout(r, 150));

  populateResults(data);
}

function populateResults(data) {
  // Guard: data must be a real scan result object from window.pclabs.runScan().
  // If it is missing or malformed, never fabricate content — show error state.
  if (!data || typeof data !== 'object') {
    show('s-home');
    const btn = document.getElementById('btn-scan');
    if (btn) {
      const orig = btn.innerHTML;
      btn.textContent = 'Scan returned no data — please try again';
      btn.style.background = 'var(--red)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 4000);
    }
    return;
  }

  // All values come exclusively from the scan result object.
  // No defaults, samples, or fallback content are injected anywhere below.
  const sc          = typeof data.score === 'number' ? data.score : 0;
  const categories  = Array.isArray(data.categories) ? data.categories : [];
  const issues      = Array.isArray(data.issues)     ? data.issues     : [];
  const actions     = Array.isArray(data.actions)    ? data.actions    : [];
  const issueCount  = typeof data.issueCount === 'number' ? data.issueCount : 0;
  const readiness   = data.readiness || '\u2014';

  // ── Overview scores ────────────────────────────────────────────────────────
  setScore('r-score','r-score-bar','r-score-sub', sc,
    sc>=80?'Your PC is in good shape':sc>=55?'A few things to address':'Needs attention');

  const readyColor={ Excellent:'g', Good:'g', Fair:'a', 'Needs Work':'r' };
  const r=document.getElementById('r-ready');
  r.textContent=readiness; r.className='sc-val '+(readyColor[readiness]||'a');
  const rb=document.getElementById('r-ready-bar');
  if(rb){ rb.style.width=sc+'%'; rb.className='sc-bar-fill '+(readyColor[readiness]==='g'?'bg':readyColor[readiness]==='r'?'br':'ba'); }

  const icEl=document.getElementById('r-issue-count');
  icEl.textContent=issueCount;
  icEl.className='sc-val '+(issueCount===0?'g':issueCount<=3?'a':'r');
  const ib=document.getElementById('r-issue-bar');
  if(ib){ ib.style.width=Math.min(issueCount*15,100)+'%'; ib.className='sc-bar-fill '+(issueCount===0?'bg':issueCount<=3?'ba':'br'); }
  document.getElementById('r-issue-sub').textContent=`Across ${categories.length} categories`;

  // ── Hero meta: scan timestamp + category count (display only, no logic) ────
  const _now=new Date();
  document.getElementById('ov-scan-time').textContent=_now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  document.getElementById('ov-cat-count').textContent=categories.length;

  // ── System snapshot strip — hardware identity, display only ────────────────
  (function() {
    const strip = document.getElementById('sys-strip');
    if (!strip) return;
    const ramTotal = data.ram  ? data.ram.split(' \u00b7 ')[0].replace(' total','').trim() : null;
    const diskTotal= data.disk && !data.disk.startsWith('Unable')
                   ? data.disk.split(' \u00b7 ')[0].replace(' total','').trim() : null;
    const items = [
      { lbl:'CPU',     val: data.cpu    || null },
      { lbl:'GPU',     val: data.gpu    || null },
      { lbl:'RAM',     val: ramTotal            },
      { lbl:'Storage', val: diskTotal           },
      { lbl:'OS',      val: data.os     || null },
    ];
    strip.innerHTML = items
      .filter(it => it.val)
      .map(it => `<div class="sys-strip-item"><span class="sys-strip-lbl">${esc(it.lbl)}</span><span class="sys-strip-val" title="${esc(it.val)}">${esc(it.val)}</span></div>`)
      .join('');
    if (!strip.innerHTML) strip.style.display = 'none';
  })();

  // ── Top issues and actions — directly from scan result ─────────────────────
  buildIssues('r-issues-ov', issues);
  buildActions('r-actions-ov', actions);

  // ── Diagnostics tab — system, storage, stability, windows from scan ────────
  renderCategories(
    document.getElementById('diag-cats'),
    ['system','storage','stability','windows'],
    categories
  );

  // ── Gaming tab — performance and network from scan ─────────────────────────
  document.getElementById('gr-score').textContent=readiness;
  document.getElementById('gr-score').className='gr-score '+(readyColor[readiness]||'a');
  document.getElementById('gr-bar').className='gr-bar '+(readyColor[readiness]||'a');
  const _gamingFindings = categories
    .filter(c=>['performance','network'].includes(c.id))
    .flatMap(c=>c.findings||[])
    .filter(f=>!f.isInfo && ['critical','high','medium'].includes(f.sev));
  (function(){
    const note = document.getElementById('gr-issue-note'); if(!note) return;
    const hasCrit = _gamingFindings.some(f=>['critical','high'].includes(f.sev));
    const n = _gamingFindings.length;
    if (n === 0) { note.textContent='All gaming checks passed'; note.className='gr-issue-note clear'; }
    else { note.textContent=n+' issue'+(n!==1?'s':'')+' found'; note.className='gr-issue-note '+(hasCrit?'crit':'warn'); }
  })();
  document.getElementById('gr-sub').textContent= _gamingFindings.length === 0
    ? 'No gaming-impact issues detected'
    : readiness==='Excellent' ? 'Your hardware is well-suited for demanding modern games'
    : readiness==='Good'      ? 'Your hardware handles most modern games at good settings'
    : readiness==='Fair'      ? 'Playable, but some titles may need lower settings'
    : readiness==='Needs Work'? 'Address the issues below to improve gaming performance'
    :                           'Run a scan to see gaming readiness';
  (function() {
    const hw = document.getElementById('gr-hw');
    if (!hw) return;
    const ramTotal = data.ram ? data.ram.split(' \u00b7 ')[0].replace(' total','').trim() : null;
    const items = [
      { lbl:'GPU', val: data.gpu || null },
      { lbl:'CPU', val: data.cpu || null },
      { lbl:'RAM', val: ramTotal         },
    ];
    const filled = items.filter(it => it.val);
    if (!filled.length) { hw.style.display='none'; return; }
    hw.innerHTML = `<div class="gr-hw-strip">${
      filled.map(it=>`<div class="gr-hw-item"><span class="gr-hw-lbl">${esc(it.lbl)}</span><span class="gr-hw-val" title="${esc(it.val)}">${esc(it.val)}</span></div>`).join('')
    }</div>`;
  })();
  if (_gamingFindings.length === 0) {
    const gc = document.getElementById('gaming-cats');
    if (gc) gc.innerHTML=`<div class="all-clear"><span class="all-clear-icon">✓</span> No performance or network issues detected.</div>`;
  } else {
    renderCategories(
      document.getElementById('gaming-cats'),
      ['performance','network'],
      categories
    );
  }

  // ── Recommendations — derived entirely from scan findings ──────────────────
  buildRecs(categories);

  // ── Module sections — BIOS, Startup Apps, Background Processes ────────────
  renderModuleSections(data);

  // Reset scan steps for next run
  ['st-hw','st-storage','st-stability','st-perf','st-windows','st-network','st-score'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.className='sstep'; el.textContent='\u25cb '+el.textContent.replace(/[\u2713\u25b6\u25cb] /,''); }
  });

  updateSidebarDots(data);
  _lastScanData = data;
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.disabled = false;
  // Don't navigate away if the user is currently on a tool screen (e.g. Junk
  // Cleaner or Game Optimizer). The main scan may complete in the background
  // while the user is on a tool screen — store the result but stay put.
  if (_activeToolScreen) return;
  show('s-results');
  showSec('sec-overview');
}
// ── Tool screen helper ────────────────────────────────────────────────────────
let _activeToolScreen = null;

function showToolScreen(id) {
  _activeToolScreen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// ── Pro gate helper ───────────────────────────────────────────────────────────
function renderProLock(featureName) {
  return `<div class="pro-lock-overlay">
    <div class="pro-lock-title">Pro Feature</div>
    <div class="pro-lock-msg">${featureName} is a Pro feature. Upgrade to PCLabs Pro for $2.99 one-time to unlock this and all future Pro features.</div>
    <button class="pro-lock-btn" onclick="window.pclabs?.openExternal?.('https://thepclabs.com/pricing.html')">Upgrade to Pro — $2.99</button>
  </div>`;
}

// ── Junk Cleaner ──────────────────────────────────────────────────────────────
let _junkData = null;

const JUNK_HINTS = {
  usertemp:     "Apps leave behind thousands of leftover files here every time they install or update. Safe to delete — games won't even notice they're gone, but your drive will.",
  wintemp:      "Windows itself leaves scratch files here while it's working. Clearing it out gives Windows less clutter to deal with, which can help apps and games launch a little faster.",
  wupdate:      "After Windows updates, it keeps the old files around just in case — but once the update is done, you'll never need them again. Deleting them won't affect anything.",
  crashdumps:   "These are leftover files from the last time an app or game crashed on you. They're only useful for developers debugging a problem — once the crash is gone, so is their purpose.",
  thumbcache:   "Windows quietly builds a tiny preview picture for every file and folder you've ever opened. Over time this adds up — clearing it is completely safe and Windows just rebuilds it as you browse.",
  recyclebin:   "Files you've already deleted but that are still quietly sitting in your Recycle Bin taking up real storage space. Emptying it is the easiest free space you'll ever get back.",
  chromecache:  "Chrome saves local copies of websites so they load faster on repeat visits. When this gets too big it can actually slow Chrome down — clearing it is safe and Chrome rebuilds it automatically.",
  edgecache:    "Same idea as Chrome — Edge keeps local copies of websites. A bloated cache can make your browser feel sluggish, and clearing it often speeds things right back up.",
  firefoxcache: "Firefox stores temporary website data to speed up browsing. Clearing it won't log you out or delete anything important — it just wipes the temporary stuff.",
};

function renderJunkScreen() {
  const container = document.getElementById('junk-content');
  if (!container) return;

  if (!_isPro) {
    container.innerHTML = renderProLock('Junk Cleaner');
    return;
  }

  container.innerHTML = `
    <div class="tool-action-row">
      <button class="tool-primary-btn" id="junk-scan-btn">Scan for Junk</button>
      <span class="tool-status-text" id="junk-status"></span>
    </div>
    <div id="junk-results"></div>
  `;

  document.getElementById('junk-scan-btn').addEventListener('click', runJunkScan);
}

async function runJunkScan() {
  const statusEl = document.getElementById('junk-status');
  const resultsEl = document.getElementById('junk-results');
  const scanBtn = document.getElementById('junk-scan-btn');
  if (!statusEl || !resultsEl || !scanBtn) return;

  scanBtn.disabled = true;
  statusEl.textContent = 'Scanning…';
  resultsEl.innerHTML = '';
  _junkData = null;

  try {
    _junkData = await window.pclabs.runJunkScan();
  } catch(e) {
    statusEl.textContent = 'Scan failed.';
    scanBtn.disabled = false;
    return;
  }

  scanBtn.disabled = false;
  statusEl.textContent = '';
  renderJunkResults(_junkData);
}

function renderJunkResults(data) {
  const resultsEl = document.getElementById('junk-results');
  if (!resultsEl || !data) return;

  const cats = data.categories || [];
  const totalMB = data.totalMB || 0;

  const rowsHtml = cats.map(cat => {
    const sizeLabel = cat.sizeMB >= 0.1 ? (cat.sizeMB >= 1024 ? (cat.sizeMB/1024).toFixed(1)+' GB' : cat.sizeMB.toFixed(1)+' MB') : '< 0.1 MB';
    const zeroClass = cat.sizeMB < 0.1 ? ' zero' : '';
    return `<label class="junk-row">
      <input type="checkbox" class="junk-cat-cb" data-id="${esc(cat.id)}" ${cat.sizeMB >= 0.1 ? 'checked' : ''}>
      <div class="junk-row-body">
        <div class="junk-row-name">${esc(cat.label)}</div>
        <div class="junk-row-path">${esc(cat.path)}</div>
        ${JUNK_HINTS[cat.id] ? `<div class="junk-row-hint">${esc(JUNK_HINTS[cat.id])}</div>` : ''}
      </div>
      <div class="junk-row-size${zeroClass}">${sizeLabel}</div>
    </label>`;
  }).join('');

  const totalLabel = totalMB >= 1024 ? (totalMB/1024).toFixed(2)+' GB' : totalMB.toFixed(1)+' MB';

  resultsEl.innerHTML = `
    <div class="junk-list">${rowsHtml}</div>
    <div class="junk-total-row">
      <span>Total selected</span>
      <span class="junk-total-val" id="junk-selected-total">${totalLabel}</span>
    </div>
    <div class="tool-action-row">
      <button class="tool-primary-btn" id="junk-clean-btn">Clean Selected</button>
      <button class="tool-secondary-btn" id="junk-rescan-btn">↺ Rescan</button>
      <span class="tool-status-text" id="junk-clean-status"></span>
    </div>
    <div id="junk-clean-result"></div>
  `;

  // Update total on checkbox change
  document.querySelectorAll('.junk-cat-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const cats = _junkData?.categories || [];
      const checkedIds = new Set([...document.querySelectorAll('.junk-cat-cb:checked')].map(c => c.dataset.id));
      const selMB = cats.filter(c => checkedIds.has(c.id)).reduce((s, c) => s + c.sizeMB, 0);
      const lbl = selMB >= 1024 ? (selMB/1024).toFixed(2)+' GB' : selMB.toFixed(1)+' MB';
      const el = document.getElementById('junk-selected-total');
      if (el) el.textContent = lbl;
    });
  });

  document.getElementById('junk-clean-btn').addEventListener('click', runJunkClean);
  document.getElementById('junk-rescan-btn').addEventListener('click', runJunkScan);
}

async function runJunkClean() {
  const cleanBtn   = document.getElementById('junk-clean-btn');
  const statusEl   = document.getElementById('junk-clean-status');
  const resultEl   = document.getElementById('junk-clean-result');
  if (!cleanBtn || !statusEl || !resultEl) return;

  const selected = [...document.querySelectorAll('.junk-cat-cb:checked')].map(c => c.dataset.id);
  if (!selected.length) { statusEl.textContent = 'Select at least one category.'; return; }

  cleanBtn.disabled = true;
  statusEl.textContent = 'Cleaning…';
  resultEl.innerHTML = '';

  let result;
  try {
    result = await window.pclabs.runJunkClean(selected);
  } catch(e) {
    statusEl.textContent = 'Clean failed.';
    cleanBtn.disabled = false;
    return;
  }

  cleanBtn.disabled = false;
  statusEl.textContent = '';

  const freed = result.totalFreedMB || 0;
  const freedLabel = freed >= 1024 ? (freed/1024).toFixed(2)+' GB' : freed.toFixed(1)+' MB';
  resultEl.innerHTML = `<div class="junk-result-box">
    <div class="junk-result-num">${esc(freedLabel)}</div>
    <div class="junk-result-label">freed up — scan again to refresh</div>
  </div>`;

}

// ── Game Optimizer ────────────────────────────────────────────────────────────
let _gameData = null;

const OPTIMIZATIONS = [
  { id:'gamebar',    name:'Disable Xbox Game Bar',
    desc:'Turns off the Game Bar overlay and auto game mode — a common source of stutters and input lag.',
    benefit:'Fixes those random stutters mid-game and stops the Xbox overlay from hijacking your screen when you hit the Windows key while playing.',
    safe:true },
  { id:'hags',       name:'Enable Hardware-Accelerated GPU Scheduling',
    desc:'Reduces CPU overhead for GPU workloads. Requires a recent GPU and Windows 10 2004+.',
    benefit:'Your GPU gets to manage its own work instead of waiting on your CPU — this means smoother frame rates, especially in fast-paced shooters and open world games.',
    safe:true },
  { id:'powerplan',  name:'Set Power Plan to High Performance',
    desc:'Prevents Windows from throttling CPU speed to save power.',
    benefit:'Stops Windows from throttling your CPU to save power. On laptops this alone can push frame rates noticeably higher the moment you apply it.',
    safe:true },
  { id:'fullscreen', name:'Disable Fullscreen Optimizations',
    desc:'Stops Windows from overriding exclusive fullscreen mode.',
    benefit:'Lets your game take full control of your screen. The result is less input lag — meaning what you press shows up on screen faster. Makes a real difference in competitive games.',
    safe:true },
  { id:'visualfx',   name:'Reduce Visual Effects',
    desc:'Switches Windows animations to best performance mode.',
    benefit:'Turns off Windows menu animations and background effects. Frees up GPU headroom that goes straight to your game instead.',
    safe:true },
  { id:'nagle',      name:'Disable Nagle Algorithm (Lower Network Latency)',
    desc:'Disables packet buffering on network adapters, reducing ping in online games.',
    benefit:'Reduces the delay between you clicking and your action registering on the server. Lower ping, less rubber-banding, and more responsive online gameplay.',
    safe:true },
];

const GAME_PROFILES = {
  'fortnite': {
    label: 'Fortnite',
    tips: [
      { setting: 'Rendering Mode', value: 'Performance', why: 'Cuts visual complexity in half — frame rates jump dramatically, especially on mid-range hardware.' },
      { setting: 'View Distance', value: 'Near or Medium', why: 'Distant geometry you\'ll never shoot at costs real GPU time. Near keeps frames high with zero competitive downside.' },
      { setting: 'Shadows', value: 'Off', why: 'Shadow rendering is one of the heaviest GPU tasks. Turning it off can add 20–40 FPS and removes visual clutter around players.' },
      { setting: 'Anti-Aliasing', value: 'Off (Performance Mode)', why: 'In Performance mode AA is already minimal. Disabling it fully frees GPU budget for higher frames.' },
      { setting: 'Textures', value: 'Medium', why: 'Low textures can actually hurt visibility on some skins. Medium hits the sweet spot between performance and readability.' },
      { setting: 'Effects', value: 'Low', why: 'Explosion and environmental effects eat GPU frames. Low keeps the competitive picture clean.' },
      { setting: 'Post Processing', value: 'Low', why: 'Bloom, lens flare, and motion blur all run in post. Low removes them and the frame cost with them.' },
      { setting: 'Motion Blur', value: 'Off', why: 'Blur smears fast-moving players — terrible for tracking targets. Off is always correct in competitive play.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled + Boost (if available)', why: 'Directly reduces system latency — the gap between clicking and seeing the result on screen. One of the highest-value settings available.' },
    ]
  },
  'arc raiders': {
    label: 'ARC Raiders',
    tips: [
      { setting: 'Upscaling', value: 'DLSS Quality or FSR Quality', why: 'ARC Raiders is GPU-heavy. Upscaling recovers 30–50% frame rate with minimal visual loss at Quality mode.' },
      { setting: 'Shadow Quality', value: 'Medium', why: 'The shadow system in ARC Raiders is detailed but expensive. Medium halves the cost with barely visible results at range.' },
      { setting: 'Ambient Occlusion', value: 'Low or Off', why: 'AO adds contact shadows but is a significant GPU drain. Competitive players turn it off entirely.' },
      { setting: 'Volumetric Effects', value: 'Low', why: 'Fog and atmospheric effects are frame-rate killers in this engine. Low keeps the environment readable without the overhead.' },
      { setting: 'Motion Blur', value: 'Off', why: 'Tracking raiders moving through the environment requires a clean image. Motion blur actively hurts your ability to react.' },
      { setting: 'Texture Quality', value: 'High (if VRAM allows)', why: 'Textures have low performance cost but high visual and readability impact. Keep at High unless VRAM is below 6 GB.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled', why: 'Reduces click-to-display latency — critical in a game where reaction time determines survival.' },
    ]
  },
  'apex legends': {
    label: 'Apex Legends',
    tips: [
      { setting: 'Texture Streaming Budget', value: 'Medium (4–6 GB VRAM)', why: 'Apex streams textures dynamically. Setting this correctly prevents VRAM overflow which causes visible hitches mid-fight.' },
      { setting: 'Texture Filtering', value: 'Anisotropic 4x', why: '16x has near-zero visual benefit in a fast game but does cost GPU time. 4x is the professional standard.' },
      { setting: 'Ambient Occlusion Quality', value: 'Disabled', why: 'AO is imperceptible during fast movement and fights. Disabling it recovers meaningful frame rate in dense scenes.' },
      { setting: 'Sun Shadow Coverage', value: 'Low', why: 'Apex\'s outdoor maps have heavy shadow budgets. Low cuts the cost while keeping enough shadow for spatial awareness.' },
      { setting: 'Spot Shadow Detail', value: 'Disabled', why: 'Dynamic spot shadows around indoor light sources are invisible during gunfights but cost consistent GPU time.' },
      { setting: 'VSync', value: 'Off', why: 'VSync introduces input lag equal to one full frame. Always Off in competitive play — use NVIDIA Reflex or Radeon Anti-Lag instead.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled + Boost', why: 'Apex is a game decided by split-second reactions. Reflex cuts input lag so your shots register with less delay.' },
      { setting: 'FOV', value: '100–110', why: 'Wider FOV gives you better peripheral awareness in close-range fights without a meaningful performance cost.' },
      { setting: 'Color Mode', value: 'Tritanopia', why: 'A well-known Apex setting — this color mode improves highlight visibility on enemies for many players, not just those with color blindness.' },
    ]
  },
  'marvel rivals': {
    label: 'Marvel Rivals',
    tips: [
      { setting: 'Graphics Quality', value: 'Medium or Custom', why: 'The preset system scales aggressively. Custom settings let you keep what matters (textures, resolution) while cutting what doesn\'t (shadows, effects).' },
      { setting: 'Shadow Quality', value: 'Low', why: 'The hero-ability particle system already makes fights visually busy. Shadows add overhead without helping you track targets.' },
      { setting: 'Anti-Aliasing', value: 'TAA or DLSS (if available)', why: 'Marvel Rivals benefits from AA for hero readability. DLSS Quality mode gives you both smooth images and higher frames.' },
      { setting: 'Effects Quality', value: 'Low', why: 'Hero abilities generate enormous particle effects. Low quality caps the density and keeps frames stable during team fights.' },
      { setting: 'Post Processing', value: 'Low', why: 'Chromatic aberration, bloom, and lens effects are all in post. Low strips them out and clears up the image during hectic fights.' },
      { setting: 'Motion Blur', value: 'Off', why: 'With fast-moving heroes and camera rotations, motion blur makes tracking targets harder. Off is the standard competitive setting.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled', why: 'Team fight chaos creates high CPU-GPU latency spikes. Reflex stabilizes this and keeps your inputs feeling consistent.' },
    ]
  },
  'call of duty: warzone': {
    label: 'Warzone',
    tips: [
      { setting: 'Render Resolution', value: '100% (native)', why: 'Warzone\'s target system requires a sharp image to reliably identify and track enemies at range. Sub-100% hurts gameplay more than it helps.' },
      { setting: 'NVIDIA DLSS / AMD FSR', value: 'Quality mode', why: 'If you need more frames, Quality upscaling is the right lever — it maintains target clarity while recovering performance.' },
      { setting: 'Shadow Map Resolution', value: 'Normal', why: 'Extra shadow resolution in an open-world game has near-zero gameplay value and meaningful GPU cost. Normal is the correct setting.' },
      { setting: 'Screen Space Shadows', value: 'Off', why: 'Adds fine shadow detail around objects but creates visual noise in cluttered environments and costs consistent frame time.' },
      { setting: 'Ambient Occlusion', value: 'Off', why: 'Warzone\'s large maps render AO across a huge scene. Off recovers noticeable frame rate with no competitive downside.' },
      { setting: 'Depth of Field', value: 'Off', why: 'DoF blurs the background deliberately. In a game where spotting targets at range is critical, this setting actively works against you.' },
      { setting: 'World Motion Blur / Weapon Motion Blur', value: 'Off', why: 'Both settings make target tracking harder. Off is universal in competitive Warzone.' },
      { setting: 'Filmic Strength', value: '0', why: 'Filmic tone mapping darkens the image and reduces contrast. Zero gives you the clearest possible view of the environment.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled + Boost', why: 'Warzone\'s high-player-count lobbies create CPU bottlenecks. Reflex is especially valuable here for keeping latency low under load.' },
    ]
  },
  'call of duty: black ops 6': {
    label: 'Black Ops 6',
    tips: [
      { setting: 'Render Resolution', value: '100%', why: 'BO6\'s fast movement and omnimovement system require a clear image to track targets. Resolution is the last place to cut.' },
      { setting: 'Texture Resolution', value: 'High', why: 'Texture quality directly affects how readable player models are against background surfaces. Keep it high if VRAM allows.' },
      { setting: 'Shadow Quality', value: 'Normal', why: 'Extra shadow fidelity has no gameplay value in fast indoor/outdoor maps. Normal provides spatial awareness at a fair cost.' },
      { setting: 'Anti-Aliasing', value: 'SMAA T2X or DLSS Quality', why: 'BO6 benefits from AA for player model clarity. DLSS Quality maintains sharpness while recovering frames on NVIDIA hardware.' },
      { setting: 'Depth of Field', value: 'Off', why: 'Intentionally blurs the scene outside ADS. In a game built on omnimovement and aggressive plays, a sharp image matters.' },
      { setting: 'Motion Blur (World + Weapon)', value: 'Off', why: 'The omnimovement system already creates fast camera motion. Adding blur on top makes tracking impossible. Both off, always.' },
      { setting: 'Particle Quality', value: 'Low', why: 'BO6\'s maps have heavy environmental effects. Low particle quality keeps explosion and debris effects from spiking your frame time.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled + Boost', why: 'Reduces the latency between input and screen — critical in a game where the omnimovement system demands fast reactions.' },
    ]
  },
  'counter-strike 2': {
    label: 'Counter-Strike 2',
    tips: [
      { setting: 'Boost Player Contrast', value: 'Enabled', why: 'Makes player models stand out more clearly against background surfaces. One of the highest-value settings in CS2.' },
      { setting: 'Global Shadow Quality', value: 'Medium', why: 'High shadow quality in CS2 has a real frame cost. Medium keeps shadow-based angle reading intact at half the overhead.' },
      { setting: 'Model / Texture Detail', value: 'Low', why: 'Lower texture detail on world geometry slightly improves enemy visibility by reducing visual complexity. Pro players standard.' },
      { setting: 'Shader Detail', value: 'Low', why: 'Shader complexity affects surface reflections and lighting. Low keeps the image clean and consistent, especially indoors.' },
      { setting: 'Multisampling Anti-Aliasing Mode', value: '4x MSAA', why: 'MSAA in CS2 sharpens player model edges without the input lag cost of temporal AA methods. 4x is the competitive standard.' },
      { setting: 'FXAA Anti-Aliasing', value: 'Disabled', why: 'FXAA blurs edges post-render — it makes distant targets harder to read. Always off when using MSAA.' },
      { setting: 'VSync', value: 'Disabled', why: 'Any form of sync adds latency in CS2. With a 144Hz+ monitor and uncapped frames, VSync is always off.' },
      { setting: 'Texture Filtering Mode', value: 'Bilinear or Trilinear', why: 'Anisotropic filtering looks better on floors but costs GPU time and has no gameplay benefit. Bilinear maximizes frames.' },
      { setting: 'Wait for Vertical Sync', value: 'Disabled (via launch options: -nod3d9ex)', why: 'Launch options give lower-level control over rendering. This flag reduces input latency further beyond the in-game setting.' },
    ]
  },
  'valorant': {
    label: 'Valorant',
    tips: [
      { setting: 'Limit FPS on Battery', value: 'On', why: 'On desktop this setting doesn\'t apply. On laptops, keeping this on prevents frame rate drops that can mess with your aim.' },
      { setting: 'Material Quality', value: 'Low', why: 'Valorant\'s engine scales material quality aggressively. Low cuts cost with minimal visual change in a game built for low-end hardware.' },
      { setting: 'Texture Quality', value: 'Low', why: 'Valorant\'s art style keeps agents readable regardless of texture resolution. Low frees VRAM and GPU time with no gameplay tradeoff.' },
      { setting: 'Detail Quality', value: 'Low', why: 'Removes environmental detail that clutters angles and costs GPU time. Low is the universal pro player setting.' },
      { setting: 'UI Quality', value: 'Low', why: 'UI rendering uses GPU resources. Low is invisible in practice and frees headroom for game rendering.' },
      { setting: 'Vignette', value: 'Off', why: 'Darkens screen edges — hurts peripheral awareness. Off always in competitive play.' },
      { setting: 'VSync', value: 'Off', why: 'Adds a full frame of input lag. Off is mandatory for competitive Valorant.' },
      { setting: 'Anti-Aliasing', value: 'MSAA 4x', why: 'Makes agent edges sharp and consistent — critical for tracking fast-moving targets. 4x MSAA is the competitive standard.' },
      { setting: 'Anisotropic Filtering', value: '4x', why: 'Floor and wall textures sharpen with minimal performance cost at 4x. Beyond that the return diminishes.' },
      { setting: 'Bloom', value: 'Off', why: 'Bloom halos around bright lights reduce contrast near key angles. Off keeps the image clean.' },
      { setting: 'Distortion', value: 'Off', why: 'Removes visual warping from abilities — makes reading through utility easier in high-level play.' },
      { setting: 'First Person Shadows', value: 'Off', why: 'Removes the shadow cast by your own gun model — a surprisingly consistent frame rate recovery with no gameplay downside.' },
    ]
  },
  'battlefield 2042': {
    label: 'Battlefield 2042',
    tips: [
      { setting: 'Future Frame Rendering', value: 'Off', why: 'BF2042\'s future frame rendering adds a frame or two of latency. Off feels more responsive, especially during vehicle and squad chaos.' },
      { setting: 'DX12', value: 'Enabled', why: 'DX12 reduces CPU overhead in BF2042\'s large-scale battles. Significant improvement on multi-core CPUs during high-player-count situations.' },
      { setting: 'Texture Quality', value: 'Medium', why: 'High textures in a 128-player map eat VRAM fast. Medium keeps streaming smooth without constant hitching during map traversal.' },
      { setting: 'Shadow Quality', value: 'Medium', why: 'BF2042 has a large shadow budget due to map scale. Medium halves the cost while keeping enough shadow for terrain reading.' },
      { setting: 'Ambient Occlusion', value: 'Off', why: 'AO across 128-player outdoor maps is an enormous GPU expense. Off is correct for performance-focused play.' },
      { setting: 'Post Process Effects', value: 'Low', why: 'Lens dirt, chromatic aberration, and screen effects in BF2042 are aggressive. Low removes them and clarifies the image.' },
      { setting: 'Mesh Quality', value: 'Medium', why: 'High mesh quality increases geometry detail on props you\'ll never interact with. Medium is the performance sweet spot.' },
      { setting: 'DLSS / FSR', value: 'Quality mode', why: 'BF2042 benefits significantly from upscaling due to its large render budget. Quality mode is the best balance of sharpness and frames.' },
    ]
  },
  'battlefield v': {
    label: 'Battlefield V',
    tips: [
      { setting: 'DX12', value: 'Enabled', why: 'BFV\'s DX12 implementation is stable and reduces CPU bottlenecks in dense, 64-player battles with lots of destruction.' },
      { setting: 'Future Frame Rendering', value: 'Off', why: 'Adds input latency in exchange for slightly higher frames. The latency cost outweighs the frame gain for most players.' },
      { setting: 'Texture Quality', value: 'Medium', why: 'BFV\'s destruction system generates dynamic geometry that competes for VRAM. Medium avoids overflow and hitching.' },
      { setting: 'Shadow Quality', value: 'Medium', why: 'Maps like Panzerstorm and Twisted Steel have complex outdoor lighting. Medium quality keeps the cost manageable.' },
      { setting: 'Lighting Quality', value: 'Low', why: 'BFV\'s lighting system is beautiful but heavy. Low keeps it functional for spatial awareness without the full rendering cost.' },
      { setting: 'Post Process', value: 'Low', why: 'Removes lens flare and chromatic aberration effects that obscure visibility during bright outdoor fights.' },
      { setting: 'Mesh Quality', value: 'Medium', why: 'Balances geometric detail against the frame budget. High mesh quality has no gameplay value in motion.' },
      { setting: 'Terrain Quality', value: 'Medium', why: 'BFV\'s terrain tessellation is frame-rate intensive. Medium keeps it smooth while preserving cover geometry accuracy.' },
    ]
  },
  'overwatch 2': {
    label: 'Overwatch 2',
    tips: [
      { setting: 'Render Scale', value: '100%', why: 'OW2\'s hit registration requires a clear image to click heads. Dropping render scale hurts both visuals and accuracy on small targets.' },
      { setting: 'High Quality Upsampling', value: 'NVIDIA DLSS (if available)', why: 'DLSS Quality mode in OW2 gives near-native sharpness with a significant frame rate boost on supported GPUs.' },
      { setting: 'Texture Quality', value: 'Medium', why: 'Hero textures are readable at medium quality. This setting saves VRAM for faster streaming during hero switches.' },
      { setting: 'Texture Filtering Quality', value: 'Linear – 1x (Performance)', why: 'Higher filtering has no meaningful visual impact in OW2\'s art style. Linear is the performance-maximizing option.' },
      { setting: 'Local Fog Detail', value: 'Off', why: 'Atmospheric fog in OW2 reduces visibility on maps like Dorado and Numbani. Off is both better for performance and better for sight lines.' },
      { setting: 'Dynamic Reflections', value: 'Off', why: 'Screen-space reflections on floors and wet surfaces cost consistent GPU time with zero gameplay value.' },
      { setting: 'Shadow Detail', value: 'Off', why: 'Shadow rendering at OW2\'s frame rates (144Hz+ target) is expensive relative to its competitive benefit. Off is the pro setting.' },
      { setting: 'Model Detail', value: 'Low', why: 'LOD on background models and environments. Low does not affect hero readability and saves significant GPU budget.' },
      { setting: 'Anti-Aliasing', value: 'Off or Low', why: 'OW2\'s bright, high-contrast art style remains readable without AA. Off maximizes frames; Low is a reasonable middle ground.' },
      { setting: 'Reduce Buffered Frames', value: 'On', why: 'Directly reduces pre-rendered frame queue — one of the most impactful latency settings in OW2. On is the correct setting.' },
    ]
  },
  'rainbow six siege': {
    label: 'Rainbow Six Siege',
    tips: [
      { setting: 'Render Scaling', value: '100%', why: 'Siege\'s destruction system and one-shot headshots make pixel clarity critical. Dropping render scale costs accuracy.' },
      { setting: 'LOD Quality', value: 'Very High', why: 'In Siege, operators around corners use LOD geometry. Higher LOD means their hitboxes match their visible models more accurately.' },
      { setting: 'Shading Quality', value: 'Low', why: 'Surface shading complexity has no gameplay value. Low dramatically reduces GPU overhead in dense indoor environments.' },
      { setting: 'Texture Quality', value: 'High', why: 'Operator and environment textures affect readability significantly in Siege\'s close-quarters combat. Keep texture quality high.' },
      { setting: 'Shadow Quality', value: 'High', why: 'Siege shadows reveal operator positions behind cover. Higher shadow quality makes this intel more reliable and accurate.' },
      { setting: 'Reflection Quality', value: 'Low', why: 'Screen-space reflections in Siege are a performance cost with no tactical value. Low removes them entirely.' },
      { setting: 'Ambient Occlusion', value: 'Off', why: 'AO in tight indoor spaces is expensive. Off keeps frames high without affecting operator visibility.' },
      { setting: 'Anti-Aliasing', value: 'TAA', why: 'Siege\'s detailed geometry benefits from AA for clean operator outlines. TAA provides the best results without MSAA\'s cost.' },
      { setting: 'VSync', value: 'Off', why: 'VSync latency in a one-tap game is unacceptable. Always off — pair with a FreeSync/G-Sync monitor instead.' },
    ]
  },
  'escape from tarkov': {
    label: 'Escape from Tarkov',
    tips: [
      { setting: 'Resolution', value: 'Native (or use DLSS/FSR)', why: 'Tarkov\'s identification system — recognizing friend from enemy — requires maximum resolution. Do not drop native without upscaling.' },
      { setting: 'Texture Quality', value: 'High', why: 'Identifying gear, backpacks, and enemy vs SCAV requires texture clarity. High is necessary for accurate identification at range.' },
      { setting: 'Shadows Quality', value: 'Low', why: 'Shadow rendering in Tarkov is among the most expensive settings. Low can add 20+ FPS with minimal change to enemy visibility.' },
      { setting: 'LOD', value: 'High', why: 'Geometry LOD directly affects how accurately other players\' models render at range. High LOD keeps hitboxes consistent.' },
      { setting: 'Antialiasing', value: 'TAA Low', why: 'TAA High causes perceptible blur on moving targets. Low provides edge smoothing without ghost artifacts.' },
      { setting: 'Z-Blur', value: 'Off', why: 'Intentional blur from Z-depth effects makes target identification harder. Off always in competitive scenarios.' },
      { setting: 'Chromatic Aberrations', value: 'Off', why: 'Color fringing around edges reduces precision when spotting targets. Off keeps the image sharp.' },
      { setting: 'Noise', value: 'Off', why: 'Film grain adds visual noise that makes spotting stationary enemies harder, especially in shadows.' },
      { setting: 'Grass Shadows', value: 'Off', why: 'Ground-level shadows on foliage are expensive and create visual noise that hides players. Off is the standard competitive setting.' },
      { setting: 'SSAO', value: 'Off', why: 'Screen-space ambient occlusion in Tarkov is a major performance cost. Off is the correct setting for frame rate priority.' },
    ]
  },
  'the finals': {
    label: 'THE FINALS',
    tips: [
      { setting: 'Upscaling', value: 'DLSS Quality or FSR Quality', why: 'THE FINALS is extremely GPU-heavy due to its destruction system. Upscaling at Quality mode is near-mandatory for stable frame rates.' },
      { setting: 'Destruction Quality', value: 'Low', why: 'The destruction engine is what makes THE FINALS unique, but High destruction quality is a massive GPU drain. Low keeps frames stable.' },
      { setting: 'Shadow Quality', value: 'Low', why: 'Dynamic shadows from destruction debris multiply the shadow cost rapidly. Low prevents frame rate spikes during heavy destruction.' },
      { setting: 'Ambient Occlusion', value: 'Off', why: 'AO is recalculated dynamically as the map destructs. Off prevents the per-frame AO cost from compounding during intense fights.' },
      { setting: 'Post Processing', value: 'Low', why: 'Removes lens dirt, bloom, and atmospheric effects. Low gives the cleanest possible image during the chaotic visual environment of THE FINALS.' },
      { setting: 'Motion Blur', value: 'Off', why: 'Fast movement and destruction particles already create visual chaos. Motion blur on top of that makes tracking impossible.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled + Boost', why: 'THE FINALS\' destruction-heavy scenes spike CPU load significantly. Reflex keeps input latency stable through those spikes.' },
    ]
  },
  'hunt: showdown 1896': {
    label: 'Hunt: Showdown',
    tips: [
      { setting: 'Textures', value: 'High', why: 'Hunt\'s dense vegetation and dark environments require texture clarity to spot enemies hiding in foliage.' },
      { setting: 'Shaders', value: 'Medium', why: 'High shader quality in Hunt\'s CryEngine environment is expensive. Medium preserves visual accuracy while keeping frames stable.' },
      { setting: 'Vegetation Draw Distance', value: 'Medium', why: 'Drawing distant grass and bushes at high quality is a major GPU cost in Hunt\'s outdoor maps. Medium reduces it without affecting close-range visibility.' },
      { setting: 'Shadow Quality', value: 'Low to Medium', why: 'Shadows help identify enemies in dark buildings and treelines, so don\'t turn fully off. Low-Medium is the balance point.' },
      { setting: 'Anti-Aliasing', value: 'TAA', why: 'Hunt\'s complex foliage and environment benefit from TAA to reduce shimmer on edges, making it easier to spot movement.' },
      { setting: 'Post Processing', value: 'Low', why: 'Removes chromatic aberration and film grain. Essential — film grain actively hides enemies in Hunt\'s darker environments.' },
      { setting: 'Motion Blur', value: 'Off', why: 'Spotting moving enemies through vegetation is already hard. Motion blur makes it harder. Off always.' },
      { setting: 'Object Detail', value: 'Medium', why: 'High object detail populates the scene with props your GPU has to render. Medium removes clutter and recovers frame time.' },
    ]
  },
  'splitgate': {
    label: 'Splitgate',
    tips: [
      { setting: 'Resolution Scale', value: '100%', why: 'Splitgate\'s portal mechanics create fast, disorienting camera transitions. Native resolution maintains portal clarity so you can orient instantly.' },
      { setting: 'Shadow Quality', value: 'Low', why: 'Splitgate\'s maps have simple geometry that doesn\'t rely on shadows for depth. Low is the right call.' },
      { setting: 'Post Processing', value: 'Low', why: 'Bloom and lens effects in Splitgate\'s bright maps create glare that obscures targets. Low strips them out.' },
      { setting: 'Anti-Aliasing', value: 'Low or Off', why: 'Splitgate\'s art style is clean and geometric — it reads well at lower AA settings. Off maximizes frame rate.' },
      { setting: 'Effects Quality', value: 'Low', why: 'Portal effects are interesting but GPU-intensive. Low keeps the portal visuals functional without the full effect budget.' },
      { setting: 'VSync', value: 'Off', why: 'Portal snap rotations demand instant input response. Any VSync latency feels especially bad in Splitgate. Always Off.' },
    ]
  },
  'destiny 2': {
    label: 'Destiny 2',
    tips: [
      { setting: 'Render Resolution', value: '100% or DLSS Quality', why: 'Destiny 2\'s precision combat benefits from a sharp render. DLSS Quality on NVIDIA hardware gives the best frame-to-clarity ratio.' },
      { setting: 'Shadow Quality', value: 'Medium', why: 'Destiny 2 uses directional shadows extensively outdoors. Medium quality gives adequate spatial information at half the GPU cost.' },
      { setting: 'Ambient Occlusion', value: 'Medium or Off', why: 'AO across Destiny\'s large outdoor zones is expensive. Off or Medium prevents it from bottlenecking frame rates in open areas.' },
      { setting: 'Depth of Field', value: 'Off', why: 'DoF blurs enemies outside the focus plane. In a looter-shooter where you frequently fight at varied ranges, this hurts. Off always.' },
      { setting: 'Motion Blur', value: 'Off', why: 'Fast Titan and Hunter movement combined with ability effects makes motion blur disorienting. Off is standard.' },
      { setting: 'Wind Impulse', value: 'Off', why: 'Animated foliage movement is a background GPU cost. Off removes it with no gameplay impact.' },
      { setting: 'Texture Anisotropy', value: '4x', why: 'Floor and surface textures look sharp enough at 4x. 16x has no perceptible benefit in a game with constant camera movement.' },
      { setting: 'VSync', value: 'Off + Uncapped FPS', why: 'Destiny 2\'s combat responsiveness at 144Hz+ requires uncapped frames and no sync latency. Let the GPU run free.' },
    ]
  },
  'pubg: battlegrounds': {
    label: 'PUBG',
    tips: [
      { setting: 'Screen Scale', value: '100', why: 'Spotting players at 200–500m range requires full native resolution. Screen scale below 100 directly hurts identification at range.' },
      { setting: 'Anti-Aliasing', value: 'TAA', why: 'TAA keeps distant trees and structures clean, which is critical when scanning for players at range. FXAA blurs too much.' },
      { setting: 'Post-Processing', value: 'Ultra', why: 'PUBG\'s post-processing Ultra setting paradoxically improves visual clarity by enabling better tone mapping. It\'s the accepted competitive setting.' },
      { setting: 'Shadows', value: 'Very Low', why: 'Shadow rendering on PUBG\'s massive maps is one of the heaviest GPU costs. Very Low can add 30+ FPS with minimal gameplay impact.' },
      { setting: 'Textures', value: 'Ultra', why: 'Player clothing textures at Ultra make identification and gear recognition more reliable, especially at medium range.' },
      { setting: 'Effects', value: 'Very Low', why: 'Smoke grenades and explosion effects at lower quality paradoxically provide better visibility through utility. Very Low is the competitive standard.' },
      { setting: 'Foliage', value: 'Very Low', why: 'PUBG\'s foliage renders at client-side density. Very Low reduces the grass you see while players behind it remain detectable.' },
      { setting: 'View Distance', value: 'Ultra', why: 'LOD on buildings, vehicles, and terrain affects how much detail renders at range. Ultra gives you the maximum gameplay-relevant geometry.' },
    ]
  },
  'rust': {
    label: 'Rust',
    tips: [
      { setting: 'Grass Displacement', value: 'Off', why: 'Interactive grass physics are a significant GPU cost in Rust\'s large outdoor world. Off reduces draw calls with no gameplay downside.' },
      { setting: 'Draw Distance', value: '1500–2000', why: 'Rust\'s open world requires enough draw distance to spot threats approaching your base. 1500–2000 is the performance-safe range.' },
      { setting: 'Shadow Distance', value: '50–75', why: 'Maximum shadow distance in Rust\'s large maps is extremely expensive. 50–75 keeps close-range shadows while cutting the long-distance cost.' },
      { setting: 'Shadow Cascades', value: '1', why: 'Multiple shadow cascades multiply shadow rendering cost. 1 cascade is the minimum that maintains any shadow awareness.' },
      { setting: 'Parallax Mapping', value: 'Off', why: 'Surface depth simulation on terrain textures. Off removes an invisible background GPU cost with no gameplay impact.' },
      { setting: 'Anisotropic Filtering', value: '2', why: 'Rust\'s performance is frequently CPU-bound. Reducing AF offloads GPU texture work and helps on older hardware.' },
      { setting: 'Max Gibs', value: '0', why: 'Physics debris from destroyed structures persists and costs both CPU and GPU. 0 removes them entirely. Critical for base fights.' },
      { setting: 'FPS Limit', value: 'Uncapped or 144', why: 'Rust benefits significantly from higher frame rates for building accuracy and combat. Uncapped with a high refresh monitor is optimal.' },
    ]
  },
  'halo infinite': {
    label: 'Halo Infinite',
    tips: [
      { setting: 'Minimum Frame Rate', value: '60 (if on variable rate rendering)', why: 'Halo Infinite uses dynamic resolution to maintain this floor. Setting a floor prevents the worst-case resolution drops during combat.' },
      { setting: 'Texture Quality', value: 'High', why: 'Spartan and weapon textures affect readability in Halo\'s brighter, high-contrast visual style. Keep texture quality high.' },
      { setting: 'Shadow Quality', value: 'Low', why: 'Halo\'s outdoor Zeta Halo maps have large shadow budgets. Low cuts the cost while maintaining enough shadow for depth perception.' },
      { setting: 'Ambient Occlusion', value: 'Off', why: 'Halo\'s bright art style makes AO subtly visible but not gameplay-critical. Off is the correct competitive setting.' },
      { setting: 'Volumetric Effects', value: 'Off', why: 'Fog and atmospheric effects in Halo Infinite\'s outdoor areas cost GPU time without adding tactical information.' },
      { setting: 'Reflections', value: 'Off', why: 'Screen-space reflections on Halo\'s metallic surfaces are expensive and invisible in the heat of combat.' },
      { setting: 'Anti-Aliasing', value: 'TAA', why: 'Halo Infinite\'s fast movement benefits from TAA for consistent edge quality. MSAA isn\'t available; TAA is the best option.' },
      { setting: 'NVIDIA Reflex', value: 'Enabled', why: 'Reduces input latency in multiplayer — important in a game where the battle rifle\'s precision requires fast, clean inputs.' },
    ]
  },
  'liar\'s bar': {
    label: "Liar's Bar",
    tips: [
      { setting: 'Texture Quality', value: 'Medium', why: "Liar's Bar is a social deduction game, not a twitch shooter. Medium textures look clean at the table distances you're playing at." },
      { setting: 'Shadow Quality', value: 'Low', why: 'No gameplay value in shadows for a card/dice game. Low removes the cost entirely.' },
      { setting: 'Anti-Aliasing', value: 'TAA or Off', why: 'The close-camera table setting makes AA less impactful than in an FPS. Off if you want maximum frames; TAA for a cleaner image.' },
      { setting: 'Post Processing', value: 'Low', why: "Removes atmospheric effects that don't add anything to the gameplay experience at the card table." },
      { setting: 'VSync', value: 'Off', why: 'Even in a social game, VSync adds latency and can cause pacing issues at lower frame rates. Off with a frame cap is cleaner.' },
    ]
  },
  'schedule i': {
    label: 'Schedule I',
    tips: [
      { setting: 'Resolution', value: 'Native', why: 'Schedule I is an indie management game where text and UI readability matters. Native resolution keeps the interface sharp.' },
      { setting: 'Texture Quality', value: 'Medium', why: 'Medium textures in a top-down management game are visually indistinguishable from high at typical play distances.' },
      { setting: 'Shadow Quality', value: 'Low', why: 'Shadows have no gameplay value in a management game. Low removes the overhead.' },
      { setting: 'Anti-Aliasing', value: 'TAA or FXAA', why: 'Light AA keeps the image clean without GPU cost. Either option is fine — this game is not GPU-heavy.' },
      { setting: 'VSync', value: 'Off with 60 FPS cap', why: 'Schedule I doesn\'t benefit from 144Hz gameplay. A 60 FPS cap with VSync off is the stable, low-latency setting.' },
    ]
  },
  'r.e.p.o.': {
    label: 'R.E.P.O.',
    tips: [
      { setting: 'Resolution', value: 'Native', why: 'R.E.P.O. is a co-op horror game where spotting environmental cues matters. Native resolution keeps details readable.' },
      { setting: 'Shadow Quality', value: 'Medium', why: 'Horror atmosphere relies partly on shadows for tension. Medium keeps the aesthetic while reducing the performance cost.' },
      { setting: 'Anti-Aliasing', value: 'TAA', why: 'R.E.P.O.\'s environment has lots of thin geometry and edges that benefit from TAA smoothing.' },
      { setting: 'Post Processing', value: 'Low', why: 'Film grain and vignette in horror games can be atmospheric, but they also reduce visibility. Low is the performance-smart choice.' },
      { setting: 'Render Scale', value: '100%', why: 'Co-op survival requires seeing what your teammates and enemies are doing clearly. Native render scale is the right call.' },
    ]
  },
  'super battle golf': {
    label: 'Super Battle Golf',
    tips: [
      { setting: 'Resolution', value: 'Native', why: 'Tracking the ball arc and landing zone requires a sharp image. Native resolution keeps the gameplay readable.' },
      { setting: 'Texture Quality', value: 'Medium', why: 'Golf course textures at medium are clean and readable from above-angle cameras without the full texture VRAM cost.' },
      { setting: 'Shadow Quality', value: 'Low', why: 'Shadows have minimal gameplay value in a golf game. Low removes overhead without affecting your ability to read the course.' },
      { setting: 'Anti-Aliasing', value: 'FXAA or TAA', why: 'Course edges and ball trajectory benefit from light AA. Either is sufficient for a sports-style game.' },
      { setting: 'VSync', value: 'Off with 60 FPS cap', why: 'Stable 60 FPS with no sync latency is the right target for a game that doesn\'t require high-frame competitive input.' },
    ]
  },
};

function renderGameProfiles(games, container) {
  if (!container) return;
  if (!games || !games.length) {
    container.innerHTML = '<div class="game-count-label">No games detected — click Detect My Games.</div>';
    return;
  }

  const cards = games.map(g => {
    const key = g.name.toLowerCase().trim();
    const profile = GAME_PROFILES[key] || null;
    const hasTips = profile && profile.tips && profile.tips.length > 0;

    const tipsHtml = hasTips ? profile.tips.map(t => `
      <div class="game-tip-row">
        <span class="game-tip-label">${esc(t.setting)}</span>
        <span class="game-tip-value">${esc(t.value)}</span>
        <span class="game-tip-desc">${esc(t.why)}</span>
      </div>`).join('') : `
      <div class="game-tip-row">
        <span class="game-tip-desc">No specific tips for this game yet — the global optimizations above still apply.</span>
      </div>`;

    const badgeHtml = hasTips
      ? `<span class="game-profile-badge">${profile.tips.length} tips</span>`
      : `<span class="game-profile-badge generic">General</span>`;

    return `<div class="game-profile-card">
      <div class="game-profile-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="game-profile-name">${esc(g.name)}<span class="game-profile-launcher"> · ${esc(g.launcher)}</span></span>
        ${badgeHtml}
        <span class="game-profile-chevron">›</span>
      </div>
      <div class="game-profile-tips">${tipsHtml}</div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="game-count-label">${games.length} game${games.length!==1?'s':''} detected — click any game for performance tips</div>
    <div class="game-profile-list">${cards}</div>
  `;
}

function renderOptimizerScreen() {
  const container = document.getElementById('optimizer-content');
  if (!container) return;

  if (!_isPro) {
    container.innerHTML = renderProLock('Game Optimizer');
    return;
  }

  const pendingOpts = _lastOptResult?.applied?.length
    ? OPTIMIZATIONS.filter(o => !_lastOptResult.applied.includes(o.id))
    : OPTIMIZATIONS;

  const optRows = pendingOpts.map(o => `
    <label class="opt-row">
      <input type="checkbox" class="opt-cb" data-id="${esc(o.id)}" checked>
      <div class="opt-row-body">
        <div class="opt-row-name">${esc(o.name)}</div>
        <div class="opt-row-desc">${esc(o.desc)}</div>
        <div class="opt-benefit">${esc(o.benefit)}</div>
      </div>
      <span class="opt-safe-badge">SAFE</span>
    </label>`).join('');

  const listHtml = pendingOpts.length
    ? `<div class="opt-list">${optRows}</div>`
    : `<div class="all-clear"><span class="all-clear-icon">✓</span> All optimizations have been applied. Your PC is already tuned for gaming.</div>`;

  container.innerHTML = `
    <div class="opt-section-label">Optimizations</div>
    ${listHtml}
    <div class="tool-action-row">
      <button class="tool-primary-btn" id="opt-apply-btn"${pendingOpts.length ? '' : ' disabled'}>Apply Selected</button>
      <button class="tool-secondary-btn" id="opt-detect-btn">Detect My Games</button>
      <span class="tool-status-text" id="opt-status"></span>
    </div>
    <div id="opt-result"></div>
    <div id="opt-games"></div>
  `;

  document.getElementById('opt-apply-btn').addEventListener('click', runGameOptimize);
  document.getElementById('opt-detect-btn').addEventListener('click', runGameDetect);

  // Restore last optimization result if the user navigated away and came back
  if (_lastOptResult) {
    const applied = _lastOptResult.applied || [];
    const nameMap = Object.fromEntries(OPTIMIZATIONS.map(o => [o.id, o.name]));
    const itemsHtml = applied.map(id => `<div class="opt-result-item">${esc(nameMap[id] || id)}</div>`).join('');
    if (applied.length > 0) {
      document.getElementById('opt-result').innerHTML = `<div class="opt-result-box">
      <div class="opt-result-title">${applied.length} optimization${applied.length!==1?'s':''} applied</div>
      ${itemsHtml}
    </div>`;
    }
  }

  // Restore detected games if already fetched
  if (_gameData) {
    renderGameProfiles(_gameData.games, document.getElementById('opt-games'));
  }
}

async function runGameOptimize() {
  const applyBtn = document.getElementById('opt-apply-btn');
  const statusEl = document.getElementById('opt-status');
  const resultEl = document.getElementById('opt-result');
  if (!applyBtn || !statusEl || !resultEl) return;

  const selected = [...document.querySelectorAll('.opt-cb:checked')].map(c => c.dataset.id);
  if (!selected.length) { statusEl.textContent = 'Select at least one optimization.'; return; }

  applyBtn.disabled = true;
  statusEl.textContent = 'Applying…';
  resultEl.innerHTML = '';

  let result;
  try {
    result = await window.pclabs.runGameOptimize({ optimizations: selected });
  } catch(e) {
    statusEl.textContent = 'Failed to apply.';
    applyBtn.disabled = false;
    return;
  }

  applyBtn.disabled = false;
  statusEl.textContent = '';
  _lastOptResult = result;
  localStorage.setItem('pclabs_opt_result', JSON.stringify(result));

  const applied = result.applied || [];
  const nameMap = Object.fromEntries(OPTIMIZATIONS.map(o => [o.id, o.name]));
  const itemsHtml = applied.map(id => `<div class="opt-result-item">${esc(nameMap[id] || id)}</div>`).join('');

  if (applied.length > 0) {
    resultEl.innerHTML = `<div class="opt-result-box">
      <div class="opt-result-title">${applied.length} optimization${applied.length!==1?'s':''} applied</div>
      ${itemsHtml}
    </div>`;
  } else {
    statusEl.textContent = 'No optimizations were applied — may already be set.';
  }
}

async function runGameDetect() {
  const detectBtn = document.getElementById('opt-detect-btn');
  const statusEl  = document.getElementById('opt-status');
  const gamesEl   = document.getElementById('opt-games');
  if (!detectBtn || !statusEl || !gamesEl) return;

  detectBtn.disabled = true;
  statusEl.textContent = 'Detecting games…';
  gamesEl.innerHTML = '';

  try {
    _gameData = await window.pclabs.runGameDetect();
  } catch(e) {
    statusEl.textContent = 'Detection failed.';
    detectBtn.disabled = false;
    return;
  }

  detectBtn.disabled = false;
  statusEl.textContent = '';

  renderGameProfiles(_gameData?.games || [], gamesEl);
}

// ── Report export ─────────────────────────────────────────────────────────────

// _lastScanData is set by populateResults() so the export button always has
// the most recent scan result available without re-running the scan.
let _lastScanData = null;

document.getElementById('btn-export')?.addEventListener('click', async () => {
  if (!_lastScanData) return;

  // Gate: non-Pro users see the upgrade modal instead
  if (!_isPro) {
    document.getElementById('progate-modal').classList.add('open');
    return;
  }

  const btn = document.getElementById('btn-export');
  const restore = () => { btn.textContent = '↓ Export Report'; btn.disabled = false; };
  btn.disabled = true;
  btn.textContent = 'Generating…';
  if (typeof window.pclabs?.saveReport !== 'function') {
    btn.textContent = 'Export unavailable — restart app';
    setTimeout(restore, 4000);
    return;
  }
  try {
    const html = generateReport(_lastScanData);
    const result = await window.pclabs?.saveReport?.(html);
    if (result?.ok || result?.canceled) {
      restore();
    } else {
      btn.textContent = result?.error ? `Save failed: ${result.error}` : 'Save failed — try again';
      setTimeout(restore, 4000);
    }
  } catch (_) {
    btn.textContent = 'Save failed — try again';
    setTimeout(restore, 4000);
  }
});

// Pro-gate modal controls
document.getElementById('progate-upgrade-btn')?.addEventListener('click', () => {
  document.getElementById('progate-modal').classList.remove('open');
  const url = 'https://thepclabs.com/pricing';
  if (window.pclabs?.openExternal) window.pclabs.openExternal(url);
  else window.open(url, '_blank');
});

document.getElementById('progate-dismiss-btn')?.addEventListener('click', () => {
  document.getElementById('progate-modal').classList.remove('open');
});

// Close modal on backdrop click
document.getElementById('progate-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('progate-modal')) {
    document.getElementById('progate-modal').classList.remove('open');
  }
});

function generateReport(data) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const re = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const val = (v, fallback='Unavailable') => (v !== null && v !== undefined && String(v).trim()) ? re(String(v)) : `<span class="na">${fallback}</span>`;
  const sevColor = s => s==='high'||s==='critical'?'#f85e5e':s==='medium'?'#f5a623':s==='low'?'#4d9eff':'#7b8ea8';

  // ── Section builder ──────────────────────────────────────────────────────────
  const section = (title, content) => `
<section>
  <h2>${re(title)}</h2>
  <div class="section-body">${content}</div>
</section>`;

  const kv = (label, value) => `
<div class="kv-row">
  <span class="kv-label">${re(label)}</span>
  <span class="kv-value">${value}</span>
</div>`;

  const badge = (text, color) => `<span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${re(text)}</span>`;

  // ── 1. System Summary ────────────────────────────────────────────────────────
  const bm  = data.biosMotherboard || {};
  const sys = section('System Summary', `
${kv('CPU',     val(data.cpu))}
${kv('GPU',     val(data.gpu))}
${kv('RAM',     val(data.ram))}
${kv('Storage', val(data.disk))}
${kv('OS',      val(data.os))}
`);

  // ── 1b. BIOS & Motherboard ───────────────────────────────────────────────────
  const biosSection = section('BIOS & Motherboard', `
${kv('BIOS Manufacturer', val(bm.bios?.manufacturer))}
${kv('BIOS Version',      val(bm.bios?.version))}
${kv('BIOS Date',         val(bm.bios?.releaseDate))}
${kv('Motherboard',       val(bm.motherboard ? `${bm.motherboard.manufacturer||''} ${bm.motherboard.model||''}`.trim() : null))}
${kv('System',            val(bm.system ? `${bm.system.manufacturer||''} ${bm.system.model||''}`.trim() : null))}
`);

  // ── 2. Health Score ──────────────────────────────────────────────────────────
  const score       = data.score ?? 0;
  const scoreColor  = score>=80?'#00d97e':score>=55?'#f5a623':'#f85e5e';
  const scoreLabel  = score>=80?'Good shape':score>=55?'A few things to address':'Needs attention';
  const readiness   = data.readiness || '—';
  const issueCount  = data.issueCount ?? 0;

  const scoreSection = section('Health & Readiness', `
<div class="score-row">
  <div class="score-block">
    <div class="score-num" style="color:${scoreColor}">${score}</div>
    <div class="score-lbl">PC Health Score</div>
    <div class="score-sub">${scoreLabel}</div>
  </div>
  <div class="score-block">
    <div class="score-num" style="color:${issueCount===0?'#00d97e':issueCount<=3?'#f5a623':'#f85e5e'}">${issueCount}</div>
    <div class="score-lbl">Issues Found</div>
    <div class="score-sub">Medium or higher severity</div>
  </div>
  <div class="score-block">
    <div class="score-num" style="color:${readiness==='Excellent'||readiness==='Good'?'#00d97e':readiness==='Needs Work'?'#f85e5e':'#f5a623'}">${re(readiness)}</div>
    <div class="score-lbl">Gaming Readiness</div>
    <div class="score-sub">Based on detected hardware</div>
  </div>
</div>`);

  // ── 3. Issues Found ──────────────────────────────────────────────────────────
  const issues = Array.isArray(data.issues) ? data.issues : [];
  const issuesContent = issues.length === 0 || issues[0]?.title === 'No major issues found'
    ? '<p class="all-clear">✓ No major issues found — your system looks healthy.</p>'
    : issues.map(i => `
<div class="issue-row">
  ${badge(i.sev==='high'||i.sev==='critical'?'HIGH':i.sev.toUpperCase(), sevColor(i.sev))}
  <div>
    <div class="issue-title">${re(i.title)}</div>
    <div class="issue-desc">${re(i.desc)}</div>
  </div>
</div>`).join('');
  const issuesSection = section('Key Issues', issuesContent);

  // ── 4. Recommendations ───────────────────────────────────────────────────────
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const allFindings = categories.flatMap(c =>
    c.findings
      .filter(f => !f.isInfo && ['critical','high','medium','low'].includes(f.sev) && f.action && !f.action.startsWith('No action'))
      .map(f => ({ ...f, catTitle: c.title }))
  );
  const ord = { critical:0, high:1, medium:2, low:3 };
  allFindings.sort((a,b) => (ord[a.sev]??9)-(ord[b.sev]??9));
  const seenRec = new Set();
  const uniqueRecs = allFindings.filter(f => { if(seenRec.has(f.id)) return false; seenRec.add(f.id); return true; });

  const recsContent = uniqueRecs.length === 0
    ? '<p class="all-clear">✓ No specific actions required.</p>'
    : uniqueRecs.map((f,i) => `
<div class="rec-row">
  <span class="rec-num">${String(i+1).padStart(2,'0')}</span>
  <div>
    <div class="rec-title">${badge(f.sev==='critical'||f.sev==='high'?'HIGH':f.sev.toUpperCase(), sevColor(f.sev))} ${re(f.title)}</div>
    <div class="rec-action">${re(f.action)}</div>
    <div class="rec-cat">${re(f.catTitle)}</div>
  </div>
</div>`).join('');
  const recsSection = section('Recommendations', recsContent);

  // ── 5. Startup Apps ──────────────────────────────────────────────────────────
  const sa = data.startupApps || {};
  // Dedup by name+location so entries with the same display name but different
  // sources (WMI vs HKCU vs HKLM) are not collapsed into one row.
  const heavyKeys = new Set((sa.heavyItems||[]).map(i=>`${i.name}|${i.location||''}`));
  const saItems = (sa.heavyItems || []).slice(0,5).concat(
    (sa.items||[]).filter(i => !heavyKeys.has(`${i.name}|${i.location||''}`))
  ).slice(0,8);
  const startupTableLabel = saItems.length < (sa.count ?? 0)
    ? `Top ${saItems.length} of ${sa.count} shown`
    : String(sa.count);
  const startupContent = `
${kv('Startup Items', val(sa.count != null ? startupTableLabel : null))}
${kv('Potentially Heavy Apps', val(sa.heavyCount != null ? String(sa.heavyCount) : null))}
${saItems.length > 0 ? `<table class="data-table"><thead><tr><th>Name</th><th>Location</th><th>Impact</th></tr></thead><tbody>${
  saItems.map(i=>`<tr><td>${re(i.name)}</td><td>${re(i.location||'—')}</td><td>${re(i.impact||'unknown')}</td></tr>`).join('')
}</tbody></table>` : ''}`;
  const startupSection = section('Startup Apps', startupContent);

  // ── 6. Background Processes ──────────────────────────────────────────────────
  const pd = data.backgroundProcesses || {};
  const topMem  = (pd.topMemory||[]).slice(0,6);
  const flagged = (pd.flagged||[]).slice(0,3);
  const dups    = (pd.duplicates||[]).filter(d => d.name && d.count != null).slice(0,4);
  const procsContent = `
${kv('Total Running Processes', val(pd.totalCount != null ? String(pd.totalCount) : null))}
${kv('Performance Drains Noted', val(flagged.length > 0 ? flagged.map(f=>f.name).join(', ') : 'None'))}
${topMem.length > 0 ? `<table class="data-table"><thead><tr><th>Process</th><th>Memory</th></tr></thead><tbody>${
  topMem.map(p=>`<tr><td>${re(p.name)}</td><td>${re(p.memMB ? p.memMB+' MB' : '—')}</td></tr>`).join('')
}</tbody></table>` : ''}
${dups.length > 0 ? `<p class="sub-label">Multiple instances</p><table class="data-table"><thead><tr><th>Process</th><th>Instances</th><th>Total Memory</th></tr></thead><tbody>${
  dups.map(d=>`<tr><td>${re(d.name)}</td><td>${re(d.count)}</td><td>${re(d.totalMemMB != null ? d.totalMemMB+' MB' : '—')}</td></tr>`).join('')
}</tbody></table>` : ''}`;
  const procsSection = section('Background Processes', procsContent);

  // ── 7. Crash & Reliability ───────────────────────────────────────────────────
  const sr = data.stabilityReport || {};
  const ri = sr.reliabilityIndex;
  // Show a calm fallback when none of the stability signals are populated
  const hasStabilityData = sr.bsod?.count != null || sr.kp?.count != null ||
                           sr.appCrash?.count7d != null || ri != null;
  const crashContent = !hasStabilityData
    ? '<p class="all-clear">No crash or reliability data was returned for this scan. This is normal on some system configurations.</p>'
    : `
${ri != null ? kv('Windows Reliability Index', `${ri.toFixed(1)} / 10`) : ''}
${kv('Blue Screens (30 days)',         val(sr.bsod?.count != null ? String(sr.bsod.count) : null))}
${kv('Unexpected Shutdowns (30 days)', val(sr.kp?.count != null ? String(sr.kp.count) : null))}
${kv('App Crashes (7 days)',           val(sr.appCrash?.count7d != null ? String(sr.appCrash.count7d) : null))}
${kv('Hardware Errors (WHEA)',         val(sr.whea?.count != null ? (sr.whea.count===0?'None':String(sr.whea.count)) : null))}
${sr.bsod?.recent?.filter(e=>e.code).slice(0,3).length > 0 ? `
<p class="sub-label">Recent stop codes</p>
<table class="data-table"><thead><tr><th>Date</th><th>Code</th><th>Name</th></tr></thead><tbody>${
  sr.bsod.recent.filter(e=>e.code).slice(0,3).map(e=>
    `<tr><td>${re(e.date||'—')}</td><td>${re(e.code)}</td><td>${re(e.codeName||'—')}</td></tr>`
  ).join('')
}</tbody></table>` : ''}`;
  const crashSection = section('Crash & Reliability', crashContent);

  // ── Assemble ─────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PCLabs Report — ${dateStr}</title>
<style>
  :root { --green:#00d97e; --amber:#f5a623; --red:#f85e5e; --blue:#4d9eff; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,-apple-system,sans-serif; font-size:14px; line-height:1.6;
         color:#1a1a2e; background:#fff; padding:0; }
  .page { max-width:860px; margin:0 auto; padding:40px 32px; }
  header { border-bottom:2px solid #1a1a2e; padding-bottom:20px; margin-bottom:32px; }
  header h1 { font-size:1.6rem; font-weight:800; letter-spacing:-0.02em; }
  header h1 span { color:var(--green); }
  .meta { font-size:0.82rem; color:#666; margin-top:4px; }
  .disclaimer { font-size:0.78rem; color:#888; border:1px solid #ddd; border-radius:6px;
                padding:10px 14px; margin-top:16px; line-height:1.5; }
  section { margin-bottom:32px; }
  h2 { font-size:1rem; font-weight:700; letter-spacing:0.02em; text-transform:uppercase;
       color:#444; border-bottom:1px solid #e0e0e0; padding-bottom:6px; margin-bottom:14px; }
  .section-body { }
  .kv-row { display:flex; align-items:baseline; gap:8px; padding:5px 0;
            border-bottom:1px solid #f0f0f0; font-size:0.88rem; }
  .kv-label { width:180px; flex-shrink:0; color:#555; font-weight:500; }
  .kv-value { flex:1; font-weight:600; font-family:ui-monospace,monospace; font-size:0.85rem; }
  .na { color:#aaa; font-weight:400; font-family:inherit; }
  .score-row { display:flex; gap:24px; flex-wrap:wrap; margin-bottom:8px; }
  .score-block { text-align:center; min-width:120px; }
  .score-num { font-size:2.4rem; font-weight:800; font-family:ui-monospace,monospace; }
  .score-lbl { font-size:0.75rem; color:#555; font-weight:600; text-transform:uppercase;
               letter-spacing:0.05em; margin-top:2px; }
  .score-sub { font-size:0.75rem; color:#888; }
  .badge { font-size:0.68rem; font-weight:700; border-radius:4px; padding:2px 7px;
           letter-spacing:0.04em; display:inline-block; vertical-align:middle;
           margin-right:6px; white-space:nowrap; }
  .issue-row, .rec-row { display:flex; align-items:flex-start; gap:10px;
                          padding:9px 0; border-bottom:1px solid #f0f0f0; font-size:0.88rem; }
  .issue-title, .rec-title { font-weight:600; margin-bottom:2px; }
  .issue-desc, .rec-action { color:#555; font-size:0.83rem; }
  .rec-cat { font-size:0.72rem; color:#aaa; margin-top:3px; }
  .rec-num { font-family:ui-monospace,monospace; font-size:0.68rem; font-weight:700;
             background:#f0fdf4; color:var(--green); border:1px solid #bbf7d0;
             border-radius:4px; padding:2px 7px; flex-shrink:0; margin-top:2px; }
  .all-clear { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;
               border-radius:6px; padding:10px 14px; font-size:0.88rem; }
  .data-table { width:100%; border-collapse:collapse; margin-top:10px; font-size:0.83rem; }
  .data-table th { text-align:left; font-size:0.72rem; text-transform:uppercase;
                   letter-spacing:0.05em; color:#888; border-bottom:2px solid #e0e0e0;
                   padding:5px 8px; }
  .data-table td { padding:5px 8px; border-bottom:1px solid #f0f0f0; color:#333; }
  .data-table tr:last-child td { border-bottom:none; }
  .sub-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em;
               color:#888; margin:12px 0 4px; }
  footer { border-top:1px solid #e0e0e0; padding-top:16px; margin-top:32px;
           font-size:0.75rem; color:#aaa; }
  @media print {
    body { font-size:12px; }
    .page { padding:20px; }
    section { page-break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="page">
<header>
  <h1><span>PC</span>Labs — Diagnostic Report</h1>
  <div class="meta">Generated ${dateStr} at ${timeStr} &nbsp;·&nbsp; ${re(data.os||'Windows')} &nbsp;·&nbsp; Read-only scan</div>
  <div class="disclaimer">
    <strong>Read-only diagnostics.</strong>
    This report was generated by PCLabs. No changes were made to the PC.
    All findings are for information only — you decide what to act on.
    Severity and confidence ratings reflect automated analysis and should be reviewed by a qualified technician before action is taken.
  </div>
</header>

${sys}
${biosSection}
${scoreSection}
${issuesSection}
${recsSection}
${startupSection}
${procsSection}
${crashSection}

<footer>PCLabs &nbsp;·&nbsp; thepclabs.com &nbsp;·&nbsp; Report generated ${dateStr}</footer>
</div>
</body>
</html>`;
}
