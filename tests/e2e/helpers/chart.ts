import { expect, type Page } from "@playwright/test";

/**
 * Every strength chart on the page (each has a hidden table whose caption
 * ends "strength..."): no label crosses the line, a step, a dot or another
 * label, and every label stays inside the chart's width. Measured from the
 * dots, so it holds for any data.
 */
export async function expectChartLabelsClear(page: Page) {
  // The chart places its labels after measuring itself; give it a frame.
  await page.waitForTimeout(150);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const charts = [...document.querySelectorAll("table")]
      .filter((t) => /strength/i.test(t.caption?.textContent ?? ""))
      .map((t) => t.parentElement!)
      .filter((c) => c.getBoundingClientRect().width > 0);
    for (const chart of charts) {
      const name = chart.querySelector("caption")?.textContent ?? "chart";
      const box = chart.getBoundingClientRect();
      const dots = [...chart.querySelectorAll<HTMLElement>("span.rounded-full")].map((d) => d.getBoundingClientRect());
      const labels = [...chart.querySelectorAll<HTMLElement>("[data-chart-label]")].map((l) => ({
        text: l.textContent ?? "",
        r: l.getBoundingClientRect(),
      }));
      const centre = dots.map((d) => ({ x: d.left + d.width / 2, y: d.top + d.height / 2 }));
      const inner = box.width - 28;
      const n = dots.length;
      type R = { l: number; t: number; r: number; b: number };
      const lines: Array<{ what: string; r: R }> = [];
      centre.forEach((c, i) => {
        const end = box.left + 14 + (inner * (i + 1)) / n;
        lines.push({ what: `line of ${labels[i]?.text}`, r: { l: c.x, t: c.y - 1.25, r: end, b: c.y + 1.25 } });
        lines.push({ what: `dot of ${labels[i]?.text}`, r: { l: dots[i].left, t: dots[i].top, r: dots[i].right, b: dots[i].bottom } });
        if (i > 0 && Math.abs(centre[i - 1].y - c.y) > 0.5) {
          lines.push({
            what: `step into ${labels[i]?.text}`,
            r: { l: c.x - 1.25, t: Math.min(centre[i - 1].y, c.y), r: c.x + 1.25, b: Math.max(centre[i - 1].y, c.y) },
          });
        }
      });
      const hit = (a: R, b: DOMRect) => a.l < b.right - 0.5 && b.left + 0.5 < a.r && a.t < b.bottom - 0.5 && b.top + 0.5 < a.b;
      labels.forEach((lab, i) => {
        if (lab.r.left < box.left - 0.5 || lab.r.right > box.right + 0.5) out.push(`${name}: ${lab.text} leaves the chart`);
        for (const l of lines) if (hit(l.r, lab.r)) out.push(`${name}: label ${i + 1} (${lab.text}) crosses the ${l.what}`);
        labels.forEach((other, j) => {
          if (j > i && hit({ l: other.r.left, t: other.r.top, r: other.r.right, b: other.r.bottom }, lab.r)) {
            out.push(`${name}: labels ${i + 1} and ${j + 1} overlap`);
          }
        });
      });
    }
    return { count: charts.length, out };
  });
  expect(problems.count, "no strength chart on the page").toBeGreaterThan(0);
  expect(problems.out).toEqual([]);
}
