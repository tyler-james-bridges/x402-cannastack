const fs = require('node:fs');
const path = require('node:path');

function hasMagic(pattern) {
  return /[*?{}[\]]/.test(pattern);
}

function globSync(pattern, options = {}) {
  const normalized = String(pattern).replace(/\\/g, '/');
  const onlyDirectories = Boolean(options.onlyDirectories);
  if (hasMagic(normalized)) {
    throw new Error(`fast-glob override does not expand patterns: ${normalized}`);
  }
  const absolute = path.resolve(normalized);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (onlyDirectories && !stat.isDirectory()) return [];
  return [normalized];
}

function fastGlob() {
  throw new Error('fast-glob override only implements globSync');
}

fastGlob.globSync = globSync;
fastGlob.sync = globSync;
module.exports = fastGlob;
