import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localDockerEnvironment, validateEndpoint, withContainer } from './test-db-isolated.mjs';

const id = 'a'.repeat(64);

for (const endpoint of [
  'ssh://remote.example',
  'tcp://remote.example:2376',
  'tcp://127.0.0.1:2375',
  'http://remote.example',
  'unix://remote.example/docker.sock',
]) {
  test(`rejects DOCKER_HOST ${endpoint} before Docker is invoked`, async () => {
    await assert.rejects(
      localDockerEnvironment({ DOCKER_HOST: endpoint }, () => assert.fail('Docker invoked')),
      /Refusing/,
    );
  });
}

test('rejects a remote context before any daemon operation', async () => {
  const calls = [];
  await assert.rejects(
    localDockerEnvironment(
      { DOCKER_CONTEXT: 'remote', DOCKER_HOST: 'unix:///tmp/local.sock' },
      async (command, args) => {
        calls.push([command, args]);
        return JSON.stringify('ssh://remote.example');
      },
    ),
    /Refusing/,
  );
  assert.deepEqual(calls, [
    ['docker', ['context', 'inspect', 'remote', '--format', '{{json .Endpoints.docker.Host}}']],
  ]);
});

test('pins the local endpoint and strips context/TLS overrides', async () => {
  const env = await localDockerEnvironment(
    {
      DOCKER_HOST: 'unix:///tmp/local.sock',
      DOCKER_CONTEXT: 'desktop',
      DOCKER_TLS: '1',
      DOCKER_TLS_VERIFY: '1',
      DOCKER_CERT_PATH: '/certs',
    },
    async (_command, _args, options) => {
      assert.equal(options.env.DOCKER_HOST, undefined);
      assert.equal(options.env.DOCKER_CONTEXT, undefined);
      return JSON.stringify('unix:///tmp/context.sock');
    },
  );
  assert.deepEqual(env, { DOCKER_HOST: 'unix:///tmp/local.sock' });
  assert.equal(validateEndpoint(env.DOCKER_HOST), env.DOCKER_HOST);
});

test('resolves the selected default context locally', async () => {
  const calls = [];
  const env = await localDockerEnvironment({}, async (_command, args) => {
    calls.push(args);
    return args[1] === 'show' ? 'desktop-linux\n' : JSON.stringify('unix:///tmp/docker.sock');
  });
  assert.equal(env.DOCKER_HOST, 'unix:///tmp/docker.sock');
  assert.equal(calls[1][2], 'desktop-linux');
});

test('cleans only the returned owned ID after successful work', async () => {
  const calls = [];
  await withContainer(
    async (args) => {
      calls.push(args);
      return args[0] === 'create' ? `${id}\n` : '';
    },
    'unique',
    async (owned) => assert.equal(owned, id),
  );
  assert.deepEqual(calls.slice(1), [
    ['start', id],
    ['rm', '--force', '--volumes', id],
  ]);
});

test('cleans up when container startup fails', async () => {
  const failure = new Error('startup failed');
  const calls = [];
  await assert.rejects(
    withContainer(
      async (args) => {
        calls.push(args);
        if (args[0] === 'create') return id;
        if (args[0] === 'start') throw failure;
        return '';
      },
      'unique',
      () => assert.fail('work started'),
    ),
    (error) => error === failure,
  );
  assert.deepEqual(calls.at(-1), ['rm', '--force', '--volumes', id]);
});

test('preserves the original error if cleanup also fails', async () => {
  const failure = new Error('original failure');
  const reports = [];
  await assert.rejects(
    withContainer(
      async (args) => {
        if (args[0] === 'create') return id;
        if (args[0] === 'rm') throw new Error('cleanup failure');
        return '';
      },
      'unique',
      async () => {
        throw failure;
      },
      { report: (message) => reports.push(message) },
    ),
    (error) => error === failure,
  );
  assert.match(reports[0], /Cleanup failed for owned container .*: cleanup failure/);
});

test('reports cleanup failure after otherwise successful work', async () => {
  await assert.rejects(
    withContainer(
      async (args) => {
        if (args[0] === 'create') return id;
        if (args[0] === 'rm') throw new Error('cleanup failed');
        return '';
      },
      'unique',
      async () => {},
    ),
    /cleanup failed/,
  );
});

test('does not remove anything when creation fails', async () => {
  const calls = [];
  await assert.rejects(
    withContainer(
      async (args) => {
        calls.push(args);
        throw new Error('create failed');
      },
      'unique',
      () => assert.fail('work started'),
    ),
    /create failed/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'create');
});

test('never removes an untrusted or missing container ID', async () => {
  const calls = [];
  await assert.rejects(
    withContainer(
      async (args) => {
        calls.push(args);
        return 'unrelated-container';
      },
      'unique',
      () => assert.fail('work started'),
    ),
  );
  assert.equal(calls.length, 1);
});
