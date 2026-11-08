// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Minimal JSON Schema doğrulayıcı (draft alt kümesi, bağımlılıksız).
// Desteklenen: type, required, properties, additionalProperties=false, enum,
// pattern, minimum, maximum, items, minItems, maxItems, minLength, maxLength.
// $ref, allOf/anyOf, format ve draft-2020 özel anahtarları bilinçli olarak yok —
// paketin şemaları bu alt kümeyle yazılır.

const TYPES = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
};

export function validate(instance, schema, path = '') {
  const errors = [];
  const push = (msg) => errors.push({ path: path || '(kök)', message: msg });

  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some((t) => (TYPES[t] ? TYPES[t](instance) : true));
    if (!ok) {
      push('beklenen tür: ' + types.join('|') + ', gelen: ' + (instance === null ? 'null' : Array.isArray(instance) ? 'array' : typeof instance));
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(instance)) {
    push('değer izin verilenlerde değil: ' + JSON.stringify(instance));
  }

  if (typeof instance === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(instance)) push('desen uyuşmuyor: ' + schema.pattern);
    if (schema.minLength != null && instance.length < schema.minLength) push('en az ' + schema.minLength + ' karakter');
    if (schema.maxLength != null && instance.length > schema.maxLength) push('en çok ' + schema.maxLength + ' karakter');
  }

  if (typeof instance === 'number') {
    if (schema.minimum != null && instance < schema.minimum) push('en az ' + schema.minimum);
    if (schema.maximum != null && instance > schema.maximum) push('en çok ' + schema.maximum);
  }

  if (Array.isArray(instance)) {
    if (schema.minItems != null && instance.length < schema.minItems) push('en az ' + schema.minItems + ' öğe');
    if (schema.maxItems != null && instance.length > schema.maxItems) push('en çok ' + schema.maxItems + ' öğe');
    if (schema.items) {
      instance.forEach((v, i) => errors.push(...validate(v, schema.items, path + '[' + i + ']')));
    }
  }

  if (TYPES.object(instance)) {
    for (const req of schema.required ?? []) {
      if (!(req in instance)) push('zorunlu alan yok: ' + req);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in instance) errors.push(...validate(instance[key], sub, path ? path + '.' + key : key));
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(instance)) {
        if (!allowed.has(key)) push('tanımsız alan: ' + key);
      }
    }
  }

  return errors;
}
