const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REMOTE_NAME = 'origin';

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe'
  });
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();

  if (result.error) {
    if (options.allowFailure) {
      return { ok: false, status: -1, stdout, stderr, error: result.error };
    }

    throw result.error;
  }

  if (result.status !== 0) {
    if (options.allowFailure) {
      return { ok: false, status: result.status, stdout, stderr };
    }

    throw new Error(stderr || stdout || `git ${args.join(' ')} failed`);
  }

  return { ok: true, status: 0, stdout, stderr };
}

function getLocalTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds())
  ].join('');
}

function getCurrentBranch() {
  const branch = runGit(['branch', '--show-current']).stdout;

  if (!branch) {
    throw new Error('\u5f53\u524d Git \u5904\u4e8e\u6e38\u79bb HEAD \u72b6\u6001\uff0c\u65e0\u6cd5\u81ea\u52a8\u63a8\u9001\u5230\u4e91\u7aef\u4ed3\u5e93\u3002');
  }

  return branch;
}

function getUpstreamBranch() {
  const result = runGit(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    { allowFailure: true }
  );

  return result.ok ? result.stdout : '';
}

function ensureRemoteExists() {
  const remoteUrl = runGit(['remote', 'get-url', REMOTE_NAME], { allowFailure: true }).stdout;

  if (!remoteUrl) {
    throw new Error(`\u672a\u627e\u5230 ${REMOTE_NAME} \u8fdc\u7a0b\u4ed3\u5e93\uff0c\u65e0\u6cd5\u81ea\u52a8\u63a8\u9001\u3002`);
  }

  return remoteUrl;
}

function fetchRemote() {
  runGit(['fetch', REMOTE_NAME]);
}

function getAheadBehind(upstreamBranch) {
  if (!upstreamBranch) {
    return { ahead: 1, behind: 0 };
  }

  const output = runGit(['rev-list', '--left-right', '--count', `${upstreamBranch}...HEAD`]).stdout;
  const [behindText, aheadText] = output.split(/\s+/);

  return {
    behind: Number.parseInt(behindText, 10) || 0,
    ahead: Number.parseInt(aheadText, 10) || 0
  };
}

function commitWorkingTreeIfNeeded() {
  const status = runGit(['status', '--porcelain']).stdout;

  if (!status) {
    console.log('[Git\u5907\u4efd] \u6ca1\u6709\u5de5\u4f5c\u533a\u6539\u52a8\uff0c\u8df3\u8fc7\u63d0\u4ea4\u3002');
    return '';
  }

  runGit(['add', '-A']);

  const stagedDiff = runGit(['diff', '--cached', '--quiet'], { allowFailure: true });

  if (stagedDiff.status === 0) {
    console.log('[Git\u5907\u4efd] \u6ca1\u6709\u53ef\u63d0\u4ea4\u7684\u6539\u52a8\u3002');
    return '';
  }

  const commitMessage = `\u5907\u4efd\uff1a${getLocalTimestamp()}`;
  runGit(['commit', '-m', commitMessage]);
  console.log(`[Git\u5907\u4efd] \u5df2\u63d0\u4ea4\uff1a${commitMessage}`);
  return commitMessage;
}

function pushBranchIfNeeded(branch) {
  ensureRemoteExists();
  fetchRemote();

  const upstreamBranch = getUpstreamBranch();
  const { ahead, behind } = getAheadBehind(upstreamBranch);

  if (behind > 0) {
    throw new Error(`\u8fdc\u7a0b\u4ed3\u5e93\u6709 ${behind} \u4e2a\u65b0\u63d0\u4ea4\uff0c\u8bf7\u5148\u5408\u5e76\u8fdc\u7a0b\u66f4\u65b0\u540e\u518d\u6253\u5305\u3002`);
  }

  if (ahead <= 0) {
    console.log('[Git\u63a8\u9001] \u672c\u5730\u548c\u4e91\u7aef\u4ed3\u5e93\u5df2\u540c\u6b65\u3002');
    return;
  }

  const pushArgs = upstreamBranch
    ? ['push', REMOTE_NAME, branch]
    : ['push', '-u', REMOTE_NAME, branch];

  runGit(pushArgs);
  console.log(`[Git\u63a8\u9001] \u5df2\u63a8\u9001 ${ahead} \u4e2a\u63d0\u4ea4\u5230 ${REMOTE_NAME}/${branch}\u3002`);
}

function main() {
  const branch = getCurrentBranch();

  commitWorkingTreeIfNeeded();
  pushBranchIfNeeded(branch);
}

try {
  main();
} catch (error) {
  console.error('[Git\u5907\u4efd] \u5931\u8d25\uff1a' + (error && error.message ? error.message : error));
  process.exit(1);
}
