import 'reflect-metadata';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';

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

export function loadJsonFile<T>(filePath: string): T {
  const content = loadTextFile(filePath);
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function execShell(
  command: string,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}`));
      } else if (stderr) {
        reject(new Error(`Command error output: ${stderr}`));
      } else {
        const result = stdout.toString();
        resolve(result.trim());
      }
    });
  });
}
