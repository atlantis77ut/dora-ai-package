// DORA AI Ajan Paketi — uygulama arayüzü (bağımlılıksız ES modülü)
// Roller: admin (teknik her şey) · user (iş arayüzü, teknik detay yok)

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

const state = {
  version: '—',
  user: null,
  role: null,
  needsBootstrap: false,
  settings: { institution: {}, integrations: [] },
  sessions: [],
  activeSession: null,
  counts: {},
  roles: [],
  phases: [],
};

const PHASE_LABELS = {
  C1: 'Hizmetlerin belirlenmesi',
  C2: 'Kesinti toleransları',
  C3: 'Kaynakların haritalanması',
  C4: 'Senaryo testleri',
  C5: 'Öz değerlendirme',
  C6: 'Canlıya geçiş',
};

const INT_LABELS = {
  siem: { title: 'Olay izleme sistemi', hint: 'Güvenlik olaylarını toplar (SIEM)', vendors: ['splunk', 'elastic', 'qradar', 'sentinel', 'wazuh'] },
  itsm: { title: 'Destek / talep sistemi', hint: 'Olay kayıtlarının açıldığı sistem (ITSM)', vendors: ['servicenow', 'jira', 'freshservice', 'topdesk'] },
  grc: { title: 'Uyum yönetimi', hint: 'Kontroller ve risk kayıtları (GRC)', vendors: ['archer', 'servicenow_grc', 'metricstream', 'logicmanager'] },
  cmdb: { title: 'Varlık envanteri', hint: 'Sunucu ve sistem listesi (CMDB)', vendors: ['servicenow_cmdb', 'device42', 'custom_api'] },
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
    headers: { 'Content-Type': 'application/json', 'X-Dora-CSRF': '1' },
    credentials: 'same-origin',
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* boş */
  }
  if (res.status === 401) {
    if (state.user) toast('Oturum sona erdi, yeniden giriş yapın', 'bad');
    state.user = null;
    state.role = null;
    renderLogin('login');
    throw new Error('giriş gerekli');
  }
  if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  return data;
}

/* ── giriş / ilk kurulum ──────────────────────────────── */

function renderLogin(mode = 'login') {
  const bootstrap = mode === 'bootstrap' || state.needsBootstrap;
  $('#title').textContent = bootstrap ? 'İlk kurulum' : 'Giriş';
  $('#subtitle').textContent = bootstrap ? 'Yönetici hesabını oluşturun' : 'Kurum hesabınızla giriş yapın';
  $('#sessionPill').textContent = 'giriş yapılmadı';
  $('#sessionPill').className = 'pill';
  $('#nav').innerHTML = '';
  view.innerHTML = `
    <div class="card" style="max-width:430px">
      <h2>${bootstrap ? 'Yönetici hesabı oluştur' : 'Giriş'}</h2>
      <p class="sub">${bootstrap
        ? 'Bu kurulumda henüz kullanıcı yok. İlk hesap yönetici olarak oluşturulur.'
        : 'Kullanıcı adı ve parolanızı girin.'}</p>
      ${bootstrap ? '<div class="row"><label>Ad soyad</label><input id="bName" placeholder="Ad Soyad"></div>' : ''}
      <div class="row"><label>Kullanıcı adı</label><input id="bUser" autocomplete="username" placeholder="admin"></div>
      <div class="row"><label>Parola</label><input id="bPass" type="password" autocomplete="${bootstrap ? 'new-password' : 'current-password'}" placeholder="en az 8 karakter"></div>
      <div class="actions">
        <button class="primary" id="bGo">${bootstrap ? 'Hesabı oluştur' : 'Giriş yap'}</button>
        <span class="sub" id="bErr"></span>
      </div>
    </div>`;
  const go = async () => {
    const btn = $('#bGo');
    btn.disabled = true;
    btn.textContent = 'bekleyin…';
    try {
      const payload = bootstrap
        ? { username: $('#bUser').value, password: $('#bPass').value, name: $('#bName')?.value }
        : { username: $('#bUser').value, password: $('#bPass').value };
      await api(bootstrap ? '/api/auth/bootstrap' : '/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      state.needsBootstrap = false;
      navKey = null;
      await loadState();
      if (!location.hash || location.hash === '#giris') location.hash = isAdmin() ? '#genel' : '#durum';
      render();
    } catch (e) {
      $('#bErr').textContent = e.message;
      btn.disabled = false;
      btn.textContent = bootstrap ? 'Hesabı oluştur' : 'Giriş yap';
    }
  };
  $('#bGo').addEventListener('click', go);
  view.querySelectorAll('input').forEach((i) =>
    i.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    }),
  );
}

/* ── durum yükleme ────────────────────────────────────── */

async function loadState() {
  const st = await fetch('/api/auth/status').then((r) => r.json());
  state.version = st.version;
  state.needsBootstrap = Boolean(st.needsBootstrap);
  $('#ver').textContent = 'v' + st.version;
  if (state.needsBootstrap) return;

  const me = await fetch('/api/auth/me');
  if (me.status === 401) {
    state.user = null;
    return;
  }
  const meBody = await me.json();
  state.user = meBody.user;
  state.role = state.user.role;
  state.exp = meBody.exp;
  state.sessionHours = meBody.session_hours;

  const s = await api('/api/state');
  state.settings = s.settings;
  state.sessions = s.sessions || [];
  state.activeSession = s.activeSession;
  state.counts = s.counts || {};

  const [roles, lifecycle] = await Promise.all([
    api('/api/catalog/roles').catch(() => ({ roles: [] })),
    api('/api/lifecycle').catch(() => ({ phases: [] })),
  ]);
  state.roles = roles.roles || [];
  state.phases = lifecycle.phases || [];
}

const isAdmin = () => state.role === 'admin';

/* ── ortak parçalar ───────────────────────────────────── */

const stat = (n, label, hint) =>
  `<div class="stat"><div class="l">${label}</div><div class="n">${n ?? '—'}</div><div class="h">${hint}</div></div>`;

const noSession = (msg) => `
  <div class="card">
    <h2>Henüz kurulum başlamadı</h2>
    <p class="sub">${esc(msg)}</p>
    <div class="actions"><button class="primary" id="newSession">Kurulumu başlat</button></div>
  </div>`;

async function createSession() {
  const tier = state.settings.institution?.tier || 'tier2';
  const regulator = state.settings.institution?.regulator || 'BDDK';
  const jurisdiction = state.settings.institution?.jurisdiction || 'TR';
  try {
    const r = await api('/api/sessions', { method: 'POST', body: JSON.stringify({ tier, regulator, jurisdiction }) });
    toast('Kurulum başlatıldı', 'ok');
    await loadState();
    render();
  } catch (e) {
    toast('Başlatılamadı: ' + e.message, 'bad');
  }
}

/* ── kullanıcı görünümleri (teknik detay yok) ─────────── */

function viewDurum() {
  const inst = state.settings.institution || {};
  const s = state.activeSession;
  const phases = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  const done = phases.filter((p) => s?.phases?.[p]?.status === 'completed').length;

  return `
    <div class="card">
      <h2>Hoş geldiniz${inst.name ? ', ' + esc(inst.name) : ''}</h2>
      <p class="sub">Kurulumunuzun neresinde olduğunuzu aşağıda görebilirsiniz.</p>
      <div class="grid k3">
        ${stat(done + ' / 6', 'Tamamlanan adım', done === 0 ? 'henüz başlanmadı' : done === 6 ? 'kurulum tamam' : 'devam ediyor')}
        ${stat(inst.tier ? inst.tier.replace('tier', 'Seviye ') : '—', 'Kurum seviyesi', inst.regulator ? 'otorite: ' + inst.regulator : 'otorite seçilmedi')}
        ${stat(state.settings.integrations.filter((i) => i.status !== 'not_configured').length + ' / 4', 'Bağlı sistem', 'olay, destek, uyum, envanter')}
      </div>
      <div class="actions">
        ${done === 0 ? '<button class="primary" data-action="newSession">Kurulumu başlat</button>' : ''}
        <a class="ghost" href="#kurum" style="padding:8px 14px">Kurum bilgileri</a>
        <a class="ghost" href="#baglantilar" style="padding:8px 14px">Sistem bağlantıları</a>
      </div>
    </div>

    <div class="card">
      <h2>Kurulum adımları</h2>
      <p class="sub">Her adım tamamlandığında bir sonrakine geçilir.</p>
      <div class="phases">
        ${phases
          .map((id, i) => {
            const st = s?.phases?.[id];
            const label = st?.status === 'completed' ? 'tamamlandı' : st?.status === 'blocked' ? 'bekliyor' : 'sırada';
            const cls = st?.status === 'completed' ? 'ok' : st?.status === 'blocked' ? 'warn' : '';
            return `<div class="phase"><div class="id">Adım ${i + 1}</div>
              <div class="nm">${PHASE_LABELS[id]}</div>
              <div class="st"><span class="pill ${cls}">${label}</span></div></div>`;
          })
          .join('')}
      </div>
    </div>`;
}

function viewKurum() {
  const i = state.settings.institution || {};
  return `
    <div class="card">
      <h2>Kurum bilgileri</h2>
      <p class="sub">Bu bilgiler kurulum ve raporlarda kullanılır.</p>
      <div class="row"><label>Kurum adı</label><input id="fName" value="${esc(i.name)}" placeholder="Örnek Bankası A.Ş."></div>
      <div class="row"><label>Kurum büyüklüğü</label>
        <select id="fTier">
          <option value="">seçilmedi</option>
          <option value="tier1" ${i.tier === 'tier1' ? 'selected' : ''}>Büyük / sistemik</option>
          <option value="tier2" ${i.tier === 'tier2' ? 'selected' : ''}>Orta ölçek</option>
          <option value="tier3" ${i.tier === 'tier3' ? 'selected' : ''}>Küçük / kamu</option>
        </select>
      </div>
      <div class="row"><label>Denetleyici kurum</label>
        <select id="fReg">
          <option value="">seçilmedi</option>
          ${['BDDK', 'TCMB', 'SEDDK', 'SPK', 'EBA', 'ESMA', 'EIOPA', 'FCA', 'BaFin'].map((r) => `<option value="${r}" ${i.regulator === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="row"><label>Faaliyet ülkesi</label>
        <select id="fJur">
          ${['TR', 'DE', 'FR', 'NL', 'IE', 'EU'].map((j) => `<option value="${j}" ${i.jurisdiction === j ? 'selected' : ''}>${j}</option>`).join('')}
        </select>
      </div>
      <div class="row"><label>Faaliyet alanları</label><input id="fLic" value="${esc((i.licenses || []).join(', '))}" placeholder="mevduat, sigorta, ödeme"></div>
      <div class="actions"><button class="primary" id="saveInst">Kaydet</button></div>
    </div>`;
}

function viewBaglantilar() {
  const list = state.settings.integrations || [];
  return `
    <div class="card">
      <h2>Sistem bağlantıları</h2>
      <p class="sub">Kurumunuzun kullandığı sistemleri bağlayın. Parola ve anahtarlar şifreli olarak saklanır, ekranda gösterilmez.</p>
      ${list
        .map((i) => {
          const meta = INT_LABELS[i.type] || { title: i.label ?? i.id, hint: '', vendors: [] };
          const ok = i.status === 'verified';
          return `
          <div class="int" data-id="${esc(i.id)}">
            <header><div><b>${esc(meta.title)}</b><div class="sub">${esc(meta.hint)}</div></div>
              ${ok ? '<span class="pill ok">bağlandı</span>' : i.status === 'error' ? '<span class="pill bad">bağlanamadı</span>' : i.status === 'configured' ? '<span class="pill warn">kaydedildi</span>' : '<span class="pill">kurulmadı</span>'}
            </header>
            <div class="grid k2">
              <div><label class="sub">Ürün</label><input class="iv" value="${esc(i.vendor)}" list="v-${esc(i.id)}" placeholder="ürün adı"><datalist id="v-${esc(i.id)}">${(meta.vendors || []).map((v) => `<option value="${v}">`).join('')}</datalist></div>
              <div><label class="sub">Bağlantı adresi</label><input class="ie" value="${esc(i.endpoint)}" placeholder="https://…"></div>
            </div>
            <div style="margin-top:10px"><label class="sub">Erişim anahtarı ${i.has_token ? '<span class="pill ok">kayıtlı</span>' : ''}</label><input class="it" type="password" placeholder="${i.has_token ? 'değiştirmek için yeni değer' : 'anahtar / parola'}"></div>
            <div class="actions">
              <button class="primary isave">Kaydet</button>
              <button class="ghost-btn itest" ${i.endpoint ? '' : 'disabled'}>Bağlantıyı dene</button>
              ${i.last_test ? `<span class="sub">son deneme: ${new Date(i.last_test.at).toLocaleString('tr-TR')}</span>` : ''}
            </div>
          </div>`;
        })
        .join('')}
    </div>`;
}

function viewVarliklar() {
  const s = state.activeSession;
  if (!s) return noSession('Varlık listesini girmek için kurulumu başlatın.');
  return `
    <div class="card">
      <h2>Varlıklarım</h2>
      <p class="sub">Sunucu ve sistemlerinizi satır satır girin: <b>ad, kritiklik, tedarikçi</b></p>
      <div class="actions" style="margin-bottom:10px">
        <input type="file" id="csvFile" accept=".csv,text/csv" style="max-width:320px">
        <a class="ghost" href="/api/templates/inventory.csv" style="padding:8px 14px">Şablon indir</a>
      </div>
      <textarea id="csv" placeholder="Core Banking, kritik, Vendor X
API Gateway, önemli, Vendor Y
Raporlama, standart, iç ekip"></textarea>
      <div class="actions">
        <button class="primary" id="importInv">Listeyi kaydet</button>
        <button class="ghost-btn" id="loadInv">Kayıtlı listeyi göster</button>
      </div>
      <div id="invResult"></div>
    </div>`;
}

function viewSorumlular() {
  const s = state.activeSession;
  if (!s) return noSession('Sorumlu atamak için kurulumu başlatın.');
  const friendly = {
    'ROL-INС-01': '', // güvenlik ağı
  };
  return `
    <div class="card">
      <h2>Sorumlular</h2>
      <p class="sub">Her görev için kurumunuzda kimin sorumlu olacağını yazın.</p>
      <table>
        <thead><tr><th></th><th>Görev</th><th>Sorumlu kişi</th></tr></thead>
        <tbody>
          ${state.roles
            .map(
              (r) => `<tr>
                <td><input type="checkbox" class="ag" data-id="${esc(r.id)}" ${['ROL-INC-01', 'ROL-CIO-01', 'ROL-RSK-01', 'ROL-CMP-01'].includes(r.id) ? 'checked' : ''}></td>
                <td>${esc(r.name?.tr ?? r.id)}</td>
                <td><input class="hm" data-id="${esc(r.id)}" placeholder="ad soyad"></td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
      <div class="actions">
        <button class="primary" id="saveAgents">Kaydet</button>
        <button class="ghost-btn" id="loadAgents">Kayıtlı atamaları göster</button>
      </div>
      <div id="agentResult"></div>
    </div>`;
}

function viewBelgeler() {
  const s = state.activeSession;
  if (!s) return noSession('Belgeler kurulum başladığında oluşur.');
  return `
    <div class="card">
      <h2>Belgeler</h2>
      <p class="sub">Kurulum sırasında üretilen kayıtlar. İndirip denetim dosyanıza ekleyebilirsiniz.</p>
      <div class="actions">
        <button class="primary" id="expBuild2">Kanıt paketi oluştur</button>
        <a class="ghost" id="expDownload2" style="display:none;padding:8px 14px" href="#">Kanıt paketini indir</a>
      </div>
      <table>
        <thead><tr><th>Belge</th><th class="num">Boyut</th><th>Tarih</th><th></th></tr></thead>
        <tbody id="artBody"><tr><td colspan="4" class="sub">Yükleniyor…</td></tr></tbody>
      </table>
    </div>`;
}

/* ── yönetici görünümleri ─────────────────────────────── */

function viewGenel() {
  const inst = state.settings.institution || {};
  const counts = state.counts;
  const session = state.activeSession;
  const phases = state.phases.length ? state.phases : ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((id) => ({ id, name: { tr: PHASE_LABELS[id] } }));
  return `
    <div class="grid k4">
      ${stat(counts.processes, 'Süreç', '5 sütun')}
      ${stat(counts.controls, 'Kontrol', 'kanıt şartnameli')}
      ${stat(counts.roles, 'Ajan', 'üç savunma hattı')}
      ${stat(counts.terms, 'Terim', 'DORA sözlüğü')}
    </div>
    <div class="card">
      <h2>Kurum</h2>
      <p class="sub">${inst.name ? esc(inst.name) : 'Kurum adı girilmedi'} · ${esc(inst.tier || 'tier yok')} · ${esc(inst.regulator || 'regülatör yok')} · ${esc(inst.jurisdiction || 'TR')}</p>
      <div class="actions">
        <a class="ghost" href="#kurum" style="padding:8px 14px">Kurum profili</a>
        <a class="ghost" href="/dashboard/" style="padding:8px 14px">Teknik panel</a>
      </div>
    </div>
    <div class="card">
      <h2>Kurulum fazları</h2>
      <p class="sub">${session ? 'Aktif oturum: ' + esc(session.session_id) : 'Oturum yok'}</p>
      <div class="phases">
        ${phases
          .map((p) => {
            const st = session?.phases?.[p.id];
            const label = st?.status === 'completed' ? 'tamamlandı' : st?.status === 'blocked' ? 'kapı kapalı' : 'başlanmadı';
            return `<div class="phase"><div class="id">${esc(p.id)}</div><div class="nm">${esc(p.name?.tr ?? '')}</div>
              <div class="st"><span class="pill ${st?.status === 'completed' ? 'ok' : st?.status === 'blocked' ? 'bad' : ''}">${label}</span></div></div>`;
          })
          .join('')}
      </div>
      <div class="actions">${session ? '<button class="ghost-btn" id="newSession">Yeni oturum</button>' : '<button class="primary" id="newSession">Oturum oluştur</button>'}</div>
    </div>
    <div class="card">
      <h2>Oturumlar</h2>
      <table><thead><tr><th>Oturum</th><th>Tier</th><th>Regülatör</th><th>Faz</th><th class="num">Artefakt</th><th>Oluşturma</th></tr></thead>
      <tbody>${state.sessions.length
        ? state.sessions
            .map(
              (s) => `<tr><td class="mono">${esc(s.session_id)}</td><td>${esc(s.tier ?? '—')}</td><td>${esc(s.regulator ?? '—')}</td>
              <td>${esc(s.current_phase ?? '—')}</td><td class="num">${s.artifacts ?? 0}</td>
              <td>${s.created_at ? new Date(s.created_at).toLocaleString('tr-TR') : '—'}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="6" class="sub">Oturum yok.</td></tr>'}</tbody></table>
      ${
        state.sessions.length > 1
          ? `<div class="actions"><label class="sub">Aktif oturum</label>
             <select id="activeSess">${state.sessions
               .map((s) => `<option value="${esc(s.session_id)}" ${s.session_id === state.activeSession?.session_id ? 'selected' : ''}>${esc(s.session_id)}</option>`)
               .join('')}</select></div>`
          : ''
      }
    </div>`;
}

function viewYonetim() {
  return `
    <div class="card">
      <h2>Kullanıcılar</h2>
      <p class="sub">Yöneticiler teknik paneli ve ayarları görür; kullanıcılar yalnız iş arayüzünü görür.</p>
      <table><thead><tr><th>Kullanıcı</th><th>Ad</th><th>Rol</th><th>Son giriş</th><th></th></tr></thead>
      <tbody id="userBody"><tr><td colspan="5" class="sub">Yükleniyor…</td></tr></tbody></table>
      <h2 style="margin-top:22px">Yeni kullanıcı</h2>
      <div class="grid k4">
        <div><label class="sub">Kullanıcı adı</label><input id="uName" placeholder="kullanici"></div>
        <div><label class="sub">Ad soyad</label><input id="uFull" placeholder="Ad Soyad"></div>
        <div><label class="sub">Parola</label><input id="uPass" type="password" placeholder="en az 8"></div>
        <div><label class="sub">Rol</label><select id="uRole"><option value="user">Kullanıcı</option><option value="admin">Yönetici</option></select></div>
      </div>
      <div class="actions"><button class="primary" id="uAdd">Kullanıcı ekle</button></div>
    </div>
    <div class="card">
      <h2>Oturum süresi</h2>
      <p class="sub">Giriş yaptıktan sonra oturumun kaç saat açık kalacağı (1-168).</p>
      <div class="grid k3">
        <div><label class="sub">Saat</label><input id="sHours" type="number" min="1" max="168" value="${esc(state.settings.session_hours ?? 8)}"></div>
        <div style="display:flex;align-items:flex-end"><button class="primary" id="sSave">Kaydet</button></div>
      </div>
    </div>
    <div class="card">
      <h2>İşlem kaydı</h2>
      <p class="sub">Son 150 işlem (giriş, kayıt, kullanıcı değişikliği).</p>
      <div id="auditBody" class="sub">Yükleniyor…</div>
    </div>`;
}

/* ── davranışlar ──────────────────────────────────────── */

function bindCommon() {
  $('#activeSess')?.addEventListener('change', async (e) => {
    try {
      await api('/api/sessions/active', { method: 'POST', body: JSON.stringify({ session_id: e.target.value }) });
      toast('Aktif oturum değiştirildi', 'ok');
      await loadState();
      render();
    } catch (err) {
      toast('Değiştirilemedi: ' + err.message, 'bad');
    }
  });
  /* yeni oturum düğmesi: #newSession ve [data-action=newSession] */
  document.querySelectorAll('#newSession, [data-action="newSession"]').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', createSession);
  });
}

// Tüm sayfalarda geçerli: "kurulumu başlat" düğmesi
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action="newSession"], #newSession');
  if (b) {
    e.preventDefault();
    createSession();
  }
});

function bindKurum() {
  $('#saveInst')?.addEventListener('click', async () => {
    try {
      const payload = {
        name: $('#fName').value.trim(),
        tier: $('#fTier').value,
        regulator: $('#fReg').value,
        jurisdiction: $('#fJur').value,
        licenses: $('#fLic').value.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await api('/api/institution', { method: 'PUT', body: JSON.stringify(payload) });
      toast('Kaydedildi', 'ok');
      await loadState();
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });
}

function bindBaglantilar() {
  document.querySelectorAll('.int').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.isave')?.addEventListener('click', async () => {
      try {
        await api('/api/integrations/' + id, {
          method: 'PUT',
          body: JSON.stringify({
            vendor: card.querySelector('.iv').value.trim(),
            endpoint: card.querySelector('.ie').value.trim(),
            auth_type: 'token',
            token: card.querySelector('.it').value.trim() || undefined,
          }),
        });
        toast('Bağlantı kaydedildi', 'ok');
        await loadState();
        render();
      } catch (e) {
        toast('Kaydedilemedi: ' + e.message, 'bad');
      }
    });
    card.querySelector('.itest')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.textContent = 'deneniyor…';
      try {
        const r = await api('/api/integrations/' + id + '/test', { method: 'POST', body: '{}' });
        toast('Bağlantı başarılı: ' + r.detail, 'ok');
      } catch (e) {
        toast('Bağlantı kurulamadı: ' + e.message, 'bad');
      }
      await loadState();
      render();
    });
  });
}

function bindVarliklar() {
  const fileInput = $('#csvFile');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const text = await file.text();
      $('#csv').value = text.trim();
      try {
        const r = await api(`/api/sessions/${state.activeSession.session_id}/inventory/csv`, {
          method: 'POST',
          body: JSON.stringify({ csv: text }),
        });
        toast(`${r.count} varlık dosyadan yüklendi`, 'ok');
        renderInvTable(r);
      } catch (e) {
        toast('Dosya yüklenemedi: ' + e.message, 'bad');
      }
    });
  }

  const parseCsv = (raw) =>
    raw
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l, i) => {
        const [name, criticality, provider] = l.split(',').map((x) => (x ?? '').trim());
        const map = { kritik: 'critical', 'önemli': 'important', önemli: 'important', standart: 'standard' };
        return { id: `AST-${String(i + 1).padStart(3, '0')}`, name: name || '—', criticality: map[(criticality || '').toLowerCase()] || 'standard', provider: provider || '' };
      });

  $('#importInv')?.addEventListener('click', async () => {
    const assets = parseCsv($('#csv').value.trim());
    if (!assets.length) return toast('Liste boş', 'bad');
    try {
      const r = await api(`/api/sessions/${state.activeSession.session_id}/inventory`, { method: 'POST', body: JSON.stringify({ assets }) });
      toast(`${r.count} varlık kaydedildi`, 'ok');
      renderInvTable(r);
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });
  $('#loadInv')?.addEventListener('click', loadInv);
}

async function loadInv() {
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/ict-inventory.json`);
    renderInvTable(r.value);
  } catch {
    toast('Kayıtlı liste yok', 'bad');
  }
}

function renderInvTable(payload) {
  const assets = payload.assets || payload || [];
  const box = $('#invResult');
  if (!box) return;
  const label = { critical: 'kritik', important: 'önemli', standard: 'standart' };
  box.innerHTML = `<table style="margin-top:14px"><thead><tr><th>Ad</th><th>Kritiklik</th><th>Tedarikçi</th></tr></thead><tbody>
    ${assets.map((a) => `<tr><td>${esc(a.name)}</td><td><span class="pill ${a.criticality === 'critical' ? 'bad' : a.criticality === 'important' ? 'warn' : ''}">${label[a.criticality] ?? esc(a.criticality)}</span></td><td>${esc(a.provider ?? '')}</td></tr>`).join('')}
  </tbody></table>`;
}

function bindSorumlular() {
  $('#saveAgents')?.addEventListener('click', async () => {
    const activated = [...document.querySelectorAll('.ag:checked')].map((c) => c.dataset.id);
    const human_mapping = {};
    document.querySelectorAll('.hm').forEach((i) => {
      if (i.value.trim()) human_mapping[i.dataset.id] = i.value.trim();
    });
    if (!activated.length) return toast('En az bir görev seçin', 'bad');
    try {
      const r = await api(`/api/sessions/${state.activeSession.session_id}/agents`, { method: 'POST', body: JSON.stringify({ activated, human_mapping }) });
      toast('Atamalar kaydedildi', 'ok');
      const box = $('#agentResult');
      if (box) box.innerHTML = `<div class="actions">${r.independence_checks.map((c) => `<span class="pill ok">${esc(c.check)} uygun</span>`).join('')}</div>`;
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });
  $('#loadAgents')?.addEventListener('click', loadAgents);
}

async function loadAgents() {
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/agent-activation.json`);
    document.querySelectorAll('.ag').forEach((c) => (c.checked = (r.value.activated || []).includes(c.dataset.id)));
    document.querySelectorAll('.hm').forEach((i) => (i.value = r.value.human_mapping?.[i.dataset.id] ?? ''));
    toast('Kayıtlı atamalar yüklendi', 'ok');
  } catch {
    toast('Kayıt yok', 'bad');
  }
}

const ART_LABELS = {
  'institution-profile.json': 'Kurum profili',
  'jurisdiction.json': 'Denetleyici bilgisi',
  'business-service-catalogue.json': 'Hizmet listesi',
  'impact-tolerances.json': 'Kesinti toleransları',
  'risk-appetite.json': 'Risk eşikleri',
  'sla-overrides.json': 'Bildirim süreleri',
  'ict-inventory.json': 'Varlık listesi',
  'agent-activation.json': 'Sorumlu atamaları',
  'orl-mapping.json': 'Görev eşlemesi',
  'coverage-matrix.json': 'Kapsam tablosu',
  'gap-analysis.json': 'Eksik analizi',
  'autonomy-grant.json': 'Yetki tanımları',
  'go-live.json': 'Canlıya geçiş kaydı',
  'session.json': 'Oturum',
};

function bindBelgeExport() {
  const sid = state.activeSession?.session_id;
  if (!sid) return;
  const btn = $('#expBuild2');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      const r = await api(`/api/sessions/${sid}/export`, { method: 'POST', body: '{}' });
      const dl = $('#expDownload2');
      dl.href = r.download;
      dl.style.display = 'inline-block';
      toast(`Kanıt paketi hazır: ${r.files} dosya`, 'ok');
    } catch (e) {
      toast('Oluşturulamadı: ' + e.message, 'bad');
    }
  });
  if ($('#expDownload2')) $('#expDownload2').addEventListener('click', () => {});
}

async function loadArtifacts() {
  const body = $('#artBody');
  if (!body) return;
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}`);
    const arts = (r.artifacts || []).filter((a) => a.name !== 'session.json');
    body.innerHTML = arts.length
      ? arts
          .map(
            (a) => `<tr><td>${esc(ART_LABELS[a.name] ?? a.name)}</td><td class="num">${(a.size / 1024).toFixed(1)} KB</td>
            <td>${new Date(a.modified).toLocaleDateString('tr-TR')}</td>
            <td><button class="ghost-btn art-open" data-name="${esc(a.name)}">indir</button></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="4" class="sub">Henüz belge yok.</td></tr>';
    document.querySelectorAll('.art-open').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          const r2 = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/${b.dataset.name}`);
          const blob = new Blob([JSON.stringify(r2.value, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = b.dataset.name;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          toast('İndirilemedi: ' + e.message, 'bad');
        }
      }),
    );
  } catch (e) {
    body.innerHTML = `<tr><td colspan="4" class="sub">${esc(e.message)}</td></tr>`;
  }
}

function bindYonetim() {
  loadUsers();
  loadAudit();
  $('#sSave')?.addEventListener('click', async () => {
    try {
      const r = await api('/api/settings/session', { method: 'PUT', body: JSON.stringify({ session_hours: Number($('#sHours').value) }) });
      toast('Oturum süresi ' + r.session_hours + ' saat olarak kaydedildi', 'ok');
      state.settings.session_hours = r.session_hours;
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });
  $('#uAdd')?.addEventListener('click', async () => {
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ username: $('#uName').value, name: $('#uFull').value, password: $('#uPass').value, role: $('#uRole').value }),
      });
      toast('Kullanıcı eklendi', 'ok');
      $('#uName').value = $('#uFull').value = $('#uPass').value = '';
      loadUsers();
      loadAudit();
    } catch (e) {
      toast('Eklenemedi: ' + e.message, 'bad');
    }
  });
}

async function loadUsers() {
  try {
    const r = await api('/api/users');
    const body = $('#userBody');
    if (!body) return;
    body.innerHTML = r.users
      .map(
        (u) => `<tr><td class="mono">${esc(u.username)}</td><td>${esc(u.name ?? '')}</td>
        <td><span class="pill ${u.role === 'admin' ? 'warn' : ''}">${u.role === 'admin' ? 'yönetici' : 'kullanıcı'}</span></td>
        <td>${u.last_login ? new Date(u.last_login).toLocaleString('tr-TR') : '—'}</td>
        <td>${u.username === state.user.username
          ? '<span class="sub">siz</span>'
          : `<button class="ghost-btn u-pw" data-id="${esc(u.id)}" data-name="${esc(u.username)}">parola sıfırla</button>
             <button class="ghost-btn u-del" data-id="${esc(u.id)}">sil</button>`}</td></tr>`,
      )
      .join('');
    document.querySelectorAll('.u-pw').forEach((b) =>
      b.addEventListener('click', async () => {
        const yeni = prompt(`${b.dataset.name} için yeni parola (en az 8 karakter):`);
        if (!yeni) return;
        try {
          await api('/api/users/' + b.dataset.id, { method: 'PATCH', body: JSON.stringify({ password: yeni }) });
          toast('Parola sıfırlandı', 'ok');
          loadAudit();
        } catch (e) {
          toast('Sıfırlanamadı: ' + e.message, 'bad');
        }
      }),
    );
    document.querySelectorAll('.u-del').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api('/api/users/' + b.dataset.id, { method: 'DELETE' });
          toast('Kullanıcı silindi', 'ok');
          loadUsers();
          loadAudit();
        } catch (e) {
          toast('Silinemedi: ' + e.message, 'bad');
        }
      }),
    );
  } catch (e) {
    toast(e.message, 'bad');
  }
}

async function loadAudit() {
  try {
    const r = await api('/api/audit');
    const box = $('#auditBody');
    if (!box) return;
    box.innerHTML = r.entries.length
      ? `<table><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Hedef</th></tr></thead><tbody>
        ${r.entries.map((e) => `<tr><td>${new Date(e.at).toLocaleString('tr-TR')}</td><td>${esc(e.user)}</td><td>${esc(e.action)}</td><td class="mono">${esc(e.target ?? '')}</td></tr>`).join('')}
      </tbody></table>`
      : '<span class="sub">Kayıt yok.</span>';
  } catch {
    /* yönetici değilse */
  }
}


function viewKurulum() {
  const s = state.activeSession;
  if (!s) return noSession('Kuruluma başlamak için bir oturum gerekir.');
  const step = (s.current_phase || 'C1').replace('C', '');
  return `
    <div class="card">
      <h2>Kurulum sihirbazı</h2>
      <p class="sub">Sıradaki adım: <b>${esc(s.current_phase || 'C1')}</b> · ${esc(PHASE_LABELS[s.current_phase] || '')}</p>
      <div class="actions">
        <button class="ghost-btn" data-gate="C1">1. adımı denetle</button>
        <button class="ghost-btn" data-gate="C2">2. adımı denetle</button>
        <button class="ghost-btn" data-gate="C3">3. adımı denetle</button>
        <button class="ghost-btn" data-gate="C4">4. adımı denetle</button>
        <button class="ghost-btn" data-gate="C5">5. adımı denetle</button>
        <button class="ghost-btn" data-gate="C6">6. adımı denetle</button>
      </div>
      <div id="gateResult" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <h2>Adım 1 · Hizmetleriniz</h2>
      <p class="sub">Kritik hizmetlerinizi ve sahiplerini girin. En az bir hizmet gerekir.</p>
      <table id="svcTable">
        <thead><tr><th>Hizmet adı</th><th>Sahibi</th><th>Kritik mi</th><th></th></tr></thead>
        <tbody>
          <tr><td><input class="svc-name" placeholder="Ödeme hizmetleri"></td><td><input class="svc-owner" placeholder="Ödeme Direktörü"></td>
            <td><input type="checkbox" class="svc-crit" checked></td><td><button class="ghost-btn svc-del">sil</button></td></tr>
          <tr><td><input class="svc-name" placeholder="Mevduat işlemleri"></td><td><input class="svc-owner" placeholder="Bireysel Bankacılık"></td>
            <td><input type="checkbox" class="svc-crit" checked></td><td><button class="ghost-btn svc-del">sil</button></td></tr>
        </tbody>
      </table>
      <div class="actions">
        <button class="ghost-btn" id="svcAdd">+ satır ekle</button>
        <button class="primary" id="svcSave">Hizmetleri kaydet</button>
      </div>
      <div id="svcResult"></div>
    </div>

    <div class="card">
      <h2>Adım 2 · Kesinti toleransları</h2>
      <p class="sub">Her hizmet için kabul edilebilir kesinti süreleri (saat).</p>
      <div id="tolRows"></div>
      <div class="actions">
        <button class="ghost-btn" id="tolLoad">Hizmetleri getir</button>
        <button class="primary" id="tolSave">Toleransları kaydet</button>
      </div>
      <div class="row" style="margin-top:14px"><label>Yıllık kesinti sınırı (dakika)</label><input id="tolRisk" type="number" value="240"></div>
      <div id="tolResult"></div>
    </div>

    <div class="card">
      <h2>Adım 3 · Varlık ve sorumlu eşlemesi</h2>
      <p class="sub">Envanter ve sorumlular tamamsa görev eşlemesini oluşturun.</p>
      <div id="step3Info" class="sub">yükleniyor…</div>
      <div class="actions">
        <button class="primary" id="mapBuild">Görev eşlemesini oluştur</button>
        <a class="ghost" href="#envanter" style="padding:8px 14px">Envanter</a>
        <a class="ghost" href="#ajanlar" style="padding:8px 14px">Sorumlular</a>
      </div>
      <div id="mapResult"></div>
    </div>

    <div class="card">
      <h2>Adım 4 · Senaryo testleri</h2>
      <p class="sub">Her senaryo için ölçüm sonucunu girin. Üç senaryo tamamlanınca adım kapanır.</p>
      <table id="scnTable">
        <thead><tr><th>Senaryo</th><th>Doğruluk %</th><th>SLA ihlali</th><th>Hash zinciri</th></tr></thead>
        <tbody>
          <tr><td>Büyük olay</td><td><input class="scn-acc" type="number" min="0" max="100" value="100"></td><td><input class="scn-sla" type="number" min="0" value="0"></td><td><input type="checkbox" class="scn-chain" checked></td></tr>
          <tr><td>Tedarikçi çıkışı</td><td><input class="scn-acc" type="number" min="0" max="100" value="100"></td><td><input class="scn-sla" type="number" min="0" value="0"></td><td><input type="checkbox" class="scn-chain" checked></td></tr>
          <tr><td>Regülatör talebi</td><td><input class="scn-acc" type="number" min="0" max="100" value="100"></td><td><input class="scn-sla" type="number" min="0" value="0"></td><td><input type="checkbox" class="scn-chain" checked></td></tr>
        </tbody>
      </table>
      <div class="actions"><button class="primary" id="scnSave">Sonuçları kaydet</button></div>
      <div id="scnResult"></div>
    </div>

    <div class="card">
      <h2>Adım 5 · Öz değerlendirme</h2>
      <p class="sub">Her DORA maddesi için kapsama durumunu işaretleyin, bağımsız doğrulayanı yazın.</p>
      <div id="artList" class="sub">yükleniyor…</div>
      <div class="row" style="margin-top:12px"><label>Bağımsız doğrulayan</label><input id="revName" placeholder="ad soyad"></div>
      <div class="row"><label>Kabul edilen riskler</label><input id="riskAcc" placeholder="virgülle ayırın (boş bırakılabilir)"></div>
      <div class="actions"><button class="primary" id="asmSave">Değerlendirmeyi kaydet</button></div>
      <div id="asmResult"></div>
    </div>

    <div class="card">
      <h2>Adım 6 · Canlıya geçiş</h2>
      <p class="sub">Ajan otonomi seviyeleri ve geçiş ölçütleri. Üretim için ticari lisans gerekir.</p>
      <div id="autoList" class="sub">yükleniyor…</div>
      <div class="grid k3" style="margin-top:14px">
        <div><label class="sub">Gölge mod (gün)</label><input id="shadowDays" type="number" min="0" value="14"></div>
        <div><label class="sub">Yarı-otomatik (gün)</label><input id="semiDays" type="number" min="0" value="30"></div>
        <div><label class="sub">Yıllık gözden geçirme</label><input id="reviewDate" type="date"></div>
      </div>
      <div class="actions">
        <label class="sub"><input type="checkbox" id="mosChk" style="width:auto"> MOS panosu hazır</label>
        <label class="sub"><input type="checkbox" id="regChk" style="width:auto"> Düzenleme izleme ajanı aktif</label>
        <button class="primary" id="liveSave">Geçiş kaydını kaydet</button>
      </div>
      <div id="liveResult"></div>
      <h2 style="margin-top:18px">Lisans</h2>
      <p class="sub">Ticari lisans anahtarını yapıştırın (DORA-LIC-v1…). Deneme modunda 6. adım kapanmaz.</p>
      <textarea id="licToken" placeholder="DORA-LIC-v1.…" style="min-height:80px"></textarea>
      <div class="actions"><button class="ghost-btn" id="licSave">Lisansı etkinleştir</button></div>
      <div id="licResult"></div>
    </div>

    <div class="card">
      <h2>Kanıt paketi</h2>
      <p class="sub">Altı adımın tüm kayıtlarını tek zip dosyasında toplar; her dosyanın sha256 özeti ve
        hash zinciri manifestte yer alır, paket kurumun kanıt anahtarıyla imzalanır.</p>
      <div class="actions">
        <button class="primary" id="expBuild">Paketi oluştur</button>
        <a class="ghost" id="expDownload" style="display:none;padding:8px 14px" href="#">İndir</a>
      </div>
      <div id="expResult"></div>
    </div>`;
}

function bindKurulum() {
  const sid = state.activeSession?.session_id;
  const rowHtml = (name = '', owner = '', crit = true) => `
    <tr><td><input class="svc-name" value="${esc(name)}" placeholder="Hizmet adı"></td>
    <td><input class="svc-owner" value="${esc(owner)}" placeholder="Sahibi"></td>
    <td><input type="checkbox" class="svc-crit" ${crit ? 'checked' : ''}></td>
    <td><button class="ghost-btn svc-del">sil</button></td></tr>`;

  $('#svcAdd')?.addEventListener('click', () => {
    $('#svcTable tbody').insertAdjacentHTML('beforeend', rowHtml());
    document.querySelectorAll('.svc-del').forEach((b) => (b.onclick = () => b.closest('tr').remove()));
  });
  document.querySelectorAll('.svc-del').forEach((b) => (b.onclick = () => b.closest('tr').remove()));

  $('#svcSave')?.addEventListener('click', async () => {
    const services = [...document.querySelectorAll('#svcTable tbody tr')]
      .map((tr) => ({
        name: tr.querySelector('.svc-name').value.trim(),
        owner: tr.querySelector('.svc-owner').value.trim(),
        critical: tr.querySelector('.svc-crit').checked,
      }))
      .filter((s) => s.name);
    if (!services.length) return toast('En az bir hizmet adı girin', 'bad');
    try {
      const r = await api(`/api/sessions/${sid}/services`, { method: 'POST', body: JSON.stringify({ services }) });
      toast(`${r.count} hizmet kaydedildi`, 'ok');
      $('#svcResult').innerHTML = `<div class="sub" style="margin-top:10px">Kaydedildi: ${r.count} hizmet</div>`;
      loadTolerances();
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });

  $('#tolLoad')?.addEventListener('click', loadTolerances);
  $('#tolSave')?.addEventListener('click', async () => {
    const rows = [...document.querySelectorAll('.tol-row')].map((tr) => ({
      service: tr.dataset.service,
      mtd_hours: Number(tr.querySelector('.tol-mtd').value) || 0,
      rto_hours: Number(tr.querySelector('.tol-rto').value) || 0,
      rpo_hours: Number(tr.querySelector('.tol-rpo').value) || 0,
    }));
    if (!rows.length) return toast('Önce hizmetleri yükleyin', 'bad');
    try {
      await api(`/api/sessions/${sid}/tolerances`, {
        method: 'POST',
        body: JSON.stringify({
          tolerances: rows,
          thresholds: [{ metric: 'yillik_kesinti_dk', max: Number($('#tolRisk')?.value) || 240 }],
        }),
      });
      toast('Toleranslar kaydedildi', 'ok');
      await loadState();
      render();
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });

  document.querySelectorAll('[data-gate]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await api(`/api/sessions/${sid}/gate/${b.dataset.gate}`, { method: 'POST', body: '{}' });
        showGate(b.dataset.gate, r.results, true);
      } catch (e) {
        // 422 gövdesinde sonuçlar var
        const msg = String(e.message || '');
        toast('Kapı geçilmedi', 'bad');
        try {
          const raw = await fetch(`/api/sessions/${sid}/gate/${b.dataset.gate}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          const body = await raw.json();
          showGate(b.dataset.gate, body.results ?? [], Boolean(body.ok));
        } catch {
          showGate(b.dataset.gate, [{ id: '-', passed: false, detail: msg }], false);
        }
      } finally {
        b.disabled = false;
      }
    }),
  );
  loadTolerances();
  loadStep3();
  loadArticles();
  loadAutonomy();
  loadStep6Values();
  bindKurulumSteps(sid);
}

function showGate(phase, results, ok) {
  const box = $('#gateResult');
  if (!box) return;
  box.innerHTML = `<div class="card" style="background:#0f1626">
    <h2>${esc(PHASE_LABELS[phase] || phase)} · ${ok ? '<span class="ok">geçti</span>' : '<span class="bad">eksik var</span>'}</h2>
    <table><tbody>
      ${(results || [])
        .map(
          (r) => `<tr><td style="width:30px">${r.passed ? '<span class="ok">✔</span>' : '<span class="bad">✘</span>'}</td>
          <td>${esc(r.detail)}</td>${isAdmin() ? `<td class="mono" style="width:70px">${esc(r.id)}</td>` : ''}</tr>`,
        )
        .join('')}
    </tbody></table>
  </div>`;
}


const SCENARIO_NAMES = ['Büyük olay', 'Tedarikçi çıkışı', 'Regülatör talebi'];
const AUTONOMY_LABELS = {
  observe: 'Yalnız izler',
  recommend: 'Önerir',
  act_with_approval: 'Onayla uygular',
  act_autonomous: 'Otonom',
};

async function loadStep3() {
  const sid = state.activeSession?.session_id;
  if (!sid) return;
  let inv = 0, agents = 0;
  try {
    const a = await api(`/api/sessions/${sid}/artifacts/ict-inventory.json`);
    inv = (a.value.assets ?? []).length;
  } catch { /* yok */ }
  try {
    const b = await api(`/api/sessions/${sid}/artifacts/agent-activation.json`);
    agents = (b.value.activated ?? []).length;
  } catch { /* yok */ }
  const box = $('#step3Info');
  if (box) box.innerHTML = `Envanterde <b>${inv}</b> varlık · <b>${agents}</b> sorumlu ajan tanımlı`;
}

async function loadArticles() {
  const box = $('#artList');
  if (!box) return;
  try {
    const r = await api('/api/catalog/articles');
    const sid = state.activeSession?.session_id;
    let existing = {};
    try {
      const c = await api(`/api/sessions/${sid}/artifacts/coverage-matrix.json`);
      existing = Object.fromEntries((c.value.articles ?? []).map((a) => [a.id, a.status]));
    } catch { /* yok */ }
    box.innerHTML = `<table><thead><tr><th>Madde</th><th>Başlık</th><th>Durum</th></tr></thead><tbody>
      ${r.articles
        .map(
          (a) => `<tr><td class="mono">${esc(a.id)}</td><td>${esc(a.title)}</td>
          <td><select class="art-status" data-id="${esc(a.id)}">
            ${['covered', 'partial', 'gap']
              .map((s) => `<option value="${s}" ${(existing[a.id] ?? a.status) === s ? 'selected' : ''}>${{ covered: 'kapsandı', partial: 'kısmi', gap: 'boşluk' }[s]}</option>`)
              .join('')}
          </select></td></tr>`,
        )
        .join('')}
    </tbody></table>`;
  } catch (e) {
    box.textContent = 'Maddeler yüklenemedi: ' + e.message;
  }
}

function loadAutonomy() {
  const box = $('#autoList');
  if (!box) return;
  box.innerHTML = `<table><thead><tr><th>Görev</th><th>Otonomi seviyesi</th></tr></thead><tbody>
    ${state.roles
      .map(
        (r) => `<tr><td>${esc(r.name?.tr ?? r.id)}</td>
        <td><select class="auto-level" data-id="${esc(r.id)}">
          ${Object.entries(AUTONOMY_LABELS)
            .map(([v, l]) => `<option value="${v}" ${v === 'recommend' ? 'selected' : ''}>${l}</option>`)
            .join('')}
        </select></td></tr>`,
      )
      .join('')}
  </tbody></table>`;
}

async function loadStep6Values() {
  const sid = state.activeSession?.session_id;
  if (!sid) return;
  try {
    const g = await api(`/api/sessions/${sid}/artifacts/go-live.json`);
    if ($('#shadowDays')) $('#shadowDays').value = g.value.shadow_days ?? 14;
    if ($('#semiDays')) $('#semiDays').value = g.value.semi_auto_days ?? 30;
    if ($('#reviewDate')) $('#reviewDate').value = g.value.annual_review_date ?? '';
    if ($('#mosChk')) $('#mosChk').checked = Boolean(g.value.mos_dashboard);
    if ($('#regChk')) $('#regChk').checked = Boolean(g.value.regwatch_agent);
  } catch { /* yok */ }
  try {
    const a = await api(`/api/sessions/${sid}/artifacts/autonomy-grant.json`);
    const map = Object.fromEntries((a.value.grants ?? []).map((g) => [g.role, g.level]));
    document.querySelectorAll('.auto-level').forEach((sel) => {
      if (map[sel.dataset.id]) sel.value = map[sel.dataset.id];
    });
  } catch { /* yok */ }
}

function bindKurulumSteps(sid) {
  $('#mapBuild')?.addEventListener('click', async () => {
    try {
      const r = await api(`/api/sessions/${sid}/mapping`, { method: 'POST', body: '{}' });
      toast(`Eşleme oluşturuldu: ${r.owned_codes.length}/${r.all_codes.length} kod`, 'ok');
      const missing = r.unowned_codes ?? [];
      $('#mapResult').innerHTML = `<div class="sub" style="margin-top:10px">Sahipli <b>${r.owned_codes.length}</b> / <b>${r.all_codes.length}</b> kod` +
        (missing.length
          ? `<br>Sahipsiz ${missing.length} kod: <span class="mono">${missing.slice(0, 8).join(', ')}</span>${missing.length > 8 ? '…' : ''}` +
            `<br><a href="#ajanlar" style="color:var(--accent)">Sorumlular sayfasından eksik ajanları aktive edin</a>`
          : ' · tüm kodlar sahipli') + `</div>`;
    } catch (e) {
      toast('Oluşturulamadı: ' + e.message, 'bad');
    }
  });

  $('#scnSave')?.addEventListener('click', async () => {
    const rows = [...document.querySelectorAll('#scnTable tbody tr')];
    const runs = rows.map((tr, i) => ({
      scenario: SCENARIO_NAMES[i],
      accuracy: Number(tr.querySelector('.scn-acc').value),
      sla_violations: Number(tr.querySelector('.scn-sla').value),
      audit_chain: tr.querySelector('.scn-chain').checked,
    }));
    try {
      const r = await api(`/api/sessions/${sid}/scenarios`, { method: 'POST', body: JSON.stringify({ runs }) });
      toast(`Kaydedildi: doğruluk %${r.classification_accuracy}`, 'ok');
      $('#scnResult').innerHTML = `<div class="sub" style="margin-top:10px">Doğruluk %${r.classification_accuracy} · SLA ihlali ${r.sla_violations} · hash zinciri ${r.audit_chain_verified ? 'doğrulandı' : 'DOĞRULANMADI'}</div>`;
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });

  $('#asmSave')?.addEventListener('click', async () => {
    const articles = [...document.querySelectorAll('.art-status')].map((s) => ({ id: s.dataset.id, status: s.value }));
    const payload = {
      articles,
      reviewer: $('#revName')?.value.trim() ?? '',
      risk_acceptance: ($('#riskAcc')?.value ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    };
    try {
      const r = await api(`/api/sessions/${sid}/assessment`, { method: 'POST', body: JSON.stringify(payload) });
      toast(`Değerlendirme kaydedildi: ${r.high_severity} boşluk`, 'ok');
      $('#asmResult').innerHTML = `<div class="sub" style="margin-top:10px">Boşluk: ${r.high_severity} · kısmi: ${r.partial} · kabul edilen risk: ${r.accepted}</div>`;
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });

  $('#expBuild')?.addEventListener('click', async () => {
    try {
      const r = await api(`/api/sessions/${sid}/export`, { method: 'POST', body: '{}' });
      const dl = $('#expDownload');
      dl.href = r.download;
      dl.style.display = 'inline-block';
      $('#expResult').innerHTML = `<div class="sub" style="margin-top:10px">
        ${r.files} dosya · ${(r.size / 1024).toFixed(1)} KB ·
        zincir başı <span class="mono">${esc(String(r.chain_head).slice(0, 16))}…</span> ·
        imza ${r.signed ? '<span class="ok">Ed25519</span>' : '<span class="bad">yok</span>'}</div>`;
      toast('Kanıt paketi oluşturuldu', 'ok');
    } catch (e) {
      toast('Oluşturulamadı: ' + e.message, 'bad');
    }
  });

  $('#liveSave')?.addEventListener('click', async () => {
    const grants = [...document.querySelectorAll('.auto-level')].map((s) => ({
      role: s.dataset.id,
      level: s.value,
      approved_by: state.user?.name ?? '',
    }));
    try {
      await api(`/api/sessions/${sid}/autonomy`, { method: 'POST', body: JSON.stringify({ grants }) });
      const r = await api(`/api/sessions/${sid}/golive`, {
        method: 'POST',
        body: JSON.stringify({
          shadow_days: Number($('#shadowDays').value),
          semi_auto_days: Number($('#semiDays').value),
          mos_dashboard: $('#mosChk').checked,
          regwatch_agent: $('#regChk').checked,
          annual_review_date: $('#reviewDate').value,
        }),
      });
      toast('Geçiş kaydı kaydedildi', 'ok');
      $('#liveResult').innerHTML = `<div class="sub" style="margin-top:10px">Gölge ${r.shadow_days}g · yarı-otomatik ${r.semi_auto_days}g · inceleme ${r.annual_review_date || '—'}</div>`;
    } catch (e) {
      toast('Kaydedilemedi: ' + e.message, 'bad');
    }
  });

  $('#licSave')?.addEventListener('click', async () => {
    const token = $('#licToken').value.trim();
    if (!token) return toast('Lisans anahtarı boş', 'bad');
    try {
      const r = await api(`/api/sessions/${sid}/license`, { method: 'POST', body: JSON.stringify({ token }) });
      toast('Lisans etkinleştirildi', 'ok');
      $('#licResult').innerHTML = `<div class="sub" style="margin-top:10px">Müşteri: ${esc(r.claims.customer ?? '—')} · geçerlilik: ${esc(r.claims.expires_at ?? '—')}</div>`;
    } catch (e) {
      toast('Etkinleştirilemedi: ' + e.message, 'bad');
    }
  });
}

async function loadTolerances() {
  const box = $('#tolRows');
  if (!box) return;
  try {
    const r = await api(`/api/sessions/${state.activeSession.session_id}/artifacts/business-service-catalogue.json`);
    const services = r.value.services || [];
    box.innerHTML = services.length
      ? `<table><thead><tr><th>Hizmet</th><th>MTD (saat)</th><th>RTO (saat)</th><th>RPO (saat)</th></tr></thead><tbody>
        ${services
          .map(
            (s) => `<tr class="tol-row" data-service="${esc(s.id)}">
          <td>${esc(s.name)}</td>
          <td><input class="tol-mtd" type="number" value="24" min="1"></td>
          <td><input class="tol-rto" type="number" value="4" min="1"></td>
          <td><input class="tol-rpo" type="number" value="0" min="0"></td>
        </tr>`,
          )
          .join('')}</tbody></table>`
      : '<div class="sub">Önce 1. adımda hizmetleri kaydedin.</div>';
  } catch {
    box.innerHTML = '<div class="sub">Önce 1. adımda hizmetleri kaydedin.</div>';
  }
}

function viewParola() {
  return `
    <div class="card" style="max-width:460px">
      <h2>Parolamı değiştir</h2>
      <p class="sub">En az 8 karakter kullanın.</p>
      <div class="row"><label>Mevcut parola</label><input id="pCur" type="password" autocomplete="current-password"></div>
      <div class="row"><label>Yeni parola</label><input id="pNew" type="password" autocomplete="new-password"></div>
      <div class="row"><label>Yeni parola (tekrar)</label><input id="pNew2" type="password" autocomplete="new-password"></div>
      <div class="actions"><button class="primary" id="pSave">Değiştir</button><span class="sub" id="pErr"></span></div>
    </div>`;
}

function bindParola() {
  $('#pSave')?.addEventListener('click', async () => {
    const cur = $('#pCur').value;
    const nw = $('#pNew').value;
    if (nw !== $('#pNew2').value) return toast('Yeni parolalar aynı değil', 'bad');
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: cur, password: nw }) });
      toast('Parola değiştirildi', 'ok');
      $('#pCur').value = $('#pNew').value = $('#pNew2').value = '';
    } catch (e) {
      toast('Değiştirilemedi: ' + e.message, 'bad');
    }
  });
}

/* ── router ───────────────────────────────────────────── */

const ROUTES = {
  durum: { title: 'Durum', sub: 'Kurulumunuzun durumu', render: viewDurum, bind: bindCommon, roles: ['user', 'admin'] },
  genel: { title: 'Genel bakış', sub: 'Teknik özet', render: viewGenel, bind: bindCommon, roles: ['admin'] },
  kurulum: { title: 'Kurulum', sub: 'Hizmetler, toleranslar ve adım denetimi', render: viewKurulum, bind: bindKurulum, roles: ['user', 'admin'] },
  kurum: { title: 'Kurum bilgileri', sub: 'Temel bilgiler', render: viewKurum, bind: bindKurum, roles: ['user', 'admin'] },
  parola: { title: 'Parolamı değiştir', sub: 'Hesap güvenliği', render: viewParola, bind: bindParola, roles: ['user', 'admin'] },
  baglantilar: { title: 'Sistem bağlantıları', sub: 'Olay, destek, uyum ve envanter sistemleri', render: viewBaglantilar, bind: bindBaglantilar, roles: ['user', 'admin'] },
  entegrasyonlar: { title: 'Entegrasyonlar', sub: 'Teknik bağlantı ayarları', render: viewBaglantilar, bind: bindBaglantilar, roles: ['admin'] },
  envanter: { title: 'Varlıklarım', sub: 'Sunucu ve sistem listesi', render: viewVarliklar, bind: bindVarliklar, roles: ['user', 'admin'] },
  ajanlar: { title: 'Sorumlular', sub: 'Görev atamaları', render: viewSorumlular, bind: bindSorumlular, roles: ['user', 'admin'] },
  belgeler: { title: 'Belgeler', sub: 'Kurulum kayıtları', render: viewBelgeler, bind: () => { loadArtifacts(); bindBelgeExport(); }, roles: ['user', 'admin'] },
  kanitlar: { title: 'Kanıtlar', sub: 'Oturum artefaktları', render: viewBelgeler, bind: () => { loadArtifacts(); bindBelgeExport(); }, roles: ['admin'] },
  yonetim: { title: 'Yönetim', sub: 'Kullanıcılar ve işlem kaydı', render: viewYonetim, bind: bindYonetim, roles: ['admin'] },
};

function navItems() {
  const admin = isAdmin();
  return admin
    ? [
        ['genel', 'Genel bakış'],
        ['kurum', 'Kurum profili'],
        ['kurulum', 'Kurulum'],
        ['entegrasyonlar', 'Entegrasyonlar'],
        ['envanter', 'Envanter'],
        ['ajanlar', 'Ajanlar'],
        ['kanitlar', 'Kanıtlar'],
        ['yonetim', 'Yönetim'],
      ]
    : [
        ['durum', 'Durum'],
        ['kurulum', 'Kurulum'],
        ['kurum', 'Kurum bilgileri'],
        ['baglantilar', 'Sistem bağlantıları'],
        ['envanter', 'Varlıklarım'],
        ['ajanlar', 'Sorumlular'],
        ['belgeler', 'Belgeler'],
      ];
}

function currentTab() {
  const hash = location.hash.replace('#', '');
  if (hash === 'giris') return null;
  const tab = hash || (isAdmin() ? 'genel' : 'durum');
  const route = ROUTES[tab];
  if (!route || !route.roles.includes(state.role)) return isAdmin() ? 'genel' : 'durum';
  return tab;
}

let navKey = null;

function sessionLabel() {
  if (!state.exp) return '';
  const left = Math.max(0, Math.round((state.exp - Date.now()) / 60000));
  return left > 0 ? `${left} dk` : 'doldu';
}

function renderShell() {
  const key = `${state.user?.id ?? '-'}:${state.role ?? '-'}`;
  const items = navItems();

  if (key !== navKey) {
    navKey = key;
    $('#nav').innerHTML =
      items.map(([id, label]) => `<a href="#${id}" data-tab="${id}">${label}</a>`).join('') +
      (isAdmin() ? `<a href="/dashboard/" data-tab="panel">Teknik panel</a>` : '') +
      `<a href="#" id="logout" data-tab="cikis">Çıkış</a>`;
    $('#logout').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Dora-CSRF': '1' } });
      } catch {
        /* çıkışta ağ hatası önemsiz */
      }
      state.user = null;
      state.role = null;
      state.exp = null;
      navKey = null;
      location.hash = '';
      renderLogin('login');
    });
  }

  $('#sessionPill').textContent = state.user
    ? `${state.user.name || state.user.username} · ${isAdmin() ? 'yönetici' : 'kullanıcı'} · ${sessionLabel()}`
    : 'giriş yok';
  $('#sessionPill').className = 'pill ' + (isAdmin() ? 'warn' : 'ok');
  $('#saveState').innerHTML = state.user
    ? `<a href="#parola" style="color:inherit;text-decoration:none">parola</a> · <a href="#" id="extend" style="color:inherit;text-decoration:none">oturumu uzat</a>`
    : 'kaydedildi';
  $('#saveState').className = 'pill muted';
  const ext = $('#extend');
  if (ext) {
    ext.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const r = await api('/api/auth/refresh', { method: 'POST', body: '{}' });
        state.exp = r.exp;
        renderShell();
        toast('Oturum ' + r.session_hours + ' saat uzatıldı', 'ok');
      } catch (err) {
        toast('Uzatılamadı: ' + err.message, 'bad');
      }
    });
  }
}

function render() {
  if (!state.user) {
    renderShell();
    renderLogin(state.needsBootstrap ? 'bootstrap' : 'login');
    return;
  }
  const tab = currentTab();
  if (!tab) {
    location.hash = isAdmin() ? '#genel' : '#durum';
    return;
  }
  const route = ROUTES[tab];
  renderShell();
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  $('#title').textContent = route.title;
  $('#subtitle').textContent = route.sub;
  view.innerHTML = route.render();
  route.bind();
}

window.addEventListener('hashchange', render);

(async () => {
  try {
    await loadState();
  } catch (e) {
    view.innerHTML = `<div class="card"><h2>Sunucuya ulaşılamadı</h2><p class="sub">${esc(e.message)}</p></div>`;
    return;
  }
  render();
})();
