import YahooFinance from 'yahoo-finance2';
import https from 'https';

// Custom HTTPS Agent to mimic browser TLS behavior (JA3/JA4 fingerprinting bypass)
// This is the Node.js equivalent of using curl_cffi in Python
const agent = new https.Agent({
    keepAlive: true,
    // Modern cipher suite that mimics Chrome/Firefox order to avoid "TLS Fingerprinting" blocks
    ciphers: [
        'TLS_AES_128_GCM_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA'
    ].join(':'),
    honorCipherOrder: true,
    minVersion: 'TLSv1.2'
});

// Global Config with Agent and Headers
const CONFIG = {
    req: {
        // Inject the custom agent to handle TLS handshake
        agent: agent,
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        }
    },
    suppressNotices: ['ripHistorical', 'yahooSurvey'] as any
};

// Use a global variable to store the instance in development
const globalForYahoo = global as unknown as { yahooFinance: any };

// Cast default export to any to allow constructor usage if types are wrong/ambiguous
const YF = YahooFinance as any;

export const yahooFinance = globalForYahoo.yahooFinance || new YF(CONFIG);

if (process.env.NODE_ENV !== 'production') {
    globalForYahoo.yahooFinance = yahooFinance;
}

