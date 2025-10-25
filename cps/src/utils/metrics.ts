const counters: Record<string, number> = {
  provisions: 0,
  revokes: 0,
  rotates: 0,
  provision_failures: 0,
  revoke_failures: 0,
  rotate_failures: 0,
};

export function inc(metric: keyof typeof counters, by = 1) {
  counters[metric] = (counters[metric] || 0) + by;
}

export function getMetrics() {
  return { ...counters };
}
