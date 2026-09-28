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
    $option: { apiKey: 'test-key', model: 'deepseek-v4.1-flash', customModel: '', customProtocol: 'chat', thinkingEffort: 'lowest', ...options },
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
  const endpoints = { chat: 'chat/completions', responses: 'responses', messages: 'messages' };
  for (const entry of menu.menuValues) {
    const selected = setup({ model: entry.value });
    selected.translate();
    assert.ok(selected.request().url.endsWith(`/${endpoints[instance.context.GO_MODELS[entry.value]]}`), entry.value);
  }
});

test('chat request uses Bearer auth and returns plain Bob content', () => {
  const instance = setup();
  instance.translate();
  const request = instance.request();
  assert.match(request.url, /\/chat\/completions$/);
  assert.equal(request.header.Authorization, 'Bearer test-key');
  assert.equal(request.body.messages[1].content, 'Hello\nworld');
  assert.equal(request.body.thinking.type, 'disabled');
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

test('known custom model chooses its documented endpoint without manual routing', () => {
  const instance = setup({ customModel: 'gpt-5.6-luna', customProtocol: 'chat' });
  instance.translate();
  assert.match(instance.request().url, /\/responses$/);
  assert.equal(instance.request().body.reasoning.effort, 'none');
});

test('unlisted custom model uses the selected endpoint', () => {
  const instance = setup({ customModel: 'future-model', customProtocol: 'messages' });
  instance.translate();
  assert.match(instance.request().url, /\/messages$/);
  assert.equal(instance.request().body.model, 'future-model');
});

test('model families use their lowest supported reasoning setting', () => {
  const cases = [
    ['grok-4.7', 'responses', (body) => assert.equal(body.reasoning.effort, 'low')],
    ['gpt-6-luna', 'responses', (body) => assert.equal(body.reasoning.effort, 'none')],
    ['kimi-k3', 'chat/completions', (body) => assert.equal(body.enable_thinking, false)],
    ['glm-5.3-flash', 'chat/completions', (body) => assert.equal(body.reasoning_effort, 'low')],
    ['glm-5.2', 'chat/completions', (body) => assert.equal(body.reasoning_effort, 'low')],
    ['mimo-v2.6-flash', 'chat/completions', (body) => assert.equal(body.thinking.type, 'disabled')],
    ['longcat-2.0', 'chat/completions', (body) => assert.equal(body.thinking.type, 'disabled')],
    ['qwen3.8-max', 'messages', (body) => assert.equal(body.thinking.type, 'disabled')],
    ['minimax-m3', 'messages', (body) => assert.equal(body.thinking, undefined)],
    ['minimax-m2.7', 'messages', (body) => assert.equal(body.thinking, undefined)],
    ['muse-spark-1.3-contributor', 'responses', (body) => assert.equal(body.reasoning, undefined)]
  ];
  for (const [model, endpoint, verify] of cases) {
    const instance = setup({ model });
    instance.translate();
    assert.ok(instance.request().url.endsWith(`/${endpoint}`), model);
    verify(instance.request().body);
  }
});

test('chosen thinking level maps to the supported level for each model', () => {
  const cases = [
    [{ model: 'gpt-5.6-luna', thinkingEffort: 'high' }, (body) => assert.equal(body.reasoning.effort, 'high')],
    [{ model: 'grok-4.7', thinkingEffort: 'max' }, (body) => assert.equal(body.reasoning.effort, 'xhigh')],
    [{ model: 'deepseek-v4.1-flash', thinkingEffort: 'low' }, (body) => assert.equal(body.reasoning_effort, 'low')],
    [{ model: 'deepseek-v4.1-flash', thinkingEffort: 'medium' }, (body) => assert.equal(body.reasoning_effort, 'high')],
    [{ model: 'glm-5.3-flash', thinkingEffort: 'medium' }, (body) => assert.equal(body.reasoning_effort, 'high')],
    [{ model: 'kimi-k3', thinkingEffort: 'high' }, (body) => assert.equal(body.enable_thinking, true)],
    [{ model: 'qwen3.8-max', thinkingEffort: 'medium' }, (body) => assert.equal(body.output_config.effort, 'medium')],
    [{ model: 'qwen3.8-max', thinkingEffort: 'max' }, (body) => assert.equal(body.output_config.effort, 'xhigh')],
    [{ model: 'qwen3.7-max', thinkingEffort: 'low' }, (body) => {
      assert.equal(body.thinking.type, 'enabled');
      assert.equal(body.output_config, undefined);
    }],
    [{ model: 'minimax-m3', thinkingEffort: 'low' }, (body) => assert.equal(body.thinking.type, 'adaptive')],
    [{ model: 'minimax-m2.7', thinkingEffort: 'low' }, (body) => assert.equal(body.thinking, undefined)],
    [{ model: 'gpt-5.6-luna', thinkingEffort: 'auto' }, (body) => assert.equal(body.reasoning, undefined)]
  ];
  for (const [options, verify] of cases) {
    const instance = setup(options);
    instance.translate();
    verify(instance.request().body);
  }
  const bad = setup({ thinkingEffort: 'unsupported' });
  bad.translate();
  assert.match(bad.completion().error.message, /思考等级无效/);
});

test('messages request uses Anthropic auth and parses text blocks', () => {
  const instance = setup({ model: 'minimax-m3' });
  instance.translate();
  const request = instance.request();
  assert.match(request.url, /\/messages$/);
  assert.equal(request.header['x-api-key'], 'test-key');
  assert.equal(request.header['anthropic-version'], '2023-06-01');
  assert.equal(request.header.Authorization, undefined);
  assert.equal(request.body.max_tokens, 8192);
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
  for (const status of [400, 401, 403, 404, 422, 429, 503]) {
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
