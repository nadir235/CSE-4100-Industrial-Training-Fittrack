'use strict';

const DAY_MS = 86_400_000;

/**
 * Extends an existing active membership, or starts a new one now.
 * A member who renews early keeps the days they already paid for.
 */
function computeSubscription(existing, plan, now = Date.now()) {
  const days = Number(plan.durationDays);
  const stillActive = existing && existing.status === 'active' && existing.expiresAt > now;
  const startsAt = stillActive ? existing.startsAt : now;
  const base = stillActive ? existing.expiresAt : now;
  return {
    planId: plan.id,
    planName: plan.name,
    status: 'active',
    startsAt,
    expiresAt: base + days * DAY_MS,
  };
}

module.exports = { computeSubscription, DAY_MS };
