import test from 'node:test';
import assert from 'node:assert/strict';
import { DICT, LANGS, t, normalizeLang, helpSteps, HELP_STEPS } from '../../../../app/i18n.js';

test('i18n: iki dil tanımlı', () => {
  assert.deepEqual(LANGS.map((l) => l.code), ['tr', 'en']);
  assert.ok(DICT.tr && DICT.en);
});

test('i18n: tüm anahtarlar iki dilde var', () => {
  const tr = Object.keys(DICT.tr).sort();
  const en = Object.keys(DICT.en).sort();
  const missingEn = tr.filter((k) => !(k in DICT.en));
  const missingTr = en.filter((k) => !(k in DICT.tr));
  assert.deepEqual(missingEn, [], 'EN eksik: ' + missingEn.join(', '));
  assert.deepEqual(missingTr, [], 'TR eksik: ' + missingTr.join(', '));
});

test('i18n: boş çeviri yok', () => {
  for (const lang of ['tr', 'en']) {
    for (const [k, v] of Object.entries(DICT[lang])) {
      assert.ok(String(v).trim().length > 0, `${lang}.${k} boş`);
    }
  }
});

test('i18n: t() bilinmeyen anahtarda yedeğe düşer', () => {
  assert.equal(t('en', 'nav.yardim'), 'Help');
  assert.equal(t('tr', 'nav.yardim'), 'Yardım');
  assert.equal(t('xx', 'nav.yardim'), 'Yardım');
  assert.equal(t('en', 'yok.anahtar', 'fallback'), 'fallback');
});

test('i18n: normalizeLang', () => {
  assert.equal(normalizeLang('en-US'), 'en');
  assert.equal(normalizeLang('EN'), 'en');
  assert.equal(normalizeLang('tr-TR'), 'tr');
  assert.equal(normalizeLang(''), 'tr');
  assert.equal(normalizeLang(null), 'tr');
});

test('yardım: 12 adım ve iki dilde içerik', () => {
  assert.equal(HELP_STEPS.length, 12);
  for (const s of HELP_STEPS) {
    for (const lang of ['tr', 'en']) {
      assert.ok(s[lang]?.title?.length > 3, `${s.id}.${lang}.title`);
      assert.ok(s[lang]?.body?.length > 10, `${s.id}.${lang}.body`);
      assert.ok(s[lang]?.tip?.length > 3, `${s.id}.${lang}.tip`);
    }
  }
});

test('yardım: kimlikler benzersiz ve rotalar geçerli', () => {
  const ids = HELP_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const routes = new Set([
    'durum', 'kurulum', 'kurum', 'baglantilar', 'envanter', 'ajanlar', 'belgeler', 'guvenlik',
    'parola', 'ara', 'yardim', 'genel', 'entegrasyonlar', 'kanitlar', 'siem', 'yonetim', 'pano',
  ]);
  for (const s of HELP_STEPS) assert.ok(routes.has(s.route), `geçersiz rota: ${s.route}`);
});

test('yardım: helpSteps dile göre çevirir', () => {
  const tr = helpSteps('tr');
  const en = helpSteps('en');
  assert.equal(tr.length, en.length);
  assert.match(tr[0].title, /Kurum/);
  assert.match(en[0].title, /institution/i);
});
