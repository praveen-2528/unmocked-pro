const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('./database');

const IMAP_USER = process.env.IMAP_USER || 'your-email@gmail.com';
const IMAP_PASS = process.env.IMAP_PASS || 'your-app-password';

const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: IMAP_USER,
        pass: IMAP_PASS
    },
    logger: false
});

async function processMessage(msg) {
    try {
        const parsed = await simpleParser(msg.source);
        
        const text = parsed.text || '';
        // Extract JSON block that contains a date and schedule
        const jsonMatch = text.match(/\{[\s\S]*"schedule"[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[0]);
                if (data.date && data.schedule) {
                    console.log(`[EmailSync] Found valid daily update for ${data.date}`);
                    
                    db.run(`
                        INSERT INTO daily_updates (date, content)
                        VALUES (?, ?)
                        ON CONFLICT(date) DO UPDATE SET content = excluded.content, created_at = CURRENT_TIMESTAMP
                    `, [data.date, JSON.stringify(data)], (err) => {
                        if (err) console.error('[EmailSync] DB Error:', err.message);
                        else console.log('[EmailSync] Successfully saved daily update.');
                    });
                }
            } catch(e) {
                console.error('[EmailSync] Failed to parse JSON block:', e.message);
            }
        }
    } catch(e) {
        console.error('[EmailSync] Error processing message:', e.message);
    }
}

async function fetchUnreadEmails() {
    try {
        let lock = await client.getMailboxLock('INBOX');
        try {
            console.log('[EmailSync] Checking for unread emails...');
            for await (let message of client.fetch({ unseen: true }, { source: true, uid: true })) {
                await processMessage(message);
                await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);
            }
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error('[EmailSync] Fetch error:', err.message);
    }
}

async function startDaemon() {
    if (IMAP_USER === 'your-email@gmail.com') {
        console.log('[EmailSync] Missing IMAP_USER/IMAP_PASS environment variables. Skipping daemon.');
        return;
    }
    
    try {
        await client.connect();
        console.log('[EmailSync] Connected to IMAP server.');
        
        await fetchUnreadEmails();
        
        // Polling fallback every 30 mins
        setInterval(() => {
            fetchUnreadEmails();
        }, 30 * 60 * 1000);
        
        // IDLE notification
        client.on('exists', () => {
             console.log('[EmailSync] New email detected via IDLE!');
             fetchUnreadEmails();
        });

    } catch(err) {
        console.error('[EmailSync] Connection error:', err.message);
        setTimeout(startDaemon, 5 * 60 * 1000); // retry
    }
}

module.exports = { startDaemon };
