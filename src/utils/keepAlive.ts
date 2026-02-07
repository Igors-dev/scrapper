import https from 'https'
export default function keepAlive() {
    selfPing()
    setInterval(selfPing, 14 * 60 * 1000)
}
function selfPing() {
    const url = `https://scrapper-smy6.onrender.com`;
    https.get(url, (res) => {
        // console.log(`Self-ping OK: ${res.statusCode}`);
    }).on('error', (e) => {
        console.error('Self-ping failed:', e.message);
    });
}