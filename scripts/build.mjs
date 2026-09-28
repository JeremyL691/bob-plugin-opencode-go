import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const info = JSON.parse(readFileSync(resolve(root, 'plugin/info.json'), 'utf8'));
const context = vm.createContext({});
vm.runInContext(readFileSync(resolve(root, 'plugin/main.js'), 'utf8'), context);
const menu = info.options.find((option) => option.identifier === 'model');
const menuIds = menu.menuValues.map((item) => item.value);
const codeIds = Object.keys(context.GO_MODELS);
if (new Set(menuIds).size !== menuIds.length ||
    menuIds.length !== codeIds.length ||
    menuIds.some((id) => !context.GO_MODELS[id])) {
  throw new Error('Model menu and protocol map do not match');
}
if (info.version !== JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version) {
  throw new Error('Plugin and package versions do not match');
}

const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });
const filename = `opencode-go-translate_${info.version}.bobplugin`;
const output = resolve(dist, filename);
rmSync(output, { force: true });
execFileSync('zip', ['-j', '-q', '-X', output, 'plugin/info.json', 'plugin/main.js'], { cwd: root });
const digest = createHash('sha256').update(readFileSync(output)).digest('hex');
const releaseUrl = `https://github.com/JeremyL691/bob-plugin-opencode-go/releases/download/v${info.version}/${filename}`;
const appcast = {
  identifier: info.identifier,
  versions: [{
    version: info.version,
    desc: '首次发布：支持 OpenCode Go 模型文本翻译。',
    sha256: digest,
    url: releaseUrl,
    minBobVersion: info.minBobVersion,
    timestamp: Date.now()
  }]
};
writeFileSync(resolve(root, 'appcast.json'), JSON.stringify(appcast, null, 2) + '\n');
console.log(`${output}\nSHA-256: ${digest}`);
