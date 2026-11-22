const http = require("node:http");

const holdings = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    shares: "12.5",
    avg_cost: "188.25",
    tags: ["core", "ai"],
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology",
    shares: "8",
    avg_cost: "412.60",
    tags: ["growth", "ai"],
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Technology",
    shares: "4",
    avg_cost: "120",
    tags: ["ai"],
  },
  {
    ticker: "KO",
    name: "The Coca-Cola Company",
    sector: "Consumer Staples",
    shares: "30",
    avg_cost: "61.04",
    tags: ["dividend"],
  },
];

const dates = [];
for (let date = new Date("2026-10-23T00:00:00.000Z"); dates.length < 20; date.setUTCDate(date.getUTCDate() + 1)) {
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
    dates.push(date.toISOString().slice(0, 10));
  }
}

const bases = { AAPL: 245, MSFT: 510, NVDA: 178, KO: 69 };
const steps = { AAPL: 0.23, MSFT: 0.37, NVDA: 0.61, KO: 0.11 };
const prices = holdings.map((holding) => {
  const history = dates.map((date, index) => ({
    date,
    close: String(bases[holding.ticker] + index * steps[holding.ticker]),
  }));
  return {
    ticker: holding.ticker,
    latestClose: history[history.length - 1].close,
    previousClose: history[history.length - 2].close,
    asOf: dates[dates.length - 1],
    fetchedAt: "2026-11-20T22:00:00.000Z",
    stale: false,
    history,
  };
});

const server = http.createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(request.url.startsWith("/api/holdings") ? holdings : { prices }));
});

server.listen(4001, "127.0.0.1", () => console.log("Mock API ready on 4001"));
