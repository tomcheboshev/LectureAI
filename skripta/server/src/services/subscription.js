// Central plan definitions. Keep this the single source of truth for what
// each plan allows — routes and the frontend both read from here (the
// frontend gets a copy via GET /api/auth/me).
export const PLAN_LIMITS = {
  free: {
    maxPackages: 10,
    maxFilesPerPackage: 3,
    maxFileSizeMB: 25,
    maxChatMessagesPerPackage: 25,
    watermark: true,
    priority: 0,
  },
  pro: {
    maxPackages: Infinity,
    maxFilesPerPackage: 20,
    maxFileSizeMB: 100,
    maxChatMessagesPerPackage: Infinity,
    watermark: false,
    priority: 1,
  },
  enterprise: {
    maxPackages: Infinity,
    maxFilesPerPackage: 50,
    maxFileSizeMB: 250,
    maxChatMessagesPerPackage: Infinity,
    watermark: false,
    priority: 2,
  },
};

export function planLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

// Serializable plan info for the frontend (Infinity doesn't survive JSON).
export function planLimitsForClient(plan) {
  const limits = planLimits(plan);
  return Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v === Infinity ? null : v]));
}

export function upgradeError(reason, message, extra = {}) {
  const err = new Error(message);
  err.status = 402;
  err.userFacing = true;
  err.upgradeRequired = true;
  err.reason = reason;
  Object.assign(err, extra);
  return err;
}
