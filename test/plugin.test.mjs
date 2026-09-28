import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../plugin/main.js', import.meta.url), 'utf8');
const info = JSON.parse(readFileSync(new URL('../plugin/info.json', import.meta.url), 'utf8'));

function setup(options = {}) {
  let request;
  let completion;
  const context = vm.createContext({
    $option: { apiKey: 'test-key', model: 'deepseek-v4.1-flash', customModel: '', customProtocol: 'chat', ...options },
    $http: { request: (value) => { request = value; } }
  });
  vm.runInContext(source, context);
  const query = {
    text: 'Hello\nworld', from: 'auto', to: 'auto', detectFrom: 'en', detectTo: 'zh-Hans',
    cancelSignal: {}, onCompletion: (value) => { completion = value; }
  };
  return {
    context,
    query,
    translate: () => { context.translate(query); },
    request: () => request,
    completion: () => completion
  };
}

test('all menu models have a protocol and the default is DeepSeek V4.1 Flash', () => {
  const instance = setup();
  const menu = info.options.find((option) => option.identifier === 'model');
  assert.equal(menu.defaultValue, 'deepseek-v4.1-flash');
  assert.equal(menu.menuValues.length, Object.keys(instance.context.GO_MODELS).length);
  for (const entry of menu.menuValues) assert.ok(instance.context.GO_MODELS[entry.value]);
  assert.equal(info.minBobVersion, '1.21.0');
  assert.equal(info.options.find((option) => option.identifier === 'apiKey').textConfig.type, 'secure');
});

test('chat request uses Bearer auth and returns plain Bob content', () => {
  const instance = setup();
  instance.translate();
  const request = instance.request();
  assert.match(request.url, /\/chat\/completions$/);
  assert.equal(request.header.Authorization, 'Bearer test-key');
  assert.equal(request.body.messages[1].content, 'Hello\nworld');
  assert.match(request.body.messages[0].content, /English to Simplified Chinese/);
  assert.ok(request.header['x-opencode-session']);
  request.handler({ response: { statusCode: 200 }, data: { choices: [{ message: { content: '你好\n世界' } }] } });
  assert.equal(instance.completion().result.content.text, '你好\n世界');
  assert.equal(instance.completion().result.content.format, 'plain');
});

test('responses request parses output content and honors custom model', () => {
  const instance = setup({ customModel: 'future-model', customProtocol: 'responses' });
  instance.translate();
  const request = instance.request();
  assert.match(request.url, /\/responses$/);
  assert.equal(request.body.model, 'future-model');
  assert.equal(request.body.input, 'Hello\nworld');
  request.handler({ response: { statusCode: 200 }, data: { output: [
    { type: 'reasoning', content: [{ type: 'summary_text', text: 'ignore' }] },
    { type: 'message', content: [{ type: 'output_text', text: '你好' }] }
  ] } });
  assert.equal(instance.completion().result.content.text, '你好');
});

test('messages request uses Anthropic auth and parses text blocks', () => {
  const instance = setup({ model: 'minimax-m3' });
  instance.translate();
  const request = instance.request();
  assert.match(request.url, /\/messages$/);
  assert.equal(request.header['x-api-key'], 'test-key');
  assert.equal(request.header['anthropic-version'], '2023-06-01');
  assert.equal(request.header.Authorization, undefined);
  assert.equal(request.body.max_tokens, 4096);
  request.handler({ response: { statusCode: 200 }, data: { content: [
    { type: 'thinking', thinking: 'ignore' }, { type: 'text', text: '你好' }
  ] } });
  assert.equal(instance.completion().result.content.text, '你好');
});

test('missing key and invalid custom model fail before network request', () => {
  for (const options of [{ apiKey: '' }, { customModel: 'opencode-go/bad' }]) {
    const instance = setup(options);
    instance.translate();
    assert.equal(instance.request(), undefined);
    assert.ok(instance.completion().error.message);
  }
});

test('HTTP failures and empty output produce actionable errors without secrets', () => {
  for (const status of [401, 403, 404, 429, 503]) {
    const instance = setup();
    instance.translate();
    instance.request().handler({ response: { statusCode: status }, data: {} });
    assert.ok(instance.completion().error.message);
    assert.ok(!JSON.stringify(instance.completion()).includes('test-key'));
  }
  const instance = setup();
  instance.translate();
  instance.request().handler({ response: { statusCode: 200 }, data: { choices: [] } });
  assert.match(instance.completion().error.message, /未返回译文/);
});

test('original text and selected languages are used when provided', () => {
  const instance = setup();
  instance.query.originalText = 'Line 1\n\nLine 2';
  instance.query.from = 'ja';
  instance.query.to = 'fr';
  instance.translate();
  assert.equal(instance.request().body.messages[1].content, 'Line 1\n\nLine 2');
  assert.match(instance.request().body.messages[0].content, /Japanese to French/);
});
