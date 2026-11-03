import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const version = pkg.version || '0.0.08';
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
  sectionBody = `### Highlights\n- Build updates for **FICSIT Node Labs (${version} dev build)**.`;
}

const releaseNotes = [
  `# FICSIT Node Labs — \`${version} dev build\``,
  '',
  sectionBody,
  '',
  '---',
  '*Full changelog in [`CHANGELOG.md`](./CHANGELOG.md)*',
  '',
].join('\n');

fs.writeFileSync(path.join(process.cwd(), 'RELEASE_NOTES.md'), releaseNotes, 'utf8');
console.log(`Generated RELEASE_NOTES.md for version ${version}`);
