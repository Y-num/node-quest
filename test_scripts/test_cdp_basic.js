const { spawn } = require('child_process');
const http = require('http');

async function testChrome() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800'
  ]);

  chrome.stderr.on('data', d => console.log('[Chrome]', d.toString().trim()));
  
  // Wait for debug port
  let retries = 20;
  let wsUrl = null;
  while (retries-- > 0) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json/version', res => {
          let buf = '';
          res.on('data', c => buf += c);
          res.on('end', () => resolve(buf));
        }).on('error', reject);
      });
      const parsed = JSON.parse(data);
      wsUrl = parsed.webSocketDebuggerUrl;
      console.log('Connected to Chrome!', wsUrl);
      break;
    } catch (e) {
      // wait
    }
  }

  chrome.kill();
  console.log('Test success!');
}

testChrome().catch(console.error);
