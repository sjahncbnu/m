import type { RawDatasetRow, RawMotionDataset } from '../types/dataset';

const rowCount = 1000;
const gravity = 9.8;

type DatasetMetadata = Pick<
  RawMotionDataset,
  'difficulty' | 'trueLaw' | 'recommendedTerms' | 'noiseLevel'
>;

type TrajectoryDefinition = DatasetMetadata & {
  id: string;
  name: string;
  description: string;
  motionType: string;
  tStart: number;
  tEnd: number;
  x0: number;
  v0: number;
  noiseSigma: number;
  acceleration: (t: number, x: number, v: number) => number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianNoise(random: () => number) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();

  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function signVelocity(v: number) {
  if (v > 0) {
    return 1;
  }

  if (v < 0) {
    return -1;
  }

  return 0;
}

function generateTrajectoryFromAcceleration({
  tStart,
  tEnd,
  x0,
  v0,
  acceleration,
}: Pick<TrajectoryDefinition, 'tStart' | 'tEnd' | 'x0' | 'v0' | 'acceleration'>) {
  const dt = (tEnd - tStart) / (rowCount - 1);
  const rows: RawDatasetRow[] = [];
  let x = x0;
  let v = v0;

  for (let index = 0; index < rowCount; index += 1) {
    const t = tStart + index * dt;

    rows.push({ t, x });

    if (index === rowCount - 1) {
      break;
    }

    const k1x = v;
    const k1v = acceleration(t, x, v);
    const k2x = v + (dt * k1v) / 2;
    const k2v = acceleration(t + dt / 2, x + (dt * k1x) / 2, v + (dt * k1v) / 2);
    const k3x = v + (dt * k2v) / 2;
    const k3v = acceleration(t + dt / 2, x + (dt * k2x) / 2, v + (dt * k2v) / 2);
    const k4x = v + dt * k3v;
    const k4v = acceleration(t + dt, x + dt * k3x, v + dt * k3v);

    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }

  return rows;
}

function createTrajectoryDataset(definition: TrajectoryDefinition): RawMotionDataset {
  const trueRows = generateTrajectoryFromAcceleration(definition);
  const random = seededRandom(definition.id);

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    motionType: definition.motionType,
    difficulty: definition.difficulty,
    trueLaw: definition.trueLaw,
    recommendedTerms: definition.recommendedTerms,
    noiseLevel: definition.noiseLevel,
    units: {
      t: 's',
      x: 'm',
    },
    rawColumns: ['t', 'x'],
    rawRows: trueRows.map((row) => ({
      t: row.t,
      x: row.x + gaussianNoise(random) * definition.noiseSigma,
    })),
  };
}

const physicsDatasetDefinitions: TrajectoryDefinition[] = [
  {
    id: 'constant-force-motion',
    name: '등가속도 운동',
    description: '일정한 힘을 받아 가속도가 일정한 도입용 운동 데이터입니다.',
    motionType: 'constant-force',
    difficulty: 1,
    tStart: 0,
    tEnd: 5,
    x0: 0,
    v0: 0.4,
    noiseSigma: 0.002,
    noiseLevel: 'weak',
    trueLaw: 'a = F0',
    recommendedTerms: ['1'],
    acceleration: () => 2,
  },
  {
    id: 'fall-linear-drag',
    name: '낙하 + 선형저항',
    description: '아래 방향을 +x로 두고 중력과 속도에 비례하는 선형저항이 작용하는 낙하 데이터입니다.',
    motionType: 'fall-linear-drag',
    difficulty: 2,
    tStart: 0,
    tEnd: 3,
    x0: 0,
    v0: 0,
    noiseSigma: 0.003,
    noiseLevel: 'weak',
    trueLaw: 'a = 9.8 - 1.2*v',
    recommendedTerms: ['1', 'v'],
    acceleration: (_t, _x, v) => gravity - 1.2 * v,
  },
  {
    id: 'simple-spring',
    name: '단순 용수철',
    description: '평형점을 x=0으로 둔 단순 용수철 운동 데이터입니다.',
    motionType: 'simple-spring',
    difficulty: 3,
    tStart: 0,
    tEnd: 10,
    x0: 1,
    v0: 0,
    noiseSigma: 0.002,
    noiseLevel: 'weak',
    trueLaw: 'a = -4*x',
    recommendedTerms: ['x'],
    acceleration: (_t, x) => -4 * x,
  },
  {
    id: 'hanging-spring',
    name: '매달린 용수철',
    description: '중력 때문에 평형점이 원점에서 벗어나는 매달린 용수철 운동 데이터입니다.',
    motionType: 'hanging-spring',
    difficulty: 4,
    tStart: 0,
    tEnd: 10,
    x0: 2.4,
    v0: -0.2,
    noiseSigma: 0.004,
    noiseLevel: 'weak',
    trueLaw: 'a = -3*x + 9.8',
    recommendedTerms: ['x', '1'],
    acceleration: (_t, x) => -3 * x + gravity,
  },
  {
    id: 'viscous-damped-oscillation',
    name: '점성감쇠 진동',
    description: '용수철 복원력과 속도에 비례하는 점성감쇠가 함께 작용하는 진동 데이터입니다.',
    motionType: 'viscous-damped-oscillation',
    difficulty: 5,
    tStart: 0,
    tEnd: 12,
    x0: 1.4,
    v0: -0.35,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -2.2*x - 1.05*v',
    recommendedTerms: ['x', 'v'],
    acceleration: (_t, x, v) => -2.2 * x - 1.05 * v,
  },
  {
    id: 'fall-quadratic-drag',
    name: '낙하 + 이차저항',
    description: '속도의 제곱에 비례하는 공기저항을 받으며 낙하하는 운동 데이터입니다.',
    motionType: 'fall-quadratic-drag',
    difficulty: 6,
    tStart: 0,
    tEnd: 3,
    x0: 0,
    v0: 0,
    noiseSigma: 0.004,
    noiseLevel: 'weak',
    trueLaw: 'a = 9.8 - 0.45*v*abs(v)',
    recommendedTerms: ['1', 'v*abs(v)'],
    acceleration: (_t, _x, v) => gravity - 0.45 * v * Math.abs(v),
  },
  {
    id: 'forced-oscillation',
    name: '강제 진동',
    description: '용수철에 주기적인 외력이 작용하여 공진과 맥놀이를 관찰할 수 있는 데이터입니다.',
    motionType: 'forced-oscillation',
    difficulty: 7,
    tStart: 0,
    tEnd: 16,
    x0: 0.5,
    v0: 0,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.6*x + 2.6*cos(2.4*t)',
    recommendedTerms: ['x', 'cos(2.4*t)'],
    acceleration: (t, x) => -1.6 * x + 2.6 * Math.cos(2.4 * t),
  },
  {
    id: 'spring-coulomb-friction',
    name: '용수철 + 쿨롱 마찰',
    description: '용수철 복원력과 속도 방향에 반대인 쿨롱 마찰이 함께 작용하는 데이터입니다.',
    motionType: 'spring-coulomb-friction',
    difficulty: 8,
    tStart: 0,
    tEnd: 10,
    x0: 0.9,
    v0: 1.0,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.8*x - 1.15*sign(v)',
    recommendedTerms: ['x', 'sign(v)'],
    acceleration: (_t, x, v) => -1.8 * x - 1.15 * signVelocity(v),
  },
  {
    id: 'asymmetric-spring',
    name: '비대칭 용수철',
    description: '위치의 제곱항 때문에 좌우 파형이 비대칭으로 나타나는 용수철 데이터입니다.',
    motionType: 'asymmetric-spring',
    difficulty: 9,
    tStart: 0,
    tEnd: 10,
    x0: 1.25,
    v0: -0.25,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.5*x - 1.8*x^2',
    recommendedTerms: ['x', 'x^2'],
    acceleration: (_t, x) => -1.5 * x - 1.8 * x ** 2,
  },
  {
    id: 'duffing-oscillator',
    name: 'Duffing 진동자',
    description: '세제곱 비선형 강성이 포함되어 진폭에 따라 주파수 특성이 바뀌는 데이터입니다.',
    motionType: 'duffing-oscillator',
    difficulty: 10,
    tStart: 0,
    tEnd: 10,
    x0: 1.25,
    v0: 0,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.4*x - 2.2*x^3',
    recommendedTerms: ['x', 'x^3'],
    acceleration: (_t, x) => -1.4 * x - 2.2 * x ** 3,
  },
  {
    id: 'viscous-coulomb-damping',
    name: '점성 + 쿨롱 감쇠',
    description: '지수 포락선과 직선 포락선 성분이 함께 섞이는 감쇠 진동 데이터입니다.',
    motionType: 'viscous-coulomb-damping',
    difficulty: 11,
    tStart: 0,
    tEnd: 12,
    x0: 0.95,
    v0: 0.9,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.7*x - 0.85*v - 0.95*sign(v)',
    recommendedTerms: ['x', 'v', 'sign(v)'],
    acceleration: (_t, x, v) => -1.7 * x - 0.85 * v - 0.95 * signVelocity(v),
  },
  {
    id: 'van-der-pol-oscillator',
    name: 'Van der Pol 진동자',
    description: '작은 진폭에서는 에너지가 공급되고 큰 진폭에서는 감쇠되는 비선형 진동 데이터입니다.',
    motionType: 'van-der-pol-oscillator',
    difficulty: 12,
    tStart: 0,
    tEnd: 18,
    x0: 0.25,
    v0: 1.1,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.2*x + 1.6*(1 - x^2)*v',
    recommendedTerms: ['x', 'v', 'x^2*v'],
    acceleration: (_t, x, v) => -1.2 * x + 1.6 * (1 - x ** 2) * v,
  },
  {
    id: 'quadratic-drag-oscillation',
    name: '이차저항 진동',
    description: '속도의 제곱에 비례하는 감쇠로 포락선이 쌍곡선 형태에 가깝게 줄어드는 데이터입니다.',
    motionType: 'quadratic-drag-oscillation',
    difficulty: 13,
    tStart: 0,
    tEnd: 12,
    x0: 0.9,
    v0: 1.2,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.8*x - 0.8*v*abs(v)',
    recommendedTerms: ['x', 'v*abs(v)'],
    acceleration: (_t, x, v) => -1.8 * x - 0.8 * v * Math.abs(v),
  },
  {
    id: 'asymmetric-viscous-spring',
    name: '비대칭 + 점성감쇠 용수철',
    description: '좌우 비대칭 파형과 지수 감쇠가 함께 나타나는 용수철 데이터입니다.',
    motionType: 'asymmetric-viscous-spring',
    difficulty: 14,
    tStart: 0,
    tEnd: 12,
    x0: 1.2,
    v0: -0.35,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.3*x - 1.5*x^2 - 0.9*v',
    recommendedTerms: ['x', 'x^2', 'v'],
    acceleration: (_t, x, v) => -1.3 * x - 1.5 * x ** 2 - 0.9 * v,
  },
  {
    id: 'damped-duffing',
    name: 'Duffing + 점성감쇠',
    description: '비선형 강성과 점성감쇠가 결합된 Duffing형 감쇠 진동 데이터입니다.',
    motionType: 'damped-duffing',
    difficulty: 15,
    tStart: 0,
    tEnd: 12,
    x0: 1.2,
    v0: -0.2,
    noiseSigma: 0.005,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.2*x - 2.0*x^3 - 0.8*v',
    recommendedTerms: ['x', 'x^3', 'v'],
    acceleration: (_t, x, v) => -1.2 * x - 2 * x ** 3 - 0.8 * v,
  },
  {
    id: 'forced-duffing',
    name: 'Duffing + 강제진동',
    description: '세제곱 비선형 강성과 주기적 외력이 함께 작용하는 Duffing 진동 데이터입니다.',
    motionType: 'forced-duffing',
    difficulty: 16,
    tStart: 0,
    tEnd: 16,
    x0: 0.75,
    v0: 0,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.2*x - 1.5*x^3 + 2.2*cos(2.2*t)',
    recommendedTerms: ['x', 'x^3', 'cos(2.2*t)'],
    acceleration: (t, x) => -1.2 * x - 1.5 * x ** 3 + 2.2 * Math.cos(2.2 * t),
  },
  {
    id: 'damped-forced-duffing',
    name: 'Duffing + 점성감쇠 + 강제진동',
    description: '비선형 공진 분석에 적합한 강제 Duffing 진동자 데이터입니다.',
    motionType: 'damped-forced-duffing',
    difficulty: 17,
    tStart: 0,
    tEnd: 18,
    x0: 0.75,
    v0: -0.25,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.2*x - 1.5*x^3 - 0.75*v + 2.2*cos(2.2*t)',
    recommendedTerms: ['x', 'x^3', 'v', 'cos(2.2*t)'],
    acceleration: (t, x, v) => -1.2 * x - 1.5 * x ** 3 - 0.75 * v + 2.2 * Math.cos(2.2 * t),
  },
  {
    id: 'asymmetric-viscous-coulomb',
    name: '비대칭 + 점성 + 쿨롱',
    description: '비대칭성, 지수 감쇠, 직선 감쇠가 함께 나타나는 복합 감쇠 데이터입니다.',
    motionType: 'asymmetric-viscous-coulomb',
    difficulty: 18,
    tStart: 0,
    tEnd: 12,
    x0: 1.1,
    v0: 0.8,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.2*x - 1.4*x^2 - 0.8*v - 0.9*sign(v)',
    recommendedTerms: ['x', 'x^2', 'v', 'sign(v)'],
    acceleration: (_t, x, v) => -1.2 * x - 1.4 * x ** 2 - 0.8 * v - 0.9 * signVelocity(v),
  },
  {
    id: 'asymmetric-quadratic-drag',
    name: '비대칭 + 이차저항',
    description: '비대칭 파형과 쌍곡선형 감쇠 포락선이 함께 나타나는 데이터입니다.',
    motionType: 'asymmetric-quadratic-drag',
    difficulty: 19,
    tStart: 0,
    tEnd: 12,
    x0: 1.1,
    v0: 0.85,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.2*x - 1.4*x^2 - 0.65*v*abs(v)',
    recommendedTerms: ['x', 'x^2', 'v*abs(v)'],
    acceleration: (_t, x, v) => -1.2 * x - 1.4 * x ** 2 - 0.65 * v * Math.abs(v),
  },
  {
    id: 'viscous-quadratic-drag',
    name: '점성 + 이차저항 진동',
    description: '저속에서는 선형저항, 고속에서는 이차저항이 두드러지는 진동 데이터입니다.',
    motionType: 'viscous-quadratic-drag',
    difficulty: 20,
    tStart: 0,
    tEnd: 12,
    x0: 0.9,
    v0: 1.1,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.7*x - 0.75*v - 0.65*v*abs(v)',
    recommendedTerms: ['x', 'v', 'v*abs(v)'],
    acceleration: (_t, x, v) => -1.7 * x - 0.75 * v - 0.65 * v * Math.abs(v),
  },
  {
    id: 'viscous-coulomb-quadratic',
    name: '점성 + 쿨롱 + 이차저항',
    description: '세 감쇠 메커니즘을 함께 포함하여 항 분리가 필요한 진동 데이터입니다.',
    motionType: 'viscous-coulomb-quadratic',
    difficulty: 21,
    tStart: 0,
    tEnd: 12,
    x0: 0.95,
    v0: 1.0,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.6*x - 0.7*v - 0.8*sign(v) - 0.55*v*abs(v)',
    recommendedTerms: ['x', 'v', 'sign(v)', 'v*abs(v)'],
    acceleration: (_t, x, v) => -1.6 * x - 0.7 * v - 0.8 * signVelocity(v) - 0.55 * v * Math.abs(v),
  },
  {
    id: 'asymmetric-duffing-damped',
    name: '비대칭 Duffing형 감쇠 진동',
    description: '비대칭성, 비선형 강성, 점성감쇠가 결합된 Duffing형 데이터입니다.',
    motionType: 'asymmetric-duffing-damped',
    difficulty: 22,
    tStart: 0,
    tEnd: 12,
    x0: 1.15,
    v0: -0.25,
    noiseSigma: 0.006,
    noiseLevel: 'weak',
    trueLaw: 'a = -1.0*x - 1.2*x^2 - 1.7*x^3 - 0.75*v',
    recommendedTerms: ['x', 'x^2', 'x^3', 'v'],
    acceleration: (_t, x, v) => -1.0 * x - 1.2 * x ** 2 - 1.7 * x ** 3 - 0.75 * v,
  },
  {
    id: 'general-combined-model',
    name: '거의 다 넣은 일반 모델',
    description: '여러 효과가 동시에 존재하는 실험 데이터 피팅용 복합 운동 데이터입니다.',
    motionType: 'general-combined-model',
    difficulty: 23,
    tStart: 0,
    tEnd: 14,
    x0: 1.0,
    v0: 0.6,
    noiseSigma: 0.007,
    noiseLevel: 'medium',
    trueLaw:
      'a = -1.0*x - 0.9*x^2 - 1.1*x^3 - 0.65*v - 0.45*v*abs(v) - 0.65*sign(v) + 1.8*cos(2*t)',
    recommendedTerms: ['x', 'x^2', 'x^3', 'v', 'v*abs(v)', 'sign(v)', 'cos(2*t)'],
    acceleration: (t, x, v) =>
      -1.0 * x -
      0.9 * x ** 2 -
      1.1 * x ** 3 -
      0.65 * v -
      0.45 * v * Math.abs(v) -
      0.65 * signVelocity(v) +
      1.8 * Math.cos(2 * t),
  },
];

export const builtInDatasets: RawMotionDataset[] = physicsDatasetDefinitions.map(createTrajectoryDataset);

export const defaultDataset = builtInDatasets[0];
