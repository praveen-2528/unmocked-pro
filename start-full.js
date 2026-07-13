const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting UnMocked Platform (Frontend, Backend, and Cloudflare Tunnel)...');

// Helper to run a command and prefix its output
function runCommand(command, args, cwd, prefix, color) {
  const child = spawn(command, args, { cwd, shell: true });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim().length > 0);
    lines.forEach(line => {
      console.log(`${color}[${prefix}] ${line}\x1b[0m`);
      
      // If this is the tunnel process, look for the Cloudflare URL
      if (prefix === 'TUNNEL' && line.includes('.trycloudflare.com')) {
        const urlMatch = line.match(/(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/);
        if (urlMatch) {
          const tunnelUrl = urlMatch[1];
          console.log(`\n\x1b[42m\x1b[30m 🎉 TUNNEL READY: ${tunnelUrl} \x1b[0m\n`);
          
          // Write the URL to frontend/public/tunnel.json
          const tunnelFilePath = path.join(__dirname, 'frontend', 'public', 'tunnel.json');
          // Ensure public directory exists
          const publicDir = path.dirname(tunnelFilePath);
          if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
          }
          fs.writeFileSync(tunnelFilePath, JSON.stringify({ url: tunnelUrl }));
        }
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim().length > 0);
    lines.forEach(line => {
      console.error(`\x1b[31m[${prefix} ERROR] ${line}\x1b[0m`);
    });
  });

  child.on('close', (code) => {
    console.log(`\x1b[33m[${prefix}] Process exited with code ${code}\x1b[0m`);
  });

  return child;
}

// Clear any existing tunnel.json
const tunnelFilePath = path.join(__dirname, 'frontend', 'public', 'tunnel.json');
if (fs.existsSync(tunnelFilePath)) {
  fs.unlinkSync(tunnelFilePath);
}

// Run Backend
runCommand('node', ['server.js'], path.join(__dirname, 'backend'), 'BACKEND', '\x1b[36m'); // Cyan

// Run Frontend
runCommand('npm', ['run', 'dev'], path.join(__dirname, 'frontend'), 'FRONTEND', '\x1b[32m'); // Green

// Run Tunnel (delay slightly to let frontend start)
setTimeout(() => {
  const envVars = Object.assign({}, process.env, { UNTUN_ACCEPT_CLOUDFLARE_NOTICE: '1' });
  const child = spawn('npx', ['untun@latest', 'tunnel', 'http://localhost:5173', '--accept-cloudflare-notice'], { cwd: __dirname, shell: true, env: envVars });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim().length > 0);
    lines.forEach(line => {
      console.log(`\x1b[35m[TUNNEL] ${line}\x1b[0m`);
      if (line.includes('.trycloudflare.com')) {
        const urlMatch = line.match(/(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/);
        if (urlMatch) {
          const tunnelUrl = urlMatch[1];
          console.log(`\n\x1b[42m\x1b[30m 🎉 TUNNEL READY: ${tunnelUrl} \x1b[0m\n`);
          const tunnelFilePath = path.join(__dirname, 'frontend', 'public', 'tunnel.json');
          const publicDir = path.dirname(tunnelFilePath);
          if (!fs.existsSync(publicDir)) { fs.mkdirSync(publicDir, { recursive: true }); }
          fs.writeFileSync(tunnelFilePath, JSON.stringify({ url: tunnelUrl }));
        }
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim().length > 0);
    lines.forEach(line => {
      console.error(`\x1b[31m[TUNNEL ERROR] ${line}\x1b[0m`);
    });
  });

  child.on('close', (code) => {
    console.log(`\x1b[33m[TUNNEL] Process exited with code ${code}\x1b[0m`);
  });
}, 2000);
