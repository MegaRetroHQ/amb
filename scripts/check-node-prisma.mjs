#!/usr/bin/env node
/**
 * Prisma 7+ отклоняет Node < 20.19 (и часть 22.x). Падаем до установки зависимостей — понятнее, чем preinstall в node_modules/prisma.
 * @see https://www.prisma.io/docs/orm/reference/system-requirements
 */
const raw = process.version;
const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(raw);
if (!m) process.exit(0);
const major = Number(m[1]);
const minor = Number(m[2]);
const patch = Number(m[3]);

const ok =
  (major === 20 && (minor > 19 || (minor === 19 && patch >= 0))) ||
  (major === 22 && (minor > 12 || (minor === 12 && patch >= 0))) ||
  major >= 24;

if (ok) process.exit(0);

console.error("");
console.error("  Требуется Node.js 20.19+, 22.12+ или 24+ (Prisma 7).");
console.error(`  Сейчас: ${raw}`);
console.error("");
console.error("  Пример: nvm install && nvm use   (в корне репозитория есть .nvmrc)");
console.error("");
process.exit(1);
