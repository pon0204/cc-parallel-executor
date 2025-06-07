const { spawn } = require('child_process');

console.log('Starting Claude Code Terminal...');

// PTYサーバーを起動（unbufferバージョン）
const ptyServer = spawn('node', ['server-unbuffer.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

console.log('PTY server starting...');

// 2秒待ってからNext.jsを起動
setTimeout(() => {
  console.log('Starting Next.js...');
  
  const nextServer = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
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