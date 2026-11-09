// DORA AI Ajan Paketi — uygulama arayüzü (bağımlılıksız ES modülü)
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

const state = {
  version: '—',
  settings: { institution: {}, integrations: [] },
  sessions: [],
  activeSession: null,
  counts: {},
  roles: [],
  phases: [],
};

const PHASE_TITLES = {
  C1: 'Önemli iş hizmetleri',
  C2: 'Etki toleransları',
  C3: 'Kaynak haritalama',
  C4: 'Senaryo testleri',
  C5: 'Öz değerlendirme',
  C6: 'İşletim sistemi (MOS)',
};

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = 'toast ' + kind), 3600);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* boş gövde */
  }
  if (!res.ok) {
    const msg = data.error || data.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function loadState() {
  const s = await api('/api/state');
  state.version = s.version;
  state.settings = s.settings;
  state.sessions = s.sessions || [];
  state.activeSession = s.activeSession;
  state.counts = s.counts || {};
  $('#ver').textContent = 'v' + s.version;
  const [roles, lifecycle] = await Promise.all([
    api('/api/catalog/roles').catch(() => ({ roles: [] })),
    api('/api/lifecycle').catch(() => ({ phases: [] })),
  ]);
  state.roles = roles.roles || [];
  state.phases = lifecycle.phases || [];
  renderSessionPill();
}

function renderSessionPill() {
  const pill = $('#sessionPill');
  if (state.activeSession) {
    pill.textContent = `${state.activeSession.session_id} · ${state.activeSession.tier ?? '—'}`;
    pill.className = 'pill ok';
  } else {
    pill.textContent = 'oturum yok';
    pill.className = 'pill';
  }
}

const markSaved = () => {
  const el = $('#saveState');
  el.textContent = 'kaydedildi ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  el.className = 'pill ok';
};

/* ── görünümler ───────────────────────────────────────── */

function viewGenel() {
  const inst = state.settings.institution || {};
  const counts = state.counts;
  const session = state.activeSession;
  const phases = state.phases.length
    ? state.phases
    : ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((id) => ({ id, name: { tr: PHASE_TITLES[id] } }));

  return `
    <div class="grid k4">
      ${stat(counts.processes, 'Süreç', '5 sütun')}
      ${stat(counts.controls, 'Kontrol', 'kanıt şartnameli')}
      ${stat(counts.roles, 'Ajan', 'üç savunma hattı')}
      ${stat(counts.terms, 'Terim', 'DORA sözlüğü')}
    </div>

    <div class="card">
      <h2>Kurum</h2>
      <p class="sub">${inst.name ? esc(inst.name) : 'Henüz kurum adı girilmedi'} · ${esc(inst.tier || 'tier seçilmedi')} · ${esc(inst.regulator || 'regülatör yok')} · ${esc(inst.jurisdiction || 'TR')}</p>
      <div class="actions">
        <a class="ghost" href="#kurum" style="padding:8px 14px">Kurum profilini düzenle</a>
        <a class="ghost" href="#entegrasyonlar" style="padding:8px 14px">API bağlantıları</a>
      </div>
    </div>

    <div class="card">
      <h2>Kurulum fazları</h2>
      <p class="sub">${session ? 'Aktif oturum: ' + esc(session.session_id) : 'Kuruluma başlamak için oturum oluşturun'}</p>
      <div class="phases">
        ${phases
          .map((p) => {
            const st = session?.phases?.[p.id];
            const label = st?.status === 'completed' ? 'tamamlandı' : st?.status === 'blocked' ? 'kapı kapalı' : 'başlanmadı';
            const cls = st?.status === 'completed' ? 'ok' : st?.status === 'blocked' ? 'bad' : '';
            return `<div class="phase">
              <div class="id">${esc(p.id)}</div>
              <div class="nm">${esc(p.name?.tr ?? PHASE_TITLES[p.id] ?? '')}</div>
              <div class="st"><span class="pill ${cls}">${label}</span></div>
            </div>`;
          })
          .join('')}
      </div>
      <div class="actions">
        ${session ? `<button class="ghost-btn" id="newSession">Yeni oturum</button>` : `<button class="primary" id="newSession">Oturum oluştur</button>`}
        <span class="sub">Sihirbaz komut satırından da çalıştırılabilir: <code>phase C1 --demo</code></span>
      </div>
    </div>

    <div class="card">
      <h2>Oturumlar</h2>
      <table>
        <thead><tr><th>Oturum</th><th>Tier</th><th>Regülatör</th><th>Faz</th><th class="num">Artefakt</th><th>Oluşturma</th></tr></thead>
        <tbody>
          ${
            state.sessions.length
              ? state.sessions
                  .map(
                    (s) => `<tr>
                      <td class="mono">${esc(s.session_id)}</td>
                      <td>${esc(s.tier ?? '—')}</td>
                      <td>${esc(s.regulator ?? '—')}</td>
                      <td>${esc(s.current_phase ?? '—')}</td>
                      <td class="num">${s.artifacts ?? 0}</td>
                      <td>${s.created_at ? new Date(s.created_at).toLocaleString('tr-TR') : '—'}</td>
                    </tr>`,
                  )
                  .join('')
              : '<tr><td colspan="6" class="sub">Henüz oturum yok.</td></tr>'
          }
        </tbody>
      </table>
    </div>`;
}

const stat = (n, label, hint) => `<div class="stat"><div class="l">${label}</div><div class="n">${n ?? '—'}</div><div class="h">${hint}</div></div>`;

function viewKurum() {
  const i = state.settings.institution || {};
  return `
    <div class="card">
      <h2>Kurum profili</h2>
      <p class="sub">Bu bilgiler yeni oturumların başlangıç değerleri olur.</p>
      <div class="row"><label>Kurum adı</label><input id="fName" value="${esc(i.name)}" placeholder="Örnek Bankası A.Ş."></div>
      <div class="row"><label>Tier</label>
        <select id="fTier">
          <option value="">seçilmedi</option>
          ${['tier1', 'tier2', 'tier3'].map((t) => `<option value="${t}" ${i.tier === t ? 'selected' : ''}>${t}${t === 'tier1' ? ' — büyük/sistemik' : t === 'tier2' ? ' — orta ölçek' : ' — küçük/kamu'}</option>`).join('')}
        </select>
      </div>
      <div class="row"><label>Yetkili otorite</label>
        <select id="fReg">
          <option value="">seçilmedi</option>
          ${['BDDK', 'TCMB', 'SEDDK', 'SPK', 'EBA', 'ESMA', 'EIOPA', 'FCA', 'BaFin'].map((r) => `<option value="${r}" ${i.regulator === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="row"><label>Yargı alanı</label>
        <select id="fJur">
          ${['TR', 'DE', 'FR', 'NL', 'IE', 'EU'].map((j) => `<option value="${j}" ${i.jurisdiction === j ? 'selected' : ''}>${j}</option>`).join('')}
        </select>
      </div>
      <div class="row"><label>Lisanslar</label><input id="fLic" value="${esc((i.licenses || []).join(', '))}" placeholder="mevduat, sigorta, ödeme"></div>
      <div class="row"><label></label><div class="help">Virgülle ayırın. Tier seçimi orantılılık (Madde 16) gerekçesiyle birlikte kaydedilir.</div></div>
      <div class="actions">
        <button class="primary" id="saveInst">Kaydet</button>
        <span class="sub">Şema doğrulaması: <code>validate --strict</code></span>
      </div>
    </div>`;
}

function viewEntegrasyonlar() {
  const list = state.settings.integrations || [];
  const vendors = {
    siem: ['splunk', 'elastic', 'qradar', 'sentinel', 'wazuh'],
    itsm: ['servicenow', 'jira', 'freshservice', 'topdesk'],
    grc: ['archer', 'servicenow_grc', 'metricstream', 'logicmanager'],
    cmdb: ['servicenow_cmdb', 'device42', 'custom_api'],
  };
  const statusPill = (s) =>
    s === 'verified' ? '<span class="pill ok">doğrulandı</span>'
      : s === 'configured' ? '<span class="pill warn">yapılandırıldı</span>'
      : s === 'error' ? '<span class="pill bad">hata</span>'
      : '<span class="pill">kurulmadı</span>';

  return `
    <div class="card">
      <h2>API bağlantıları</h2>
      <p class="sub">Ajanların kullandığı dış sistemler. Anahtarlar <code>web-data/secrets.json</code> içinde tutulur ve arayüze geri dönmez.</p>
      ${list
        .map(
          (i) => `
        <div class="int" data-id="${esc(i.id)}">
          <header>
            <b>${esc(i.label ?? i.id)}</b>
            <span class="st">${statusPill(i.status)}</span>
          </header>
          <div class="grid k2">
            <div>
              <label class="sub">Ürün</label>
              <input class="iv" value="${esc(i.vendor)}" list="v-${esc(i.id)}" placeholder="ör. splunk">
              <datalist id="v-${esc(i.id)}">${(vendors[i.type] || []).map((v) => `<option value="${v}">`).join('')}</datalist>
            </div>
            <div>
              <label class="sub">Kimlik doğrulama</label>
              <select class="ia">
                ${['token', 'basic', 'oauth2', 'mtls', 'none'].map((a) => `<option value="${a}" ${i.auth_type === a ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="sub">Endpoint</label>
            <input class="ie" value="${esc(i.endpoint)}" placeholder="https://siem.ornek.local/api/events">
          </div>
          <div style="margin-top:10px">
            <label class="sub">Anahtar / token ${i.has_token ? '<span class="pill ok">kayıtlı</span>' : ''}</label>
            <input class="it" type="password" placeholder="${i.has_token ? 'değiştirmek için yeni değer girin' : 'Bearer token veya kullanıcı:parola'}">
          </div>
          <div class="actions">
            <button class="primary isave">Kaydet</button>
            <button class="ghost-btn itest" ${i.endpoint ? '' : 'disabled'}>Bağlantıyı test et</button>
            ${i.last_test ? `<span class="meta">son test: ${new Date(i.last_test.at).toLocaleString('tr-TR')} · ${esc(i.last_test.detail)}</span>` : ''}
          </div>
        </div>`,
        )
        .join('')}
    </div>`;
}

function viewEnvanter() {
  const s = state.activeSession;
  if (!s) return noSession('Envanter girmek için önce oturum oluşturun.');
  return `
    <div class="card">
      <h2>ICT envanteri</h2>
      <p class="sub">Oturum: <span class="mono">${esc(s.session_id)}</span> · CSV yapıştırın veya satır satır girin.</p>
      <textarea id="csv" placeholder="id,name,criticality,provider
AST-001,Core Banking,critical,Vendor X
AST-002,API Gateway,important,Vendor Y"></textarea>
      <div class="actions">
        <button class="primary" id="importInv">İçe aktar</button>
        <button class="ghost-btn" id="loadInv">Mevcut envanteri getir</button>
        <span class="sub">Zorunlu: <code>name</code>. <code>criticality</code>: critical / important / standard.</span>
      </div>
      <div id="invResult"></div>
    </div>`;
}

function viewAjanlar() {
  const s = state.activeSession;
  if (!s) return noSession('Ajan aktivasyonu için oturum gerekir.');
  return `
    <div class="card">
      <h2>Ajan aktivasyonu</h2>
      <p class="sub">Aktif ajanları seçin ve her birine insan muadili atayın. Bağımsızlık kontrolleri kayıtla birlikte yazılır.</p>
      <table>
        <thead><tr><th></th><th>Ajan</th><th>Rol</th><th>Hat</th><th>İnsan muadili</th></tr></thead>
        <tbody>
          ${state.roles
            .map(
              (r) => `<tr>
                <td><input type="checkbox" class="ag" data-id="${esc(r.id)}" ${['ROL-INC-01', 'ROL-CIO-01', 'ROL-RSK-01', 'ROL-CMP-01'].includes(r.id) ? 'checked' : ''}></td>
                <td class="mono">${esc(r.id)}</td>
                <td>${esc(r.name?.tr ?? '')}</td>
                <td><span class="pill">${esc(r.layer ?? '—')}</span></td>
                <td><input class="hm" data-id="${esc(r.id)}" placeholder="ad soyad / birim"></td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
      <div class="actions">
        <button class="primary" id="saveAgents">Aktivasyonu kaydet</button>
        <button class="ghost-btn" id="loadAgents">Mevcut kaydı getir</button>
      </div>
      <div id="agentResult"></div>
    </div>`;
}

function viewKanitlar() {
  const s = state.activeSession;
  if (!s) return noSession('Kanıtlar oturuma bağlıdır; önce oturum oluşturun.');
  return `
    <div class="card">
      <h2>Kanıt dosyaları</h2>
      <p class="sub">Oturum: <span class="mono">${esc(s.session_id)}</span></p>
      <table>
        <thead><tr><th>Dosya</th><th class="num">Boyut</th><th>Değişti</th><th></th></tr></thead>
        <tbody id="artBody"><tr><td colspan="4" class="sub">Yükleniyor…</td></tr></tbody>
      </table>
    </div>
    <div class="card" id="artViewCard" style="display:none">
      <h2 id="artTitle">—</h2>
      <pre id="artBodyView" class="mono" style="overflow:auto;max-height:420px;background:#0c1322;border:1px solid var(--line);border-radius:10px;padding:14px"></pre>
    </div>`;
}

const noSession = (msg) => `
  <div class="card">
    <h2>Oturum gerekli</h2>
    <p class="sub">${esc(msg)}</p>
    <div class="actions"><button class="primary" data-action="newSession">Oturum oluştur</button></div>
  </div>`;

/* ── davranışlar ──────────────────────────────────────── */

async function createSession() {
  const tier = state.settings.institution?.tier || 'tier2';
  const regulator = state.settings.institution?.regulator || 'BDDK';
  const jurisdiction = state.settings.institution?.jurisdiction || 'TR';
  try {
    const r = await api('/api/sessions', { method: 'POST', body: JSON.stringify({ tier, regulator, jurisdiction }) });
    toast('Oturum oluşturuldu: ' + r.session.session_id, 'ok');
    await loadState();
    render();
  } catch (e) {
    toast('Oturum oluşturulamadı: ' + e.message, 'bad');
  }
}

function bindCommon() {
  document.querySelectorAll('[data-action="newSession"], #newSession').forEach((b) => b.addEventListener('click', createSession));
}

function bindKurum() {
  const btn = $('#saveInst');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const payload = {
      name: $('#fName').value.trim(),
      tier: $('#fTier').value,
      regulator: $('#fReg').value,
      jurisdiction: $('#fJur').value,
      licenses: $('#fLic').value.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      await api('/api/institution', { method: 'PUT', body: JSON.stringify(payload) });
      state.settings.institution = { ...state.settings.institution, ...payload };
      markSaved();
      toast('Kurum profili kaydedildi', 'ok');
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });
}

function bindEntegrasyonlar() {
  document.querySelectorAll('.int').forEach((card) => {
    const id = card.dataset.id;
    const save = card.querySelector('.isave');
    const test = card.querySelector('.itest');
    const collect = () => ({
      vendor: card.querySelector('.iv').value.trim(),
      endpoint: card.querySelector('.ie').value.trim(),
      auth_type: card.querySelector('.ia').value,
      token: card.querySelector('.it').value.trim() || undefined,
    });
    save.addEventListener('click', async () => {
      try {
        await api('/api/integrations/' + id, { method: 'PUT', body: JSON.stringify(collect()) });
        toast('Bağlantı kaydedildi', 'ok');
        await loadState();
        render();
      } catch (e) {
        toast('Kaydedilemedi: ' + e.message, 'bad');
      }
    });
    test.addEventListener('click', async () => {
      test.disabled = true;
      test.textContent = 'test ediliyor…';
      try {
        const r = await api('/api/integrations/' + id + '/test', { method: 'POST', body: '{}' });
        toast('Bağlantı testi: ' + r.detail, 'ok');
        await loadState();
        render();
      } catch (e) {
        toast('Test başarısız: ' + e.message, 'bad');
        await loadState();
        render();
      }
    });
  });
}

function bindEnvanter() {
  const btn = $('#importInv');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const raw = $('#csv').value.trim();
    if (!raw) return toast('CSV boş', 'bad');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].toLowerCase().includes('name') ? 1 : 0;
    const assets = lines.slice(header).map((l) => {
      const [id, name, criticality, provider] = l.split(',').map((x) => (x ?? '').trim());
      return { id, name: name || id, criticality: criticality || 'standard', provider: provider || '' };
    });
    try {
      const r = await api(`/api/sessions/${state.activeSession.session_id}/inventory`, {
        method: 'POST',
        body: JSON.stringify({ assets }),
      });
      toast(`${r.count} varlık içe aktarıldı`, 'ok');
      renderInvTable(r);
      await loadState();
    } catch (e) {
      toast('İçe aktarılamadı: ' + e.message, 'bad');
    }
  });
  $('#loadInv')?.addEventListener('click', loadInv);
}

async function loadInv() {
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/ict-inventory.json`);
    renderInvTable(r.value);
  } catch {
    toast('Kayıtlı envanter yok', 'bad');
  }
}

function renderInvTable(payload) {
  const assets = payload.assets || payload;
  const box = $('#invResult');
  if (!box) return;
  box.innerHTML = `
    <table style="margin-top:14px">
      <thead><tr><th>ID</th><th>Ad</th><th>Kritiklik</th><th>Tedarikçi</th></tr></thead>
      <tbody>${assets
        .map(
          (a) => `<tr><td class="mono">${esc(a.id)}</td><td>${esc(a.name)}</td>
          <td><span class="pill ${a.criticality === 'critical' ? 'bad' : a.criticality === 'important' ? 'warn' : ''}">${esc(a.criticality)}</span></td>
          <td>${esc(a.provider ?? '')}</td></tr>`,
        )
        .join('')}</tbody>
    </table>`;
}

function bindAjanlar() {
  const btn = $('#saveAgents');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const activated = [...document.querySelectorAll('.ag:checked')].map((c) => c.dataset.id);
    const human_mapping = {};
    document.querySelectorAll('.hm').forEach((i) => {
      if (i.value.trim()) human_mapping[i.dataset.id] = i.value.trim();
    });
    if (!activated.length) return toast('En az bir ajan seçin', 'bad');
    try {
      const r = await api(`/api/sessions/${state.activeSession.session_id}/agents`, {
        method: 'POST',
        body: JSON.stringify({ activated, human_mapping }),
      });
      toast(`${r.activated.length} ajan aktive edildi`, 'ok');
      const box = $('#agentResult');
      if (box) {
        box.innerHTML = `<div class="actions">${r.independence_checks
          .map((c) => `<span class="pill ${c.result === 'PASS' ? 'ok' : 'bad'}">${esc(c.check)} ${esc(c.result)}</span>`)
          .join('')}</div>`;
      }
      await loadState();
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });
  $('#loadAgents')?.addEventListener('click', loadAgents);
}

async function loadAgents() {
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/agent-activation.json`);
    const v = r.value;
    document.querySelectorAll('.ag').forEach((c) => (c.checked = (v.activated || []).includes(c.dataset.id)));
    document.querySelectorAll('.hm').forEach((i) => (i.value = v.human_mapping?.[i.dataset.id] ?? ''));
    toast('Aktivasyon kaydı yüklendi', 'ok');
  } catch {
    toast('Kayıt yok', 'bad');
  }
}

async function loadArtifacts() {
  const body = $('#artBody');
  if (!body) return;
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}`);
    const arts = r.artifacts || [];
    body.innerHTML = arts.length
      ? arts
          .map(
            (a) => `<tr>
              <td class="mono">${esc(a.name)}</td>
              <td class="num">${a.size} B</td>
              <td>${new Date(a.modified).toLocaleString('tr-TR')}</td>
              <td><button class="ghost-btn art-open" data-name="${esc(a.name)}">görüntüle</button></td>
            </tr>`,
          )
          .join('')
      : '<tr><td colspan="4" class="sub">Bu oturumda henüz artefakt yok.</td></tr>';
    document.querySelectorAll('.art-open').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          const r2 = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/${b.dataset.name}`);
          $('#artViewCard').style.display = 'block';
          $('#artTitle').textContent = b.dataset.name;
          $('#artBodyView').textContent = typeof r2.value === 'string' ? r2.value : JSON.stringify(r2.value, null, 2);
        } catch (e) {
          toast('Açılamadı: ' + e.message, 'bad');
        }
      }),
    );
  } catch (e) {
    body.innerHTML = `<tr><td colspan="4" class="sub">${esc(e.message)}</td></tr>`;
  }
}

/* ── router ───────────────────────────────────────────── */

const ROUTES = {
  genel: { title: 'Genel bakış', sub: 'Kurumun DORA kurulum durumu', render: viewGenel, bind: bindCommon },
  kurum: { title: 'Kurum profili', sub: 'Temel bilgiler ve tier seçimi', render: viewKurum, bind: bindKurum },
  entegrasyonlar: { title: 'Entegrasyonlar', sub: 'SIEM, ITSM, GRC ve CMDB bağlantıları', render: viewEntegrasyonlar, bind: bindEntegrasyonlar },
  envanter: { title: 'Envanter', sub: 'ICT varlıkları içe aktarma', render: viewEnvanter, bind: bindEnvanter },
  ajanlar: { title: 'Ajanlar', sub: 'Aktivasyon ve insan eşlemesi', render: viewAjanlar, bind: bindAjanlar },
  kanitlar: { title: 'Kanıtlar', sub: 'Oturum artefaktları', render: viewKanitlar, bind: () => loadArtifacts() },
};

function currentTab() {
  const t = location.hash.replace('#', '');
  return ROUTES[t] ? t : 'genel';
}

function render() {
  const tab = currentTab();
  const route = ROUTES[tab];
  $('#title').textContent = route.title;
  $('#subtitle').textContent = route.sub;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  view.innerHTML = route.render();
  route.bind();
}

window.addEventListener('hashchange', render);

(async () => {
  try {
    await loadState();
  } catch (e) {
    view.innerHTML = `<div class="card"><h2>Sunucuya ulaşılamadı</h2><p class="sub">${esc(e.message)}</p>
      <p class="sub">Sunucu çalışıyor mu? <code>node onboarding/cli/tools/server.mjs</code></p></div>`;
    return;
  }
  render();
})();
