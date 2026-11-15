import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@folioagent/shared";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type Theme = "dark" | "light";

const themeTokens = [
  { name: "--background", label: "Canvas" },
  { name: "--surface", label: "Surface" },
  { name: "--surface-elevated", label: "Elevated" },
  { name: "--border", label: "Border" },
  { name: "--text", label: "Text" },
  { name: "--text-muted", label: "Muted" },
  { name: "--primary", label: "Primary" },
  { name: "--positive", label: "Positive" },
  { name: "--negative", label: "Negative" },
  { name: "--warning", label: "Warning" },
];

const chartTokens = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];

const holdings = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    shares: "18.50",
    value: "8240.16",
    change: "0.0312",
    up: true,
    color: "--chart-1",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    shares: "12.00",
    value: "5280.42",
    change: "0.0148",
    up: true,
    color: "--chart-2",
  },
  {
    ticker: "COST",
    name: "Costco Wholesale",
    shares: "6.00",
    value: "4410.88",
    change: "-0.0094",
    up: false,
    color: "--chart-3",
  },
];

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  if (new URLSearchParams(window.location.search).get("theme") === "light") return "light";
  return window.localStorage.getItem("folioagent-theme") === "light" ? "light" : "dark";
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {number}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
      </div>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function TokenSwatch({ token, label, value }: { token: string; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-3">
      <div
        aria-hidden="true"
        className="mb-3 h-11 rounded-lg border border-border/70"
        style={{ backgroundColor: `var(${token})` }}
      />
      <p className="truncate text-xs font-medium text-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{value || token}</p>
    </div>
  );
}

function Sparkline({ up }: { up: boolean }) {
  const points = up
    ? "1,18 12,15 22,16 33,9 43,12 54,5 65,8 78,2"
    : "1,4 12,7 22,5 33,12 43,9 54,17 65,14 78,21";

  return (
    <svg aria-hidden="true" className="h-7 w-20" viewBox="0 0 80 24" fill="none">
      <polyline
        points={points}
        stroke={`var(${up ? "--positive" : "--negative"})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function DesignSystemPage() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("folioagent-theme", theme);

    const computed = getComputedStyle(root);
    setTokenValues(
      Object.fromEntries(
        [...themeTokens.map(({ name }) => name), ...chartTokens].map((token) => [
          token,
          computed.getPropertyValue(token).trim().toUpperCase(),
        ]),
      ),
    );
  }, [theme]);

  const switchTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        href="#main-content"
      >
        Skip to content
      </a>

      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-offset-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Activity aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">
                FolioAgent
              </span>
              <span className="block text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Design system
              </span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden border-border text-muted-foreground sm:inline-flex"
            >
              DEV ONLY
            </Badge>
            <Button
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-pressed={theme === "light"}
              className="h-11 w-11 rounded-xl"
              onClick={switchTheme}
              size="icon"
              variant="outline"
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-[1440px] space-y-12 px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
      >
        <section id="top" className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr] lg:items-start">
          <div className="flex flex-col justify-center rounded-2xl border border-border bg-surface px-6 py-8 sm:px-9 sm:py-10">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/12 text-primary hover:bg-primary/12">
                FOUNDATIONS / 01
              </Badge>
              <span className="text-xs text-muted-foreground">Illustrative interface preview</span>
            </div>
            <h1 className="max-w-[15ch] text-4xl leading-[1.08] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-[3.6rem]">
              Calm, deliberate, and exact.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              A clear view of what you own, how it is moving, and where the data came from. Built
              for investors who want context without noise.
            </p>
            <nav aria-label="Design system sections" className="mt-7 flex flex-wrap gap-2">
              {[
                ["palette", "Color tokens"],
                ["type", "Typography"],
                ["components", "Components"],
                ["states", "States"],
              ].map(([id, label]) => (
                <a
                  className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  href={`#${id}`}
                  key={id}
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <Card className="flex flex-col border-border bg-surface p-1 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardDescription className="text-xs font-semibold tracking-[0.12em] uppercase">
                    Portfolio value
                  </CardDescription>
                  <CardTitle className="mt-3 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                    {formatCurrency("124680.42")}
                  </CardTitle>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface-elevated text-primary">
                  <CircleDollarSign aria-hidden="true" className="size-5" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive/10 px-2.5 py-1 text-sm font-semibold text-positive">
                  <ArrowUpRight aria-hidden="true" className="size-4" />+{formatPercent("0.0185")}
                </span>
                <span className="text-sm text-muted-foreground">
                  +{formatCurrency("2264.18")} today
                </span>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
                <span className="text-muted-foreground">Illustrative values</span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-positive" />
                  End-of-day data
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="palette" aria-labelledby="palette-heading">
          <SectionHeading
            number="01 / Color"
            title="Quiet surfaces. Clear signals."
            description="The navy canvas gives portfolio data room to breathe. Teal anchors actions; gains, losses, and risk keep their own readable contrast."
          />
          <Card className="border-border bg-surface">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle id="palette-heading" className="text-base">
                  Semantic palette
                </CardTitle>
                <CardDescription className="mt-1">
                  Theme-aware CSS variables, shared by every component.
                </CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0 border-border text-muted-foreground">
                {theme === "dark" ? "DARK / DEFAULT" : "LIGHT"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {themeTokens.map(({ name, label }) => (
                  <TokenSwatch
                    key={name}
                    token={name}
                    label={label}
                    value={tokenValues[name] ?? ""}
                  />
                ))}
              </div>
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Chart series
                  </p>
                  <p className="text-xs text-muted-foreground">Six distinct hues</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {chartTokens.map((token, index) => (
                    <div
                      className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-2.5 py-2"
                      key={token}
                    >
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(${token})` }}
                      />
                      <span className="truncate text-xs text-muted-foreground">
                        Series {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="type" aria-labelledby="type-heading">
          <SectionHeading
            number="02 / Type and figures"
            title="Readable labels. Aligned numbers."
            description="One typeface keeps the interface calm. Tabular figures make values scan cleanly across cards, tables, and tooltips."
          />
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle id="type-heading" className="text-base">
                  Geist / one family
                </CardTitle>
                <CardDescription>Use weight and spacing to set hierarchy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b border-border pb-4">
                  <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Display / 36
                  </p>
                  <p className="mt-2 text-3xl leading-tight font-semibold tracking-[-0.035em]">
                    A portfolio in focus.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Heading / 20
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">Holdings overview</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Body / 14
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Small details make large numbers easier to trust.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="text-base">Numeric rhythm</CardTitle>
                <CardDescription>Tabular figures + explicit direction.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total gain</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      +{formatCurrency("1842.76")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-positive">
                    <ArrowUpRight aria-hidden="true" className="size-4" /> +
                    {formatPercent("0.0624")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Day change</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      −{formatCurrency("324.10")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-negative">
                    <ArrowDownRight aria-hidden="true" className="size-4" /> −
                    {formatPercent("0.0081")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="components" aria-labelledby="components-heading">
          <SectionHeading
            number="03 / Components"
            title="A small, dependable toolkit."
            description="Each control has clear labels, visible focus, and a restrained response. Try the theme switch, modal, tabs, and toast."
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle id="components-heading" className="text-base">
                  Actions and status
                </CardTitle>
                <CardDescription>Buttons, badges, and accessible feedback.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="duration-150">
                    Primary action <ArrowRight aria-hidden="true" />
                  </Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Quiet</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-positive/12 text-positive hover:bg-positive/12">
                    <ArrowUpRight aria-hidden="true" /> +3.12%
                  </Badge>
                  <Badge className="bg-negative/12 text-negative hover:bg-negative/12">
                    <ArrowDownRight aria-hidden="true" /> −0.94%
                  </Badge>
                  <Badge variant="outline" className="border-warning/40 text-warning">
                    Review data
                  </Badge>
                  <Badge variant="secondary">End of day</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => toast.success("Your changes are saved.")}
                    variant="outline"
                  >
                    <Check aria-hidden="true" /> Show success toast
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Open dialog preview</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Remove this holding?</DialogTitle>
                        <DialogDescription>
                          This preview shows the confirmation pattern. Your portfolio data is not
                          changed here.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          onClick={() => toast.info("Preview only — no holding was changed.")}
                        >
                          Confirm preview
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="text-base">Input and tabs</CardTitle>
                <CardDescription>Labels stay visible when values are entered.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="design-ticker">
                    Ticker symbol
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="design-ticker"
                      autoComplete="off"
                      placeholder="Search by ticker or company"
                      defaultValue="NVDA"
                    />
                    <Button aria-label="Search ticker" className="shrink-0" size="icon">
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Use a US-listed ticker symbol.</p>
                </div>
                <Tabs defaultValue="overview">
                  <TabsList aria-label="Preview data tabs">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="overview"
                    className="rounded-lg border border-border bg-surface-elevated p-3 text-sm text-muted-foreground"
                  >
                    Current holdings and cached end-of-day prices.
                  </TabsContent>
                  <TabsContent
                    value="history"
                    className="rounded-lg border border-border bg-surface-elevated p-3 text-sm text-muted-foreground"
                  >
                    Historical values are labeled as a backtest of current holdings.
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface xl:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Holdings table</CardTitle>
                  <CardDescription className="mt-1">
                    Illustrative rows · numeric columns align right · cards below 640px.
                  </CardDescription>
                </div>
                <Button variant="outline" className="hidden shrink-0 sm:inline-flex">
                  View all <ChevronRight aria-hidden="true" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="hidden sm:block">
                  <Table>
                    <caption className="sr-only">
                      Illustrative sample holdings and daily changes
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Market value</TableHead>
                        <TableHead className="text-right">Day change</TableHead>
                        <TableHead className="text-right">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((holding) => (
                        <TableRow key={holding.ticker}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-primary-foreground"
                                style={{ backgroundColor: `var(${holding.color})` }}
                              >
                                {holding.ticker.slice(0, 1)}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold text-foreground">
                                  {holding.ticker}
                                </span>
                                <span className="block max-w-52 truncate text-xs text-muted-foreground">
                                  {holding.name}
                                </span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {holding.shares}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(holding.value)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center justify-end gap-1 text-sm font-medium tabular-nums ${holding.up ? "text-positive" : "text-negative"}`}
                            >
                              {holding.up ? (
                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                              ) : (
                                <ArrowDownRight aria-hidden="true" className="size-3.5" />
                              )}
                              {holding.up ? "+" : "−"}
                              {formatPercent(holding.change.replace("-", ""))}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex justify-end">
                              <Sparkline up={holding.up} />
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 sm:hidden">
                  {holdings.map((holding) => (
                    <article
                      className="rounded-xl border border-border bg-surface-elevated p-3"
                      key={holding.ticker}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-primary-foreground"
                            style={{ backgroundColor: `var(${holding.color})` }}
                          >
                            {holding.ticker.slice(0, 1)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">{holding.ticker}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {holding.name}
                            </span>
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">
                            {formatCurrency(holding.value)}
                          </p>
                          <p
                            className={`mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums ${holding.up ? "text-positive" : "text-negative"}`}
                          >
                            {holding.up ? (
                              <ArrowUpRight aria-hidden="true" className="size-3.5" />
                            ) : (
                              <ArrowDownRight aria-hidden="true" className="size-3.5" />
                            )}
                            {holding.up ? "+" : "−"}
                            {formatPercent(holding.change.replace("-", ""))}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                        <span>{holding.shares} shares</span>
                        <Sparkline up={holding.up} />
                      </div>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="states" aria-labelledby="states-heading">
          <SectionHeading
            number="04 / Screen states"
            title="Useful before the data arrives."
            description="Loading, empty, and error states use the same surface system and give people a clear next action."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border bg-surface">
              <CardHeader className="pb-3">
                <Badge variant="outline" className="w-fit border-border text-muted-foreground">
                  LOADING
                </Badge>
                <CardTitle className="pt-1 text-base">Loading your portfolio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                Structure stays stable while values load.
              </CardFooter>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader className="pb-3">
                <Badge variant="outline" className="w-fit border-border text-muted-foreground">
                  EMPTY
                </Badge>
                <CardTitle className="pt-1 text-base">A clear first step</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-36 flex-col items-start justify-center">
                <span className="mb-3 grid size-10 place-items-center rounded-xl border border-border bg-surface-elevated text-primary">
                  <CircleDollarSign aria-hidden="true" className="size-5" />
                </span>
                <p className="text-sm font-medium">Your portfolio starts with one holding.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Add a ticker and share count to see the full picture.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => toast.info("Holdings entry will be available in the next phase.")}
                  size="sm"
                >
                  Add a holding <ArrowRight aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader className="pb-3">
                <Badge variant="outline" className="w-fit border-negative/40 text-negative">
                  ERROR
                </Badge>
                <CardTitle className="pt-1 text-base">A useful recovery</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-36 flex-col items-start justify-center">
                <span className="mb-3 grid size-10 place-items-center rounded-xl border border-negative/25 bg-negative/10 text-negative">
                  <CircleAlert aria-hidden="true" className="size-5" />
                </span>
                <p className="text-sm font-medium">We couldn’t load this panel.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Your saved holdings are safe. Try again in a moment.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => toast.success("Retry requested.")}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Try again
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" /> Research support, not
            financial advice.
          </p>
          <p>All portfolio values on this page are illustrative.</p>
        </footer>
      </main>
      <Toaster theme={theme} position="bottom-right" />
    </div>
  );
}
