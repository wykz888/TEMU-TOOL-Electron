// 打包/启动前自动 Git 备份
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return '';
  }
}

// 检查是否有变更，没有变更就跳过
const status = run('git status --porcelain');
if (!status) {
  console.log('[Git备份] 没有变更，跳过提交。');
  process.exit(0);
}

// 获取当前时间作为备份标签
const now = new Date();
const timeStr = now.toISOString().replace('T', ' ').slice(0, 19);

try {
  run('git add -A');
  const commitMsg = `备份：${timeStr}`;
  run(`git commit -m "${commitMsg}"`);
  console.log(`[Git备份] ✓ 已提交：${commitMsg}`);
} catch (err) {
  console.error('[Git备份] 提交失败：', err.message);
  process.exit(1);
}
