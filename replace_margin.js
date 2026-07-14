const fs = require('fs'); 
['Profile.jsx', 'Settings.jsx', 'Leaderboard.jsx', 'Dashboard.jsx'].forEach(file => { 
  const p = 'C:/Users/manus/Desktop/UnMocked - With sectional Timings/frontend/src/pages/' + file; 
  if(fs.existsSync(p)) { 
    let content = fs.readFileSync(p, 'utf8'); 
    content = content.replace(/margin: '40px auto'/g, "margin: '80px auto 60px'");
    content = content.replace(/padding: '40px 20px'/g, "padding: '80px 20px 60px'");
    content = content.replace(/marginBottom: '32px'/g, "marginBottom: '40px'");
    fs.writeFileSync(p, content); 
  } 
});
