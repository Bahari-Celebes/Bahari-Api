import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // import ... from "./..."
  // export ... from "./..."
  const regex1 = /(import|export)([\s\S]*?)from\s+['"](\.[^'"]+)['"]/g;
  content = content.replace(regex1, (match, p1, p2, p3) => {
    if (p3.endsWith('.js') || p3.endsWith('.json')) return match;
    changed = true;
    return `${p1}${p2}from "${p3}.js"`;
  });

  // import "./..."
  const regex2 = /import\s+['"](\.[^'"]+)['"]/g;
  content = content.replace(regex2, (match, p1) => {
    if (p1.endsWith('.js') || p1.endsWith('.json')) return match;
    changed = true;
    return `import "${p1}.js"`;
  });

  // import("./...")
  const regex3 = /import\(['"](\.[^'"]+)['"]\)/g;
  content = content.replace(regex3, (match, p1) => {
    if (p1.endsWith('.js') || p1.endsWith('.json')) return match;
    changed = true;
    return `import("${p1}.js")`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
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
