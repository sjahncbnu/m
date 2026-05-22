import type { RawDatasetRow, RawMotionDataset } from '../types/dataset';

const rowCount = 1000;

type MotionType = RawMotionDataset['motionType'];

type DatasetMetadata = Pick<
  RawMotionDataset,
  'difficulty' | 'trueLaw' | 'recommendedTerms' | 'noiseLevel'
>;

type DatasetDefinition = DatasetMetadata & {
  id: string;
  name: string;
  description: string;
  motionType: MotionType;
  tStart: number;
  tEnd: number;
  positionAt: (t: number) => number;
  noiseSigma?: number;
  noiseSeed?: string;
};

type TrajectoryDefinition = Omit<DatasetDefinition, 'positionAt'> & {
  x0: number;
  v0: number;
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

function createRows(
  tStart: number,
  tEnd: number,
  positionAt: (t: number) => number,
  noiseSigma = 0,
  noiseSeed = 'no-noise',
) {
  const dt = (tEnd - tStart) / (rowCount - 1);
  const random = seededRandom(noiseSeed);

  return Array.from({ length: rowCount }, (_, index) => {
    const t = tStart + index * dt;
    const noise = noiseSigma > 0 ? gaussianNoise(random) * noiseSigma : 0;

    return {
      t,
      x: positionAt(t) + noise,
    } satisfies RawDatasetRow;
  });
}

function createDataset(definition: DatasetDefinition): RawMotionDataset {
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
    rawRows: createRows(
      definition.tStart,
      definition.tEnd,
      definition.positionAt,
      definition.noiseSigma,
      definition.noiseSeed ?? definition.id,
    ),
  };
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
  const random = seededRandom(definition.noiseSeed ?? definition.id);

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
      x: row.x + gaussianNoise(random) * (definition.noiseSigma ?? 0),
    })),
  };
}

export const freeFallIdealDataset = createDataset({
  id: 'free-fall-ideal',
  name: '자유낙하 운동 - 이상 데이터',
  description:
    '아래 방향을 +x로 둔 단순 자유낙하 이상 데이터입니다. 원본 데이터는 시간 t와 위치 x만 포함합니다.',
  motionType: 'free-fall',
  tStart: 0,
  tEnd: 1,
  noiseLevel: 'none',
  trueLaw: 'a = 9.8',
  recommendedTerms: ['1'],
  positionAt: (t) => 0.5 * 9.8 * t ** 2,
});

export const builtInDatasets: RawMotionDataset[] = [
  freeFallIdealDataset,
  createDataset({
    id: 'free-fall-noisy',
    name: '자유낙하 운동 - 약한 노이즈',
    description: '단순 자유낙하 위치 데이터에 약한 결정론적 노이즈를 추가한 데이터입니다.',
    motionType: 'free-fall-noisy',
    tStart: 0,
    tEnd: 1,
    noiseLevel: 'weak',
    trueLaw: 'a = 9.8',
    recommendedTerms: ['1'],
    positionAt: (t) => 0.5 * 9.8 * t ** 2 + 0.002 * Math.sin(90 * t) + 0.001 * Math.sin(230 * t),
  }),
  createDataset({
    id: 'uniform-motion',
    name: '등속 운동',
    description: '속도가 일정한 등속 운동 데이터입니다. 원본 데이터는 시간 t와 위치 x만 포함합니다.',
    motionType: 'uniform',
    tStart: 0,
    tEnd: 5,
    noiseLevel: 'none',
    trueLaw: 'a = 0',
    recommendedTerms: ['1'],
    positionAt: (t) => 1.5 * t,
  }),
  createDataset({
    id: 'constant-acceleration',
    name: '등가속도 운동',
    description: '가속도가 일정한 운동 데이터입니다. 원본 데이터는 시간 t와 위치 x만 포함합니다.',
    motionType: 'constant-acceleration',
    tStart: 0,
    tEnd: 5,
    noiseLevel: 'none',
    trueLaw: 'a = 2.0',
    recommendedTerms: ['1'],
    positionAt: (t) => 0.5 * t + 0.5 * 2.0 * t ** 2,
  }),
  createDataset({
    id: 'spring-motion',
    name: '용수철 운동',
    description: '단순 조화진동 형태의 용수철 운동 데이터입니다. 원본 데이터는 시간 t와 위치 x만 포함합니다.',
    motionType: 'spring',
    tStart: 0,
    tEnd: 10,
    noiseLevel: 'none',
    trueLaw: 'a = -4*x',
    recommendedTerms: ['x'],
    positionAt: (t) => Math.cos(2 * t),
  }),
  createDataset({
    id: 'weak-noise-constant-acceleration',
    name: '약한 노이즈 등가속도 운동',
    description: '위치 측정에 약한 랜덤 오차가 포함된 등가속도 운동 데이터입니다.',
    motionType: 'constant-acceleration-noisy',
    difficulty: 1,
    tStart: 0,
    tEnd: 5,
    noiseSigma: 0.005,
    noiseSeed: 'weak-noise-constant-acceleration',
    noiseLevel: 'weak',
    trueLaw: 'a = 2.0',
    recommendedTerms: ['1'],
    positionAt: (t) => 0.5 * t + 0.5 * 2.0 * t ** 2,
  }),
  createDataset({
    id: 'medium-noise-free-fall',
    name: '중간 노이즈 자유낙하 운동',
    description: '아래 방향을 +x로 둔 자유낙하 운동에 중간 수준의 위치 측정 오차를 추가한 데이터입니다.',
    motionType: 'medium-noise-free-fall',
    difficulty: 2,
    tStart: 0,
    tEnd: 1.5,
    noiseSigma: 0.01,
    noiseSeed: 'medium-noise-free-fall',
    noiseLevel: 'medium',
    trueLaw: 'a = 9.8',
    recommendedTerms: ['1'],
    positionAt: (t) => 0.5 * 9.8 * t ** 2,
  }),
  createTrajectoryDataset({
    id: 'damped-spring',
    name: '감쇠 용수철 운동',
    description: '복원력과 속도에 비례하는 감쇠가 함께 작용하는 용수철 운동 데이터입니다.',
    motionType: 'damped-spring',
    difficulty: 3,
    tStart: 0,
    tEnd: 12,
    x0: 1,
    v0: 0,
    noiseSigma: 0.01,
    noiseSeed: 'damped-spring',
    noiseLevel: 'medium',
    trueLaw: 'a = -4*x - 0.45*v',
    recommendedTerms: ['x', 'v'],
    acceleration: (_t, x, v) => -4 * x - 0.45 * v,
  }),
  createTrajectoryDataset({
    id: 'nonlinear-spring',
    name: '비선형 용수철 운동',
    description: '복원력이 위치에 대해 선형항과 세제곱항을 함께 갖는 비선형 용수철 데이터입니다.',
    motionType: 'nonlinear-spring',
    difficulty: 4,
    tStart: 0,
    tEnd: 10,
    x0: 1,
    v0: 0,
    noiseSigma: 0.01,
    noiseSeed: 'nonlinear-spring',
    noiseLevel: 'medium',
    trueLaw: 'a = -3*x - 1.2*x^3',
    recommendedTerms: ['x', 'x^3'],
    acceleration: (_t, x) => -3 * x - 1.2 * x ** 3,
  }),
  createTrajectoryDataset({
    id: 'damped-nonlinear-spring',
    name: '감쇠 비선형 용수철 운동',
    description: '선형 복원력, 감쇠항, 비선형 복원력이 함께 포함된 운동 데이터입니다.',
    motionType: 'damped-nonlinear-spring',
    difficulty: 5,
    tStart: 0,
    tEnd: 12,
    x0: 1,
    v0: 0,
    noiseSigma: 0.012,
    noiseSeed: 'damped-nonlinear-spring',
    noiseLevel: 'medium',
    trueLaw: 'a = -3*x - 0.35*v - 1.0*x^3',
    recommendedTerms: ['x', 'v', 'x^3'],
    acceleration: (_t, x, v) => -3 * x - 0.35 * v - x ** 3,
  }),
  createTrajectoryDataset({
    id: 'air-resistance-fall',
    name: '공기저항이 있는 낙하 운동',
    description: '속도의 제곱에 비례하는 공기저항을 받으며 낙하하는 운동 데이터입니다.',
    motionType: 'air-resistance-fall',
    difficulty: 6,
    tStart: 0,
    tEnd: 3,
    x0: 0,
    v0: 0,
    noiseSigma: 0.015,
    noiseSeed: 'air-resistance-fall',
    noiseLevel: 'medium',
    trueLaw: 'a = 9.8 - 0.45*abs(v)*v',
    recommendedTerms: ['1', 'abs(v)*v'],
    acceleration: (_t, _x, v) => 9.8 - 0.45 * Math.abs(v) * v,
  }),
  createTrajectoryDataset({
    id: 'driven-damped-oscillation',
    name: '외력이 있는 감쇠 진동',
    description: '감쇠 진동자에 시간에 따라 변하는 외력이 작용하는 운동 데이터입니다.',
    motionType: 'driven-damped-oscillation',
    difficulty: 7,
    tStart: 0,
    tEnd: 15,
    x0: 0.5,
    v0: 0,
    noiseSigma: 0.012,
    noiseSeed: 'driven-damped-oscillation',
    noiseLevel: 'medium',
    trueLaw: 'a = -4*x - 0.35*v + 1.2*sin(3*t)',
    recommendedTerms: ['x', 'v', 'sin(3*t)'],
    acceleration: (t, x, v) => -4 * x - 0.35 * v + 1.2 * Math.sin(3 * t),
  }),
  createTrajectoryDataset({
    id: 'large-angle-pendulum',
    name: '큰 각도 단진자 운동',
    description: '작은 각도 근사를 사용하기 어려운 큰 각도 단진자 운동 데이터입니다. x는 각도(rad)를 의미합니다.',
    motionType: 'large-angle-pendulum',
    difficulty: 8,
    tStart: 0,
    tEnd: 10,
    x0: 1.1,
    v0: 0,
    noiseSigma: 0.008,
    noiseSeed: 'large-angle-pendulum',
    noiseLevel: 'weak',
    trueLaw: 'a = -9.8*sin(x)',
    recommendedTerms: ['sin(x)'],
    acceleration: (_t, x) => -9.8 * Math.sin(x),
  }),
  createTrajectoryDataset({
    id: 'friction-sliding',
    name: '마찰이 있는 미끄럼 운동',
    description: '마찰과 속도 비례 감쇠가 함께 작용하는 미끄럼 운동 데이터입니다.',
    motionType: 'friction-sliding',
    difficulty: 9,
    tStart: 0,
    tEnd: 5,
    x0: 0,
    v0: 4,
    noiseSigma: 0.01,
    noiseSeed: 'friction-sliding',
    noiseLevel: 'medium',
    trueLaw: 'a = -0.25*9.8*tanh(v/0.05) - 0.15*v',
    recommendedTerms: ['sign(v)', 'v'],
    acceleration: (_t, _x, v) => -0.25 * 9.8 * Math.tanh(v / 0.05) - 0.15 * v,
  }),
  createTrajectoryDataset({
    id: 'piecewise-force',
    name: '구간별 힘 변화 운동',
    description: '시간 구간에 따라 작용하는 힘이 달라지는 어려운 운동 데이터입니다.',
    motionType: 'piecewise-force',
    difficulty: 10,
    tStart: 0,
    tEnd: 6,
    x0: 0,
    v0: 0,
    noiseSigma: 0.015,
    noiseSeed: 'piecewise-force',
    noiseLevel: 'medium',
    trueLaw: 't < 2: a = 2.0, 2 <= t < 4: a = -1.0, t >= 4: a = -0.5*v',
    recommendedTerms: ['1', 'v', 't'],
    acceleration: (t, _x, v) => {
      if (t < 2) {
        return 2;
      }

      if (t < 4) {
        return -1;
      }

      return -0.5 * v;
    },
  }),
];
