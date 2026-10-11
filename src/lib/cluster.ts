/** Deterministic k-means + the multi-creator trend rule. Pure code, no network. */

export type ClusterItem = { id: string; channelId: string; vec: number[] };

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

// Small seeded PRNG so results are reproducible.
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function kmeans(vecs: number[][], k: number, seed = 42, iters = 50): number[] {
  const n = vecs.length;
  k = Math.min(k, n);
  const rand = rng(seed);
  // k-means++ init
  const centroids: number[][] = [vecs[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const d = vecs.map((v) => Math.min(...centroids.map((c) => dist2(v, c))));
    const total = d.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < n - 1; idx++) {
      r -= d[idx];
      if (r <= 0) break;
    }
    centroids.push(vecs[idx].slice());
  }
  let assign = new Array<number>(n).fill(0);
  for (let it = 0; it < iters; it++) {
    let changed = false;
    assign = vecs.map((v, i) => {
      let best = 0, bd = Infinity;
      centroids.forEach((c, ci) => {
        const dd = dist2(v, c);
        if (dd < bd) { bd = dd; best = ci; }
      });
      if (best !== assign[i]) changed = true;
      return best;
    });
    for (let ci = 0; ci < k; ci++) {
      const members = vecs.filter((_, i) => assign[i] === ci);
      if (!members.length) continue;
      centroids[ci] = members[0].map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length);
    }
    if (!changed && it > 0) break;
  }
  return assign;
}

export function silhouette(vecs: number[][], assign: number[]): number {
  const n = vecs.length;
  const ks = [...new Set(assign)];
  if (ks.length < 2) return -1;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const sums = new Map<number, { s: number; c: number }>();
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const e = sums.get(assign[j]) ?? { s: 0, c: 0 };
      e.s += Math.sqrt(dist2(vecs[i], vecs[j]));
      e.c++;
      sums.set(assign[j], e);
    }
    const own = sums.get(assign[i]);
    const a = own && own.c ? own.s / own.c : 0;
    let b = Infinity;
    for (const [c, e] of sums) if (c !== assign[i] && e.c) b = Math.min(b, e.s / e.c);
    total += Math.max(a, b) === 0 || !isFinite(b) ? 0 : (b - a) / Math.max(a, b);
  }
  return total / n;
}

export type Cluster = { id: number; itemIds: string[]; creatorCount: number };

/** A trend REQUIRES multiple different creators: drop clusters with fewer than `minCreators` distinct channels. */
export function filterMultiCreator(items: ClusterItem[], assign: number[], minCreators = 3): Cluster[] {
  const groups = new Map<number, ClusterItem[]>();
  items.forEach((it, i) => groups.set(assign[i], [...(groups.get(assign[i]) ?? []), it]));
  const out: Cluster[] = [];
  for (const [id, members] of groups) {
    const creators = new Set(members.map((m) => m.channelId)).size;
    if (creators >= minCreators) out.push({ id, itemIds: members.map((m) => m.id), creatorCount: creators });
  }
  return out;
}

/** Try k in [3,6]; keep the k with the most surviving multi-creator clusters (capped at 5), tie-break by silhouette. */
export function clusterVideos(items: ClusterItem[], opts: { minCreators?: number; kMin?: number; kMax?: number } = {}) {
  const { minCreators = 3, kMin = 3, kMax = 6 } = opts;
  const vecs = items.map((i) => i.vec);
  let best: { k: number; clusters: Cluster[]; sil: number } | null = null;
  for (let k = kMin; k <= Math.min(kMax, items.length); k++) {
    const assign = kmeans(vecs, k);
    const clusters = filterMultiCreator(items, assign, minCreators);
    const sil = silhouette(vecs, assign);
    const score = Math.min(clusters.length, 5);
    const bestScore = best ? Math.min(best.clusters.length, 5) : -1;
    if (score > bestScore || (score === bestScore && sil > (best?.sil ?? -2))) best = { k, clusters, sil };
  }
  return best ?? { k: 0, clusters: [] as Cluster[], sil: -1 };
}
