import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Stocks
  app.get("/api/stocks", async (req, res) => {
    try {
      const symbols = ["^KS11", "005930.KS", "000660.KS", "005380.KS", "035420.KS", "005490.KS"];
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote = (await yahooFinance.quote(symbol)) as any;
            
            // Fetch historical data for the last 7 days
            const chartData = (await yahooFinance.chart(symbol, {
              period1: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              interval: "1h"
            })) as any;

            const history = chartData.quotes
              .map((q: any) => q.close)
              .filter((val: any): val is number => val !== null && val !== undefined);

            return {
              id: symbol,
              name: quote.shortName || symbol,
              price: quote.regularMarketPrice || 0,
              prevPrice: quote.regularMarketPreviousClose || 0,
              history: history,
              risk: symbol === "^KS11" ? "LOW" : "MEDIUM"
            };
          } catch (e) {
            console.error(`Error fetching ${symbol}:`, e);
            return null;
          }
        })
      );

      const filteredResults = results.filter(r => r !== null);
      res.json(filteredResults);
    } catch (error) {
      console.error("Stock API Error:", error);
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
