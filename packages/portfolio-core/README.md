# Portfolio core

This package contains synchronous, pure portfolio calculations. It performs no
database, filesystem, or network I/O. Numeric inputs use the shared
`ExactDecimalValue` type (`Decimal | string`); numeric outputs are decimal.js
values. Percentages are fractions: `0.25` represents 25%, matching
`formatPercent` in `packages/shared`.

## Inputs and validation

`Holding` has an exact `ticker`, `shares`, `avgCost`, optional nullable
`sector`, and optional `tags`. Callers must normalize ticker case before
calling the package; core compares tickers exactly as given. Duplicate ticker
strings in one holdings array throw a `RangeError`.

Every holding must have finite shares greater than zero and finite `avgCost`
that is non-negative. A price map must contain an own property for each exact
ticker string. A missing, null, or undefined price throws a `RangeError`; a
finite zero price is valid and a negative price is rejected. Empty holdings
need no prices.

The package uses a private decimal.js clone configured to 50 significant
digits and `ROUND_HALF_EVEN`; it does not change decimal.js global settings.
Core does not explicitly round or quantize results to currency or display
precision. Repeating divisions are represented to the clone's configured
precision. Inputs and outputs remain decimal values; callers choose display
rounding in formatting code.

## Metrics

| Function                                             | Definition and return value                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `portfolioValue(holdings, prices)`                   | Sum of `shares × current price`. An empty portfolio returns decimal zero.                                                                                                                                                                                                                                                                                                                                        |
| `dayChange(holdings, currentPrices, previousPrices)` | `amount = current portfolio value − previous portfolio value`; `percent = amount ÷ previous portfolio value`, as a fraction. Returns `{ amount, percent }`; `percent` is `null` when the previous value is zero.                                                                                                                                                                                                 |
| `gainLoss(holdings, prices)`                         | `amount = current portfolio value − cost basis`; cost basis is `sum(shares × avgCost)`. `percent = amount ÷ cost basis`, as a fraction; it is `null` when cost basis is zero.                                                                                                                                                                                                                                    |
| `allocationByPosition(holdings, prices)`             | One `{ ticker, value, percent }` per holding, with `percent = position value ÷ total portfolio value`. Returns `[]` for no holdings and `null` percentages when total value is zero. Results are sorted by exact ticker string.                                                                                                                                                                                  |
| `allocationBySector(holdings, prices)`               | Groups market value by sector and returns `{ sector, value, percent }`; a `null` sector groups holdings with a missing sector. Percentages use total portfolio value. Returns `[]` when empty and `null` percentages when total value is zero. Named sectors sort lexically and the null group sorts last.                                                                                                       |
| `largestPosition(holdings, prices)`                  | The position with the greatest market value, as a position allocation. Returns `null` when empty. Ties use exact ticker string order.                                                                                                                                                                                                                                                                            |
| `sectorConcentration(holdings, prices)`              | The known sector with the greatest value, as a sector allocation. The null/unknown sector group is excluded from candidates; its value is not redistributed. The percentage denominator is the full portfolio value. Returns `null` for an empty/all-zero portfolio or when no holding has a known sector. Ties use lexical sector order.                                                                        |
| `dailyReturns(values)`                               | For each adjacent pair, simple return `(current ÷ prior) − 1`, as a fraction. Fewer than two values return `[]`. Values must be finite and non-negative; a zero prior value throws rather than dividing by zero. A zero current value yields `-1` (−100%).                                                                                                                                                       |
| `annualizedVolatility(returns)`                      | Sample standard deviation of daily fractional returns multiplied by `sqrt(252)`: `sqrt(sum((return − mean)²) ÷ (n − 1)) × sqrt(252)`. Fewer than two returns return `null`; thus fewer than three price/value points cannot produce a volatility estimate.                                                                                                                                                       |
| `maxDrawdown(values)`                                | Maximum positive peak-to-trough decline `(peak − trough) ÷ peak` over the ordered non-negative value series. Fewer than two values return `null`. Zero peaks are skipped and never used as a denominator; if no positive peak occurs, the result is zero.                                                                                                                                                        |
| `runScenario(holdings, prices, changes)`             | Applies each matching ticker or tag percentage to the position's current market value. Returns `{ currentValue, scenarioValue, absoluteChange, percentChange, allocationByPosition, allocationBySector }`. Allocations are based on scenario values. `percentChange` is a fraction relative to current value, or `null` if current value is zero. An empty changes array leaves value and allocations unchanged. |

## Scenario matching

Scenario changes are fractional: `-1` is −100% and `0.1` is +10%. Exactly
`-1` is allowed; values below `-1` throw a `RangeError`. A position can match
multiple rules—for example, a ticker rule and one or more tag rules—and each
matching rule is applied once by multiplying the current scenario value by
`1 + changePercent`. Thus +10% and +20% compound to `1.1 × 1.2 = 1.32`. A
duplicate tag string in a holding does not cause the same rule to apply twice.
Ticker and tag matches are exact string comparisons.

## Tests

Run all project tests from the repository root with `pnpm test`. The fixture
and property tests live beside the implementation in `src/index.test.ts`.
