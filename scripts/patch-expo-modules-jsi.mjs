import fs from 'node:fs';
import path from 'node:path';

const target = path.join(
  process.cwd(),
  'node_modules',
  'expo-modules-jsi',
  'apple',
  'Sources',
  'ExpoModulesJSI',
  'Coding',
  'JavaScriptCodable+Date.swift',
);

const original = 'abs(milliseconds) <= maxJavaScriptDateMilliseconds';
const patched = 'Swift.abs(milliseconds) <= maxJavaScriptDateMilliseconds';

if (!fs.existsSync(target)) {
  throw new Error(`ExpoModulesJSI Swift source was not found: ${target}`);
}

const source = fs.readFileSync(target, 'utf8');
if (source.includes(patched)) {
  console.log('ExpoModulesJSI Swift 6.2 patch is already applied.');
} else if (source.includes(original)) {
  fs.writeFileSync(target, source.replace(original, patched));
  console.log('Applied ExpoModulesJSI Swift 6.2 abs() disambiguation patch.');
} else {
  throw new Error('ExpoModulesJSI Date source changed; refusing to apply an unknown patch.');
}

