import { spawn } from 'child_process';

console.log('🚀 Starting Claude Code Terminal with Bun...');

// BunでPTYサーバーを起動（unbufferバージョン）
const bunPath = process.env.HOME + '/.bun/bin/bun';
const ptyServer = spawn(bunPath, ['server-unbuffer-bun.js'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

console.log('Bun PTY server starting...');

// 2秒待ってからNext.jsを起動（Next.jsは引き続きNode.jsで）
setTimeout(() => {
  console.log('Starting Next.js...');
  
  const nextServer = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });
  
  // プロセス終了時の処理
  const cleanup = () => {
    console.log('\nShutting down...');
    ptyServer.kill();
    nextServer.kill();
    process.exit();
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
}, 2000);