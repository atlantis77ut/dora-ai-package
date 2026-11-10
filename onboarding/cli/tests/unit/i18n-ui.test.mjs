import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_load-app.mjs';

const { UI_EN, UI_PATTERNS, translateUi } = loadApp('i18n-ui.js');

test('ui-i18n: sözlükte tekrar eden/boş anahtar yok', () => {
  for (const [k, v] of Object.entries(UI_EN)) {
    assert.ok(k.trim().length > 0, 'boş anahtar');
    assert.ok(String(v).trim().length > 0, `boş çeviri: ${k}`);
    // bazı sözcükler iki dilde aynıdır (ör. Port)
    const SAME_OK = new Set(['Port', 'Katalog', 'MOS panosu hazır', 'SSL (465)', 'Client ID', 'Client secret']);
    if (!SAME_OK.has(k)) assert.notEqual(String(v), k, `çeviri anahtarla aynı: ${k}`);
  }
});

test('ui-i18n: tam eşleşme çevrilir', () => {
  assert.equal(translateUi('Kaydet', 'en'), 'Save');
  assert.equal(translateUi('Kurum bilgileri', 'en'), 'Institution details');
  assert.equal(translateUi('Olayları çek', 'en'), 'Fetch events');
});

test('ui-i18n: çeviri yoksa metin korunur', () => {
  assert.equal(translateUi('Bilinmeyen bir metin', 'en'), 'Bilinmeyen bir metin');
  assert.equal(translateUi('PRC-INC-01', 'en'), 'PRC-INC-01');
});

test('ui-i18n: tr seçiliyken hiçbir şey değişmez', () => {
  assert.equal(translateUi('Kaydet', 'tr'), 'Kaydet');
  assert.equal(translateUi('3 sonuç', 'tr'), '3 sonuç');
});

test('ui-i18n: sayı kalıpları çevrilir', () => {
  assert.equal(translateUi('3 sonuç', 'en'), '3 results');
  assert.equal(translateUi('5 varlık kaydedildi', 'en'), '5 assets saved');
  assert.equal(translateUi('son tarama: 10:30', 'en'), 'last scan: 10:30');
});

test('ui-i18n: boşluklar korunur', () => {
  assert.equal(translateUi('  Kaydet  ', 'en'), '  Save  ');
});

test('ui-i18n: form etiketleri ve düğmeler kapsanır', () => {
  const keys = ['Kurum adı', 'Kurum büyüklüğü', 'Denetleyici kurum', 'Faaliyet ülkesi', 'Kaydet', 'Sil', 'Ara',
    'Yeni kullanıcı', 'Kullanıcı ekle', 'Olayları çek', 'Taslak kayıt oluştur', 'Şablon indir', 'Kritiklik',
    'Tedarikçi', 'Sorumlu kişi', 'Gönderen', 'Alıcılar (virgülle; boşsa yönetici e-postaları)', 'Etkin'];
  for (const k of keys) {
    assert.ok(UI_EN[k], `eksik çeviri: ${k}`);
    assert.equal(translateUi(k, 'en'), UI_EN[k]);
  }
});

test('ui-i18n: kalıp listesi geçerli', () => {
  assert.ok(UI_PATTERNS.length >= 8);
  for (const p of UI_PATTERNS) {
    assert.ok(p.tr instanceof RegExp);
    assert.equal(typeof p.en, 'function');
  }
});
