import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

@Injectable()
export class ReportsExportService {
  toCsv(summary: any): string {
    const lines: string[] = [];

    lines.push("TradPath Report Export");
    lines.push(`Range,${summary.range.from},${summary.range.to}`);
    lines.push("");

    lines.push("Revenue");
    lines.push("Type,Amount");
    lines.push(`One-time,${summary.revenue.oneTime}`);
    lines.push(`Recurring,${summary.revenue.recurring}`);
    lines.push(`Total,${summary.revenue.total}`);
    lines.push("");

    lines.push("MRR Trend");
    lines.push("Month,MRR");
    for (const row of summary.mrrTrend) lines.push(`${row.month},${row.mrr}`);
    lines.push("");

    lines.push("Profit Per Job");
    lines.push("Job Number,Title,Revenue,Labor Cost,Material Cost,Profit,Margin %");
    for (const job of summary.profitPerJob) {
      lines.push(
        `${job.jobNumber},${escape(job.title)},${job.revenue},${job.laborCost},${job.materialCost},${job.profit},${job.marginPercent ?? ""}`,
      );
    }
    lines.push("");

    lines.push("Job Performance");
    lines.push(`Completion Rate %,${summary.completionRate}`);
    lines.push(`Avg Job Value,${summary.avgJobValue}`);
    lines.push("");

    lines.push("Top Customers");
    lines.push("Customer,Total Billed,Invoice Count");
    for (const c of summary.topCustomers) lines.push(`${escape(c.name)},${c.totalBilled},${c.invoiceCount}`);
    lines.push("");

    lines.push("Employee Hours");
    lines.push("Employee,Total Hours,Overtime Hours");
    for (const e of summary.employeeHours) lines.push(`${escape(e.name)},${e.totalHours},${e.overtimeHours}`);
    lines.push("");

    lines.push("AR Aging");
    lines.push("Bucket,Amount");
    lines.push(`Current,${summary.arAging.buckets.current}`);
    lines.push(`1-30 days,${summary.arAging.buckets.days1to30}`);
    lines.push(`31-60 days,${summary.arAging.buckets.days31to60}`);
    lines.push(`61-90 days,${summary.arAging.buckets.days61to90}`);
    lines.push(`90+ days,${summary.arAging.buckets.days90plus}`);
    lines.push("");

    lines.push("Service Plans");
    lines.push(`MRR,${summary.planGrowthChurn.mrr}`);
    lines.push(`ARR,${summary.planGrowthChurn.arr}`);
    lines.push(`Active Plans,${summary.planGrowthChurn.activeCount}`);
    lines.push(`New Plans in Range,${summary.planGrowthChurn.newPlansInRange}`);
    lines.push(`Churned (Last 30 Days),${summary.planGrowthChurn.churnedLast30Days}`);
    lines.push("");

    lines.push("Booking Conversion");
    lines.push(`Total Requests,${summary.bookingConversion.total}`);
    lines.push(`Confirmed,${summary.bookingConversion.confirmed}`);
    lines.push(`Conversion Rate %,${summary.bookingConversion.conversionRate}`);
    lines.push("");

    lines.push("AI Usage");
    lines.push(`Plan,${summary.aiUsage.plan}`);
    lines.push(`Credits Used,${summary.aiUsage.creditsUsed}`);
    lines.push(`Credits Limit,${summary.aiUsage.creditsLimit ?? "Unlimited"}`);

    return lines.join("\n");
  }

  async toPdf(summary: any, orgName: string): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    doc.fontSize(18).text(orgName);
    doc.fontSize(10).fillColor("#666").text("Business Report");
    doc
      .fontSize(9)
      .text(`${new Date(summary.range.from).toLocaleDateString()} – ${new Date(summary.range.to).toLocaleDateString()}`);
    doc.moveDown();

    const section = (title: string) => {
      doc.fillColor("#000").fontSize(13).text(title);
      doc.moveDown(0.3);
    };
    const row = (label: string, value: string) => {
      doc.fontSize(10).fillColor("#666").text(`${label}: ${value}`);
    };

    section("Revenue");
    row("One-time", `$${summary.revenue.oneTime.toFixed(2)}`);
    row("Recurring", `$${summary.revenue.recurring.toFixed(2)}`);
    row("Total", `$${summary.revenue.total.toFixed(2)}`);
    doc.moveDown();

    section("MRR Trend");
    for (const m of summary.mrrTrend) row(m.month, `$${m.mrr.toFixed(2)}`);
    doc.moveDown();

    section("Job Performance");
    row("Completion rate", `${summary.completionRate}%`);
    row("Avg job value", `$${summary.avgJobValue.toFixed(2)}`);
    doc.moveDown();

    section("Profit Per Job");
    for (const job of summary.profitPerJob.slice(0, 25)) {
      row(
        `#${job.jobNumber} ${job.title}`,
        `revenue $${job.revenue.toFixed(2)} / profit $${job.profit.toFixed(2)}${job.marginPercent !== null ? ` (${job.marginPercent}%)` : ""}`,
      );
    }
    doc.moveDown();

    section("Top Customers");
    for (const c of summary.topCustomers) row(c.name, `$${c.totalBilled.toFixed(2)} across ${c.invoiceCount} invoices`);
    doc.moveDown();

    if (doc.y > 600) doc.addPage();
    section("Employee Hours");
    for (const e of summary.employeeHours) row(e.name, `${e.totalHours}h (${e.overtimeHours}h overtime)`);
    doc.moveDown();

    section("AR Aging");
    row("Current", `$${summary.arAging.buckets.current.toFixed(2)}`);
    row("1-30 days", `$${summary.arAging.buckets.days1to30.toFixed(2)}`);
    row("31-60 days", `$${summary.arAging.buckets.days31to60.toFixed(2)}`);
    row("61-90 days", `$${summary.arAging.buckets.days61to90.toFixed(2)}`);
    row("90+ days", `$${summary.arAging.buckets.days90plus.toFixed(2)}`);
    doc.moveDown();

    section("Service Plans");
    row("MRR", `$${summary.planGrowthChurn.mrr.toFixed(2)}`);
    row("ARR", `$${summary.planGrowthChurn.arr.toFixed(2)}`);
    row("Active plans", String(summary.planGrowthChurn.activeCount));
    row("New plans in range", String(summary.planGrowthChurn.newPlansInRange));
    row("Churned (last 30 days)", String(summary.planGrowthChurn.churnedLast30Days));
    doc.moveDown();

    section("Booking Conversion");
    row("Requests", String(summary.bookingConversion.total));
    row("Confirmed", String(summary.bookingConversion.confirmed));
    row("Conversion rate", `${summary.bookingConversion.conversionRate}%`);
    doc.moveDown();

    section("AI Usage");
    row("Plan", summary.aiUsage.plan);
    row("Credits used", `${summary.aiUsage.creditsUsed}${summary.aiUsage.creditsLimit !== null ? ` / ${summary.aiUsage.creditsLimit}` : " (unlimited)"}`);

    doc.end();
    return done;
  }
}
