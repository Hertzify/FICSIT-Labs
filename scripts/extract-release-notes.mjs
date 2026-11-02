import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const version = pkg.version || '0.0.06';
const apkName = `ficsit-node-labs-${version}-dev.apk`;
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

let sectionBody = '';
if (fs.existsSync(changelogPath)) {
  const raw = fs.readFileSync(changelogPath, 'utf8');
  const escapedVer = version.replace(/\./g, '\\.');
  const regex = new RegExp(
    `## \\[${escapedVer}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n---\\n|\\n## \\[|$)`
  );
  const match = raw.match(regex);
  if (match && match[1]) {
    sectionBody = match[1].trim();
  }
}

if (!sectionBody) {
  sectionBody = `### Highlights\n- Automated Android widescreen landscape build for **FICSIT Node Labs (${version} dev build)**.`;
}

const releaseNotes = [
  `# FICSIT Node Labs — \`${version} dev build\``,
  '',
  '> **2D Factory Automation & Logistics Tycoon** inspired by *Satisfactory* & *Upload Labs* for Android (Landscape Widescreen) and Web.',
  '',
  '## 📦 Android APK Download & Installation',
  `- **APK File**: \`${apkName}\` *(attached below under **Assets**)*`,
  '- **Orientation & Mode**: Widescreen Landscape (`sensorLandscape`) · Android Game Mode (`isGame="true"`) · Immersive Sticky Fullscreen',
  '- **How to Install**: Download the `.apk` file on your Android phone or tablet and open it to install or update your existing dev build.',
  '',
  `## 🛠️ What's New in \`${version} dev build\``,
  sectionBody,
  '',
  '---',
  '*Full build history is available in [`CHANGELOG.md`](./CHANGELOG.md) and project documentation in [`README.md`](./README.md).*',
  '',
].join('\n');

fs.writeFileSync(path.join(process.cwd(), 'RELEASE_NOTES.md'), releaseNotes, 'utf8');
console.log(`Generated RELEASE_NOTES.md for version ${version}`);
