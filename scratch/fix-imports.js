import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  const fixes = {
    './schema.js': './schema/index.js',
    '../engine.js': '../engine/index.js',
    '../../db.js': '../../db/index.js',
    '../../db/schema.js': '../../db/schema/index.js',
    '../../engine.js': '../../engine/index.js',
  };

  for (const [wrong, correct] of Object.entries(fixes)) {
    // Regex to match from "wrong" or from 'wrong'
    const regex = new RegExp(`from\\s+['"]${wrong}['"]`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `from "${correct}"`);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${filePath}`);
  }
}

function traverseDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

traverseDir(path.join(__dirname, '../src'));
traverseDir(path.join(__dirname, '../api'));
