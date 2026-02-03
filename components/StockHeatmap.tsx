"use client";

import { useEffect, useRef, memo } from "react";

function StockHeatmap() {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!container.current) return;

        // Check if script already exists to avoid duplication
        if (container.current.querySelector("script")) return;

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "exchanges": [],
            "dataSource": "SPX500",
            "grouping": "sector",
            "blockSize": "market_cap_basic",
            "blockColor": "change",
            "locale": "en",
            "symbolUrl": "",
            "colorTheme": "dark",
            "hasTopBar": false,
            "isDataSetEnabled": false,
            "isZoomEnabled": true,
            "hasSymbolTooltip": true,
            "width": "100%",
            "height": "100%"
        });

        container.current.appendChild(script);
    }, []);

    return (
        <div className="w-full h-[500px] mb-8 relative z-0">
            <div className="tradingview-widget-container w-full h-full" ref={container}>
                <div className="tradingview-widget-container__widget w-full h-full"></div>
                <div className="tradingview-widget-copyright text-center text-xs text-gray-500 mt-2">
                    <a href="https://www.tradingview.com/" rel="noopener noreferrer" target="_blank" className="hover:text-blue-500 transition-colors">
                        Track all markets on TradingView
                    </a>
                </div>
            </div>
        </div>
    );
}

export default memo(StockHeatmap);
