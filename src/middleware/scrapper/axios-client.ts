import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';
const jar = new CookieJar();
const httpsAgent = new HttpsCookieAgent({
    cookies: { jar },
    keepAlive: true,
    rejectUnauthorized: false,
});
const httpAgent = new HttpCookieAgent({
    cookies: { jar },
    keepAlive: true,
});
const client = axios.create({ httpsAgent, httpAgent })

export { client, httpsAgent }