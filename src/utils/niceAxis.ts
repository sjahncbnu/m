type NiceAxisOptions = {
  targetTickCount?: number;
  includeZero?: boolean | 'auto';
};

export type NiceAxisDomain = {
  min: number;
  max: number;
  ticks: number[];
};

const niceFractions = [1, 2, 2.5, 5, 10];

export function niceNum(range: number, round: boolean) {
  if (!Number.isFinite(range) || range <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  const niceFraction = round
    ? niceFractions.find((candidate) => fraction <= candidate) ?? 10
    : [...niceFractions].reverse().find((candidate) => fraction >= candidate) ?? 1;

  return niceFraction * 10 ** exponent;
}

function shouldIncludeZero(min: number, max: number) {
  if (min <= 0 && max >= 0) {
    return true;
  }

  const range = max - min;

  if (range <= 0) {
    return Math.abs(min) < 1e-9 || Math.abs(max) < 1e-9;
  }

  if (min > 0) {
    return min <= range * 0.2;
  }

  return Math.abs(max) <= range * 0.2;
}

function normalizeZero(value: number) {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function computeNiceTicks(min: number, max: number, targetTickCount = 6) {
  const safeTargetTickCount = Math.max(2, targetTickCount);
  const range = niceNum(max - min, false);
  const step = niceNum(range / (safeTargetTickCount - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  const maxTickCount = 100;

  for (
    let tick = niceMin, index = 0;
    tick <= niceMax + step * 0.5 && index < maxTickCount;
    tick += step, index += 1
  ) {
    ticks.push(normalizeZero(Number(tick.toPrecision(12))));
  }

  return ticks;
}

export function computeNiceAxisDomain(
  values: number[],
  options: NiceAxisOptions = {},
): NiceAxisDomain {
  const finiteValues = values.filter(Number.isFinite);
  const targetTickCount = options.targetTickCount ?? 6;

  if (finiteValues.length === 0) {
    return { min: 0, max: 1, ticks: computeNiceTicks(0, 1, targetTickCount) };
  }

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  const rawRange = max - min;
  const center = (min + max) / 2;
  const nearConstant =
    rawRange <= Math.max(Math.abs(center) * 1e-8, Number.EPSILON * 100);

  if (nearConstant) {
    const padding = Math.max(Math.abs(center) * 0.02, 0.1);
    min = center - padding;
    max = center + padding;
  } else {
    const padding = rawRange * 0.04;
    min -= padding;
    max += padding;
  }

  const includeZero =
    options.includeZero === 'auto' || options.includeZero === undefined
      ? shouldIncludeZero(min, max)
      : options.includeZero;

  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const ticks = computeNiceTicks(min, max, targetTickCount);

  return {
    min: ticks[0] ?? min,
    max: ticks[ticks.length - 1] ?? max,
    ticks,
  };
}

export function formatTick(value: number) {
  if (!Number.isFinite(value)) {
    return '';
  }

  const normalized = Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(10));

  if (
    normalized !== 0 &&
    (Math.abs(normalized) >= 100000 || Math.abs(normalized) < 0.0001)
  ) {
    return normalized.toExponential(2);
  }

  return normalized.toLocaleString('en-US', {
    maximumFractionDigits: 6,
    useGrouping: false,
  });
}
