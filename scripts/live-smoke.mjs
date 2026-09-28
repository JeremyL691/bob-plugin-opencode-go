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
  { model: 'minimax-m3', protocol: 'messages' }
];

for (const item of cases) {
  let requested;
  let finished;
  const context = vm.createContext({
    $option: { apiKey: key, model: item.model, customModel: '', customProtocol: 'chat' },
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
    status: response.status,
    result: finished?.result?.content?.text ?? null,
    error: finished?.error?.message ?? null
  }));
  if (!response.ok) break;
}
