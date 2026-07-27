import YahooFinance from 'yahoo-finance2';
// Custom HTTPS Agent was removed as it caused issues and is no longer used in CONFIG.

// Global Config with Agent and Headers
const CONFIG = {
    // req: {
    //     // Inject the custom agent to handle TLS handshake
    //     agent: agent,
    //     timeout: 10000,
    //     headers: {
    //         'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    //         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    //         'Accept-Language': 'en-US,en;q=0.5',
    //         'Connection': 'keep-alive',
    //         'Upgrade-Insecure-Requests': '1',
    //         'Sec-Fetch-Dest': 'document',
    //         'Sec-Fetch-Mode': 'navigate',
    //         'Sec-Fetch-Site': 'none',
    //         'Sec-Fetch-User': '?1'
    //     }
    // },
    suppressNotices: ['ripHistorical', 'yahooSurvey']
};

// Use a global variable to store the instance in development
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForYahoo = global as unknown as { yahooFinance: any };

// Cast default export to any to allow constructor usage if types are wrong/ambiguous
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const YF = YahooFinance as any;

export const yahooFinance = globalForYahoo.yahooFinance || new YF(CONFIG);

if (process.env.NODE_ENV !== 'production') {
    globalForYahoo.yahooFinance = yahooFinance;
}

