import { Stock } from "../types";

export const updateStockPrices = (stocks: Stock[]): Stock[] => {
  return stocks.map((stock) => {
    let changePercent = 0;
    if (stock.risk === "HIGH") {
      // ±30~50%
      changePercent = (Math.random() * 0.2 + 0.3) * (Math.random() > 0.5 ? 1 : -1);
    } else if (stock.risk === "MEDIUM") {
      // ±5~15%
      changePercent = (Math.random() * 0.1 + 0.05) * (Math.random() > 0.5 ? 1 : -1);
    } else {
      // ±1~3%
      changePercent = (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1);
    }

    const newPrice = Math.max(1, Math.floor(stock.price * (1 + changePercent)));
    const newHistory = [...stock.history, newPrice].slice(-10); // Keep last 10
    
    return {
      ...stock,
      prevPrice: stock.price,
      price: newPrice,
      history: newHistory,
    };
  });
};
