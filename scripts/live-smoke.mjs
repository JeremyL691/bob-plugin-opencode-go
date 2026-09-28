import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const key = await new Promise((resolve, reject) => {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => resolve(input.trim()));
  process.stdin.on('error', reject);
});
if (!key) throw new Error('Pass the Go API key on stdin');

const source = readFileSync(new URL('../plugin/main.js', import.meta.url), 'utf8');
const cases = [
  { model: 'deepseek-v4.1-flash', protocol: 'chat' },
  { model: 'gpt-5.6-luna', protocol: 'responses' },
  { model: 'minimax-m3', protocol: 'messages' },
  { model: 'grok-4.7', protocol: 'responses' },
  { model: 'kimi-k3', protocol: 'chat' },
  { model: 'qwen3.8-max', protocol: 'messages' },
  { model: 'glm-5.3-flash', protocol: 'chat' },
  { model: 'glm-5.2', protocol: 'chat' },
  { model: 'mimo-v2.6-flash', protocol: 'chat' },
  { model: 'longcat-2.0', protocol: 'chat' }
];
const args = process.argv.slice(2);
const effortArg = args.find((arg) => arg.startsWith('--effort='));
const effort = effortArg ? effortArg.slice('--effort='.length) : 'lowest';
const selected = args.filter((arg) => !arg.startsWith('--'));

for (const item of cases) {
  if (selected.length && !selected.includes(item.model)) continue;
  let requested;
  let finished;
  const context = vm.createContext({
    $option: { apiKey: key, model: item.model, customModel: '', customProtocol: 'chat', thinkingEffort: effort },
    $http: { request: (value) => { requested = value; } }
  });
  vm.runInContext(source, context);
  context.translate({
    text: 'Good morning. Please keep this sentence short.',
    from: 'en', to: 'zh-Hans', detectFrom: 'en', detectTo: 'zh-Hans',
    onCompletion: (value) => { finished = value; }
  });
  const { handler, ...request } = requested;
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.header,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(50000)
  });
  const data = await response.json().catch(() => null);
  handler({ response: { statusCode: response.status }, data });
  console.log(JSON.stringify({
    model: item.model,
    protocol: item.protocol,
    effort,
    status: response.status,
    result: finished?.result?.content?.text ?? null,
    error: finished?.error?.message ?? null
  }));
  if (!response.ok) break;
}
