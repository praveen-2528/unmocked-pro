# UnMocked Pro 🚀

```text
   __  __      __  ___           __          __
  / / / /___  /  |/  /___  _____/ /_  ____  / /
 / / / / __ \\/ /|_/ / __ \\/ ___/ //_// __ \\/ / 
/ /_/ / / / / /  / / /_/ / /__/ ,<  / /_/ / /  
\\____/_/ /_/_/  /_/\\____/\\___/_/|_| \\____/_/   
```

**UnMocked Pro** is an advanced mock testing and test generation platform powered by GenAI with real-time multiplayer lobbies, sectional timings, and smart CSV parsing capabilities.

## ✨ Features

- 🧠 **GenAI Integration**: Generate highly contextual, pattern-matched questions via advanced AI prompt generation.
- ⚡ **Smart CSV Engine**: Flawless, memory-mapped CSV parsing system that gracefully groups reading passages, coding-decoding sets, and complex multi-line math questions into interactive React blocks.
- 🕒 **Sectional Timings**: Robust test engine with segmented, timed sections optimized for competitive exams (e.g. IBPS PO Prelims).
- 🎮 **Multiplayer Test Sessions**: Host live rooms, join via invite codes, and compete with other players in real-time.
- 📈 **Performance Analytics**: Track your progress, review past exams, and analyze your mock history.

## 🚀 Deployment Guide (AWS + PM2)

This repository is structured as a full-stack application (Vite/React Frontend + Node/Express Backend). Follow these steps to deploy it cleanly to an AWS EC2 instance:

### 1. Prerequisites
Ensure your EC2 instance has `Node.js` and `npm` installed. You will also need `pm2`.
\`\`\`bash
npm install -g pm2
\`\`\`

### 2. Clone & Install
\`\`\`bash
git clone https://github.com/praveen-2528/unmocked-pro.git
cd unmocked-pro

# Install root dependencies
npm install

# Install and build frontend
cd frontend
npm install
npm run build

# Install backend dependencies
cd ../backend
npm install
\`\`\`

### 3. Environment Variables
Create a `.env` file in the `backend/` directory:
\`\`\`env
PORT=3001
# Add any other required DB or secret keys here
\`\`\`

### 4. Start with PM2
Start the Express backend via PM2. The Express server serves the frontend static `dist` files!
\`\`\`bash
cd backend
pm2 start server.js --name "unmocked-api"
\`\`\`

### 5. Setup Reverse Proxy (Optional but Recommended)
If you are running on AWS, you should configure Nginx to proxy port 80/443 to your PM2 instance running on port 3001.

\`\`\`nginx
server {
    listen 80;
    server_name your_domain_or_IP;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

### 6. Keep it alive
To ensure PM2 starts the app automatically if the AWS server reboots:
\`\`\`bash
pm2 save
pm2 startup
\`\`\`

## 🛠 Tech Stack
- **Frontend**: React, Vite, React Router, TailwindCSS/Geist UI
- **Backend**: Node.js, Express, Socket.io (for Multiplayer)
- **Deployment**: AWS EC2, PM2
