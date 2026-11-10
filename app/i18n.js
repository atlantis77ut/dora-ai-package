// DORA Ajan Paketi — arayüz dili (TR/EN) ve yardım adımları.
// Saf modül: tarayıcıda `app.js` tarafından, testlerde Node tarafından kullanılır.

export const LANGS = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

export const DICT = {
  tr: {
    'app.name': 'DORA Ajan Paketi',
    'nav.durum': 'Durum',
    'nav.kurulum': 'Kurulum',
    'nav.kurum': 'Kurum bilgileri',
    'nav.baglantilar': 'Sistem bağlantıları',
    'nav.envanter': 'Varlıklarım',
    'nav.ajanlar': 'Sorumlular',
    'nav.belgeler': 'Belgeler',
    'nav.guvenlik': 'Güvenlik',
    'nav.parola': 'Parola',
    'nav.ara': 'Ara',
    'nav.yardim': 'Yardım',
    'nav.genel': 'Genel bakış',
    'nav.entegrasyonlar': 'Entegrasyonlar',
    'nav.kanitlar': 'Kanıtlar',
    'nav.siem': 'SIEM olayları',
    'nav.yonetim': 'Yönetim',
    'nav.pano': 'Canlı pano',
    'nav.panel': 'Teknik panel',
    'nav.kitap': 'El kitabı',
    'nav.logout': 'Çıkış',
    'title.durum': 'Durum',
    'title.kurulum': 'Kurulum',
    'title.kurum': 'Kurum bilgileri',
    'title.yardim': 'Yardım',
    'sub.durum': 'Kurulumunuzun durumu',
    'sub.kurulum': 'Hizmetler, toleranslar ve adım denetimi',
    'sub.yardim': 'Adım adım kullanım rehberi',
    'help.intro':
      'Bu rehber, kimseye sormadan ürünü kullanmanız için hazırlandı. Her adımı sırayla yapın; yaptıkça işaretleyin. İlerleme bu tarayıcıda saklanır.',
    'help.progress': 'Tamamlanan',
    'help.go': 'Bu adıma git',
    'help.done': 'Yapıldı',
    'help.reset': 'İlerlemeyi sıfırla',
    'help.lang_note': 'Dili sağ üstten değiştirebilirsiniz.',
    'common.save': 'Kaydet',
    'common.refresh': 'Yenile',
    'common.search': 'Ara',
    'common.close': 'Kapat',
    'common.yes': 'Evet',
    'common.no': 'Hayır',
  },
  en: {
    'app.name': 'DORA Agent Package',
    'nav.durum': 'Status',
    'nav.kurulum': 'Setup',
    'nav.kurum': 'Institution',
    'nav.baglantilar': 'System connections',
    'nav.envanter': 'Assets',
    'nav.ajanlar': 'Owners',
    'nav.belgeler': 'Documents',
    'nav.guvenlik': 'Security',
    'nav.parola': 'Password',
    'nav.ara': 'Search',
    'nav.yardim': 'Help',
    'nav.genel': 'Overview',
    'nav.entegrasyonlar': 'Integrations',
    'nav.kanitlar': 'Evidence',
    'nav.siem': 'SIEM events',
    'nav.yonetim': 'Administration',
    'nav.pano': 'Live dashboard',
    'nav.panel': 'Technical panel',
    'nav.kitap': 'Handbook',
    'nav.logout': 'Sign out',
    'title.durum': 'Status',
    'title.kurulum': 'Setup',
    'title.kurum': 'Institution',
    'title.yardim': 'Help',
    'sub.durum': 'Where your setup stands',
    'sub.kurulum': 'Services, tolerances and step checks',
    'sub.yardim': 'Step-by-step usage guide',
    'help.intro':
      'This guide lets you use the product without asking anyone. Follow the steps in order and tick them off as you go. Progress is stored in this browser.',
    'help.progress': 'Completed',
    'help.go': 'Go to this step',
    'help.done': 'Done',
    'help.reset': 'Reset progress',
    'help.lang_note': 'You can change the language from the top right.',
    'common.save': 'Save',
    'common.refresh': 'Refresh',
    'common.search': 'Search',
    'common.close': 'Close',
    'common.yes': 'Yes',
    'common.no': 'No',
  },
};

export function t(lang, key, fallback = null) {
  const l = DICT[lang] ? lang : 'tr';
  return DICT[l][key] ?? DICT.tr[key] ?? fallback ?? key;
}

export function normalizeLang(input) {
  const s = String(input ?? '').toLowerCase();
  if (s.startsWith('en')) return 'en';
  return 'tr';
}

/** Yardım adımları: her adım bir sayfaya bağlanır. */
export const HELP_STEPS = [
  {
    id: 'kurum',
    route: 'kurum',
    tr: {
      title: '1. Kurumunuzu tanıtın',
      body: 'Kurum adı, büyüklük (tier), denetleyici kurum ve faaliyet alanlarını girin. Bu bilgiler tüm raporlarda görünür.',
      tip: 'Emin değilseniz tier2 ile başlayın; yönetici sonra değiştirebilir.',
    },
    en: {
      title: '1. Introduce your institution',
      body: 'Enter the institution name, size (tier), supervisory authority and business lines. These appear in every report.',
      tip: 'If unsure, start with tier2; an administrator can change it later.',
    },
  },
  {
    id: 'hizmetler',
    route: 'kurulum',
    tr: {
      title: '2. Kritik hizmetlerinizi listeleyin',
      body: 'Kurulum sayfasında Adım 1: her hizmet için ad, sahip ve kritiklik girin. En az bir hizmet gerekir.',
      tip: 'Ödeme, mevduat, kredi gibi müşteriye dokunan hizmetleri düşünün.',
    },
    en: {
      title: '2. List your critical services',
      body: 'Setup page, Step 1: enter name, owner and criticality for each service. At least one service is required.',
      tip: 'Think of customer-facing services such as payments, deposits, lending.',
    },
  },
  {
    id: 'tolerans',
    route: 'kurulum',
    tr: {
      title: '3. Kesinti toleranslarını belirleyin',
      body: 'Adım 2: her hizmet için MTD, RTO ve RPO (saat). Yıllık kesinti sınırını da girin.',
      tip: 'MTD, o hizmet için kabul edilebilir en uzun kesintidir.',
    },
    en: {
      title: '3. Set outage tolerances',
      body: 'Step 2: MTD, RTO and RPO (hours) per service, plus the annual outage limit.',
      tip: 'MTD is the longest outage you can accept for that service.',
    },
  },
  {
    id: 'envanter',
    route: 'envanter',
    tr: {
      title: '4. Varlıklarınızı yükleyin',
      body: 'Şablonu indirin, doldurun ve dosyayı seçin. Veya satırları elle yazıp kaydedin.',
      tip: 'Kritiklik: kritik / önemli / standart.',
    },
    en: {
      title: '4. Upload your assets',
      body: 'Download the template, fill it in and pick the file. Or type rows manually and save.',
      tip: 'Criticality: critical / important / standard.',
    },
  },
  {
    id: 'sorumlular',
    route: 'ajanlar',
    tr: {
      title: '5. Sorumluları atayın',
      body: 'Her görev için kurumunuzda kimin sorumlu olduğunu yazın ve görevleri işaretleyin.',
      tip: 'Bir kişi birden fazla görev alabilir.',
    },
    en: {
      title: '5. Assign owners',
      body: 'For each duty, write who is responsible in your institution and tick the duties.',
      tip: 'One person can hold several duties.',
    },
  },
  {
    id: 'senaryolar',
    route: 'kurulum',
    tr: {
      title: '6. Senaryo sonuçlarını girin',
      body: 'Adım 4: üç senaryo için doğruluk yüzdesi, SLA ihlali sayısı ve hash zinciri durumu.',
      tip: 'Henüz test yapmadıysanız %100 / 0 / işaretli varsayılanla kaydedip sonra güncelleyin.',
    },
    en: {
      title: '6. Enter scenario results',
      body: 'Step 4: accuracy %, number of SLA violations and hash-chain status for three scenarios.',
      tip: 'If you have not tested yet, save the defaults and update later.',
    },
  },
  {
    id: 'kapsama',
    route: 'kurulum',
    tr: {
      title: '7. Öz değerlendirme yapın',
      body: 'Adım 5: 28 DORA maddesi için kapsama durumunu seçin, bağımsız doğrulayanı yazın.',
      tip: 'Boşluk bırakırsanız adım kapısı uyarır.',
    },
    en: {
      title: '7. Self-assessment',
      body: 'Step 5: choose coverage for 28 DORA articles and name the independent reviewer.',
      tip: 'Leaving gaps will be flagged by the step gate.',
    },
  },
  {
    id: 'canliya',
    route: 'kurulum',
    tr: {
      title: '8. Canlıya geçiş kaydı',
      body: 'Adım 6: ajanların otonomi seviyelerini, gölge/yarı-otomatik gün sayısını ve yıllık inceleme tarihini girin.',
      tip: 'Üretim için ticari lisans gerekir; deneme modunda bu adım kapanmaz.',
    },
    en: {
      title: '8. Go-live record',
      body: 'Step 6: agent autonomy levels, shadow/semi-automatic days and the annual review date.',
      tip: 'Production requires a commercial licence; in trial mode this step will not pass.',
    },
  },
  {
    id: 'kanit',
    route: 'kurulum',
    tr: {
      title: '9. Kanıt paketi ve rapor',
      body: 'Kanıt paketi oluştur → indir (imzalı zip). Yönetim raporu (PDF) ile özet çıkar.',
      tip: 'Paket anlık görüntüdür; yeni kayıt eklerseniz yeniden oluşturun.',
    },
    en: {
      title: '9. Evidence bundle and report',
      body: 'Create the evidence bundle, then download the signed zip. Use the management report (PDF) for a summary.',
      tip: 'The bundle is a snapshot; recreate it after adding records.',
    },
  },
  {
    id: 'olay',
    route: 'siem',
    tr: {
      title: '10. Olayları izleyin',
      body: 'Olayları çekin, taslak kayıt üretin, alanları doldurup aktif kayda yükseltin. 4 saat / 72 saat / 1 ay sayaçlarını izleyin.',
      tip: 'Gecikmiş adım kırmızı görünür; gönderdikten sonra "gönderildi" işaretleyin.',
    },
    en: {
      title: '10. Track incidents',
      body: 'Fetch events, create draft records, fill fields and promote to an active record. Watch the 4h / 72h / 1 month counters.',
      tip: 'Overdue steps turn red; mark "sent" once you have reported.',
    },
  },
  {
    id: 'onay',
    route: 'yonetim',
    tr: {
      title: '11. Onay akışı',
      body: 'Dört göz onayını açtıysanız sınıflandırma ve canlıya geçiş ikinci yöneticinin onayına gider; Yönetim → Onay akışı.',
      tip: 'Tek yönetici varsa açmayın.',
    },
    en: {
      title: '11. Approval flow',
      body: 'With four-eyes enabled, classification and go-live go to a second administrator: Administration → Approvals.',
      tip: 'Do not enable with a single administrator.',
    },
  },
  {
    id: 'guvenlik',
    route: 'guvenlik',
    tr: {
      title: '12. Hesabınızı koruyun',
      body: 'İki adımlı doğrulamayı açın, kurtarma kodlarını saklayın, parolanızı gerektiğinde değiştirin.',
      tip: 'Kurtarma kodları bir kez gösterilir.',
    },
    en: {
      title: '12. Protect your account',
      body: 'Enable two-factor authentication, store recovery codes and change your password when needed.',
      tip: 'Recovery codes are shown only once.',
    },
  },
];

export function helpSteps(lang) {
  const l = DICT[lang] ? lang : 'tr';
  return HELP_STEPS.map((s) => ({ id: s.id, route: s.route, ...s[l] }));
}
