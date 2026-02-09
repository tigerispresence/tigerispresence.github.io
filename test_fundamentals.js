const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function testFundamentals() {
    try {
        const symbol = 'AAPL';
        console.log(`Testing fundamentalsTimeSeries for ${symbol}...`);

        if (typeof yahooFinance.fundamentalsTimeSeries === 'function') {
            try {
                // The 'type' parameter likely needs specific keys.
                // Examples from other sources suggest 'quarterlyTotalRevenue' etc. are correct.
                // But the error "option type invalid" suggests one of the strings is wrong or the format is wrong.
                // Let's try just one type first to isolate.

                // Also, 'module' param seems required by schema but maybe it's implicitly 'fundamentalsTimeSeries'? 
                // The previous error "Missing required properties: module" happened when I omitted it.
                // So I must include it.

                // Let's try 'annualTotalRevenue' as a simpler test.

                const result = await yahooFinance.fundamentalsTimeSeries(symbol, {
                    period1: '2015-01-01',
                    module: 'fundamentalsTimeSeries',
                    type: 'quarterlyTotalRevenue'
                });
                console.log("Result (fundamentalsTimeSeries):", JSON.stringify(result, null, 2));

            } catch (e) {
                console.error("Method call failed:", e.message);
                if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
            }
        } else {
            console.log("Method fundamentalsTimeSeries does NOT exist on instance.");
        }

    } catch (e) {
        console.error("Global Error:", e);
    }
}

testFundamentals();
