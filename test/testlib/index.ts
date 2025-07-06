import 'reflect-metadata';

import * as fs from 'node:fs';
import * as path from 'node:path';

function getDataPath(filepath: string): string {
  if (filepath.startsWith('/')) {
    return filepath;
  } else {
    return path.join(__dirname, '../data', filepath);
  }
}

export function loadTextFile(filePath: string): string {
  const fullPath = getDataPath(filePath);
  return fs.readFileSync(fullPath, 'utf-8');
}
