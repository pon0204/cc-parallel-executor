const { spawn } = require('child_process');
const path = require('path');

console.log('Starting servers...');

// Start Socket.IO server
const socketServer = spawn('node', ['server-simple.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  detached: false
});

console.log('Socket.IO server started, waiting for it to be ready...');

// Wait for Socket.IO server to start
setTimeout(() => {
  console.log('Starting Next.js server...');
  
  // Start Next.js server
  const nextServer = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    detached: false,
    shell: true
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\nShutting down servers...');
    socketServer.kill();
    nextServer.kill();
    process.exit();
  });
  
  process.on('SIGTERM', () => {
    socketServer.kill();
    nextServer.kill();
    process.exit();
  });
  
}, 2000);