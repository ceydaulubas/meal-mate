import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const image = 'public.ecr.aws/supabase/postgres:17.11.0.018';
const baseline = '0e416b7';
const oldLast = '20261113143300_guard_membership_updates.sql';

// No shell interpolation. Docker and the Supabase CLI receive the same pinned
// environment; context inspection itself never contacts a Docker daemon.
export function run(command, args, { env = process.env, input, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stream) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stream) process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') reject(error);
    });
    child.on('close', (code, signal) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          Object.assign(new Error(`${command} ${args[0]} failed (${signal ?? code})\n${stderr}`), {
            stderr,
            stdout,
          }),
        );
    });
    child.stdin.end(input);
  });
}

export function validateEndpoint(endpoint) {
  // Intentionally accept only local Unix sockets, including Docker Desktop.
  // Even loopback TCP could be a tunnel to remote infrastructure.
  if (typeof endpoint !== 'string' || !endpoint.startsWith('unix:///')) {
    throw new Error('Refusing Docker endpoint: only local unix:/// sockets are supported.');
  }
  const url = new URL(endpoint);
  if (url.hostname || url.search || url.hash || url.pathname === '/') {
    throw new Error('Refusing invalid local Docker socket URL.');
  }
  return endpoint;
}

export async function localDockerEnvironment(env = process.env, execute = run) {
  if (env.DOCKER_HOST) validateEndpoint(env.DOCKER_HOST);
  const clean = { ...env };
  delete clean.DOCKER_HOST;
  delete clean.DOCKER_CONTEXT;
  delete clean.DOCKER_TLS_VERIFY;
  delete clean.DOCKER_TLS;
  delete clean.DOCKER_CERT_PATH;
  const context =
    env.DOCKER_CONTEXT || (await execute('docker', ['context', 'show'], { env: clean })).trim();
  const contextHost = JSON.parse(
    await execute(
      'docker',
      ['context', 'inspect', context, '--format', '{{json .Endpoints.docker.Host}}'],
      { env: clean },
    ),
  );
  validateEndpoint(contextHost);
  return { ...clean, DOCKER_HOST: validateEndpoint(env.DOCKER_HOST || contextHost) };
}

export async function withContainer(
  docker,
  name,
  work,
  { simulateStartupFailure = false, report = console.error } = {},
) {
  let id;
  let failure;
  try {
    // create allocates only our container and its anonymous volumes. Record its
    // identity before start can fail; never clean up by a reusable name.
    id = (
      await docker([
        'create',
        '--name',
        name,
        ...(simulateStartupFailure ? ['--entrypoint', '/meal-mate-simulated-missing-command'] : []),
        '--publish',
        '127.0.0.1:5432:5432',
        '--env',
        'POSTGRES_PASSWORD=isolated-local-test-only',
        image,
      ])
    ).trim();
    assert.match(id, /^[a-f0-9]{64}$/, 'Docker did not return a container ID');
    await docker(['start', id]);
    if (simulateStartupFailure) throw new Error('Simulated startup unexpectedly succeeded');
    await work(id);
  } catch (error) {
    failure = error;
  } finally {
    if (id && /^[a-f0-9]{64}$/.test(id)) {
      try {
        await docker(['rm', '--force', '--volumes', id]);
        console.log(`PASS: cleaned up owned container ${id}`);
      } catch (error) {
        const message = `Cleanup failed for owned container ${id}: ${error.message}`;
        if (failure) report(message);
        else failure = new Error(message, { cause: error });
      }
    }
  }
  if (failure) throw failure;
}

async function requireFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(5432, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  // Docker start remains authoritative if another process wins this race.
}

async function rehearse(docker, env, id) {
  const sql = (database, input, user = 'postgres') =>
    docker(['exec', '-i', id, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database], {
      input,
    });
  for (let attempt = 0; ; attempt++) {
    try {
      await docker([
        'exec',
        id,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-p',
        '5432',
        '-t',
        '1',
        '-U',
        'postgres',
      ]);
      break;
    } catch (error) {
      if (attempt >= 59) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const [info] = JSON.parse(await docker(['inspect', id]));
  assert.equal(info.NetworkSettings.Ports['5432/tcp'][0].HostIp, '127.0.0.1');
  const bootstrap = await docker([
    'exec',
    id,
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '--schema-only',
    '--schema=auth',
    '--schema=extensions',
  ]);
  await sql('postgres', 'create database task02_upgrade;');
  await sql('task02_upgrade', bootstrap, 'supabase_admin');
  const migrations = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const [index, name] of migrations.entries()) {
    console.log(`Fresh apply: ${name}`);
    await sql(
      'postgres',
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'),
    );
    if (index === 0) {
      await sql(
        'postgres',
        `do $$ begin
        if exists (select 1 from pg_class where oid in
          ('public.profiles'::regclass, 'public.spaces'::regclass, 'public.space_members'::regclass)
          and not relrowsecurity) then raise exception 'Unprotected initial table'; end if;
        if has_table_privilege('anon', 'public.profiles', 'SELECT')
          or has_table_privilege('authenticated', 'public.spaces', 'INSERT')
          or has_table_privilege('authenticated', 'public.space_members', 'UPDATE')
          then raise exception 'Unsafe initial grants'; end if;
        end $$;`,
      );
      console.log('PASS: initial migration commits RLS and restricted ACLs');
    }
  }
  const suites = async (database) => {
    console.log(`Running pgTAP against isolated ${database}`);
    // Only the new container's network namespace and generated loopback URL.
    await run(
      'pnpm',
      [
        'test:db',
        '--yes',
        '--network-id',
        `container:${id}`,
        '--db-url',
        `postgresql://postgres:isolated-local-test-only@127.0.0.1:5432/${database}`,
      ],
      { env, stream: true },
    );
  };
  const commitChecks = async (database) => {
    const user = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const space = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await sql(
      database,
      `insert into auth.users (id, email) values ('${user}', 'commit-check@example.com');`,
    );
    // A psql marker proves the invalid operation succeeded before COMMIT failed.
    const rejectedCommit = async (operation) => {
      await assert.rejects(
        sql(database, `begin; ${operation}\n\\echo before-commit\ncommit;`),
        (error) =>
          error.stdout.includes('before-commit') &&
          error.stderr.includes('must have exactly one OWNER'),
      );
    };
    await rejectedCommit(
      `insert into public.spaces (name, type, created_by) values ('Ownerless', 'SHARED', '${user}');`,
    );
    await sql(
      database,
      `begin;
      insert into public.spaces (id, name, type, created_by) values ('${space}', 'With owner', 'SHARED', '${user}');
      insert into public.space_members (space_id, user_id, role) values ('${space}', '${user}', 'OWNER'); commit;`,
    );
    await rejectedCommit(`delete from public.space_members where space_id = '${space}';`);
    await sql(database, `begin; delete from auth.users where id = '${user}'; commit;`);
    console.log('PASS: deferred OWNER failures and account deletion checked at COMMIT');
  };
  await suites('postgres');
  await commitChecks('postgres');
  for (const name of migrations.filter((name) => name <= oldLast)) {
    await sql(
      'task02_upgrade',
      await run('git', ['show', `${baseline}:supabase/migrations/${name}`], { env }),
    );
  }
  const user = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  await sql(
    'task02_upgrade',
    `insert into auth.users (id, email) values ('${user}', 'upgrade@example.com');`,
  );
  const snapshot = async () => {
    const rows = [];
    for (const table of ['profiles', 'spaces', 'space_members']) {
      rows.push(
        await sql(
          'task02_upgrade',
          `copy (select row_to_json(t) from public.${table} t order by t.id) to stdout;`,
        ),
      );
    }
    return rows;
  };
  const before = await snapshot();
  for (const name of migrations.filter((name) => name > oldLast)) {
    console.log(`Upgrade apply: ${name}`);
    await sql(
      'task02_upgrade',
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'),
    );
  }
  assert.deepEqual(await snapshot(), before, 'Upgrade changed existing identity/space rows');
  console.log('PASS: upgrade preserves deterministically ordered existing data');
  await sql('task02_upgrade', `delete from auth.users where id = '${user}';`);
  await suites('task02_upgrade');
  await commitChecks('task02_upgrade');
  console.log('PASS: fresh and historical upgrade rehearsals');
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--simulate-startup-failure') || args.length > 1)
    throw new Error('Usage: node scripts/test-db-isolated.mjs [--simulate-startup-failure]');
  const env = await localDockerEnvironment();
  const docker = (args, options = {}) =>
    run('docker', ['--host', env.DOCKER_HOST, ...args], { ...options, env });
  await requireFreePort();
  await withContainer(
    docker,
    `meal-mate-hardening-${randomUUID()}`,
    (id) => rehearse(docker, env, id),
    {
      simulateStartupFailure: args.includes('--simulate-startup-failure'),
    },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
