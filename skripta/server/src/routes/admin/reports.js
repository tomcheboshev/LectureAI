import { Router } from "express";
import User from "../../models/User.js";
import Invoice from "../../models/Invoice.js";
import AiUsage from "../../models/AiUsage.js";
import AdminActionLog from "../../models/AdminActionLog.js";
import { sendCsv } from "../../utils/csv.js";

const router = Router();

async function logExport(req, reportName) {
  await AdminActionLog.create({ admin: req.user._id, action: "report_exported", targetType: "Report", targetId: null, detail: { report: reportName } });
}

// GET /api/admin/reports/users.csv
router.get("/users.csv", async (req, res) => {
  await logExport(req, "users");
  await sendCsv(
    res,
    "users.csv",
    [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "plan", header: "Plan" },
      { key: "role", header: "Role" },
      { key: "banned", header: "Banned" },
      { key: "subscriptionStatus", header: "Subscription Status" },
      { key: "createdAt", header: "Created At" },
    ],
    User.find({}, "name email plan role banned subscriptionStatus createdAt").cursor()
  );
});

// GET /api/admin/reports/revenue.csv — paid invoices
router.get("/revenue.csv", async (req, res) => {
  await logExport(req, "revenue");
  await sendCsv(
    res,
    "revenue.csv",
    [
      { key: "createdAt", header: "Date" },
      { key: "owner", header: "Owner User ID" },
      { key: "amountUsd", header: "Amount (USD)" },
      { key: "status", header: "Status" },
      { key: "stripeInvoiceId", header: "Stripe Invoice ID" },
    ],
    (async function* () {
      const cursor = Invoice.find({ status: "paid" }, "createdAt owner amountPaid status stripeInvoiceId").cursor();
      for await (const inv of cursor) {
        yield { createdAt: inv.createdAt.toISOString(), owner: inv.owner, amountUsd: (inv.amountPaid / 100).toFixed(2), status: inv.status, stripeInvoiceId: inv.stripeInvoiceId };
      }
    })()
  );
});

// GET /api/admin/reports/ai-usage.csv
router.get("/ai-usage.csv", async (req, res) => {
  await logExport(req, "ai-usage");
  await sendCsv(
    res,
    "ai-usage.csv",
    [
      { key: "createdAt", header: "Date" },
      { key: "owner", header: "Owner User ID" },
      { key: "kind", header: "Kind" },
      { key: "model", header: "Model" },
      { key: "totalTokens", header: "Total Tokens" },
      { key: "estimatedCostUsd", header: "Estimated Cost (USD)" },
    ],
    AiUsage.find({}, "createdAt owner kind model totalTokens estimatedCostUsd").cursor()
  );
});

export default router;
