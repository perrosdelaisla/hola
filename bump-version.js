#!/usr/bin/env node
// bump-version.js — Bumpea todas las refs ?v=N en una pasada.
// Uso: node bump-version.js <nueva-version>
// Ejemplo: node bump-version.js 52
//
// Toca: index.html + todos los JS del proyecto + CLAUDE.md
// Solo reemplaza patrones `.js?v=NUMERO` o `.css?v=NUMERO` por la
// nueva versión. No agrega refs nuevas, no toca código.
//
// Después de correrlo, revisar con `git diff` antes de commitear.

const fs = require('fs');

const NEW = process.argv[2];
if (!NEW || !/^\d+$/.test(NEW)) {
  console.error('Uso: node bump-version.js <numero>');
  console.error('Ejemplo: node bump-version.js 52');
  process.exit(1);
}

const FILES = [
  'index.html',
  'victoria.js',
  'agenda.js',
  'llamada.js',
  'supabase.js',
  'victoria-utils.js',
  'victoria-zones.js',
  'victoria-dictionaries.js',
  'victoria-phrases.js',
  'victoria-breeds.js',
  'victoria-matching.js',
  'victoria-ai-config.js',
  'CLAUDE.md',
];

const REGEX = /(\.(?:js|css))\?v=\d+/g;

let totalChanges = 0;
let filesModified = 0;

for (const f of FILES) {
  if (!fs.existsSync(f)) {
    console.log(`- ${f} (no existe, skip)`);
    continue;
  }
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(REGEX) || [];
  if (matches.length === 0) {
    console.log(`- ${f} (sin refs ?v=)`);
    continue;
  }
  const newContent = content.replace(REGEX, `$1?v=${NEW}`);
  fs.writeFileSync(f, newContent);
  console.log(`✓ ${f} (${matches.length} refs → v=${NEW})`);
  totalChanges += matches.length;
  filesModified++;
}

console.log('');
console.log(`Listo. ${totalChanges} refs en ${filesModified} archivos bumpeadas a v=${NEW}.`);
console.log('Revisá con: git diff');
console.log(`Después: git add -A && git commit -m "chore: bump v=${NEW}"`);
