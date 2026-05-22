import type { NeuralInputKey } from '../utils/neuralNetwork';

type NeuralNetworkDiagramProps = {
  inputKeys: NeuralInputKey[];
  hiddenLayers: number[];
  weights?: number[][][];
};

type DiagramNode = {
  x: number;
  y: number;
  label?: string;
  kind: 'input' | 'hidden' | 'output';
};

function getLayerNodes(
  count: number,
  x: number,
  kind: DiagramNode['kind'],
  labels: string[] = [],
) {
  const centerY = 145;
  const spacing = Math.min(58, 180 / Math.max(count - 1, 1));
  const startY = centerY - (spacing * (count - 1)) / 2;

  return Array.from({ length: count }, (_, index) => ({
    x,
    y: startY + spacing * index,
    label: labels[index],
    kind,
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMaxWeight(weights?: number[][][]) {
  const magnitudes = weights?.flatMap((layer) =>
    layer.flatMap((row) => row.map((weight) => Math.abs(weight))),
  );

  return Math.max(...(magnitudes ?? []), 1e-9);
}

function getWeightStyle(weight: number | undefined, maxWeight: number) {
  if (weight === undefined) {
    return { stroke: '#cbd5e1', strokeWidth: 1.5, opacity: 0.75 };
  }

  const magnitude = Math.abs(weight);

  if (magnitude < 1e-6) {
    return { stroke: '#cbd5e1', strokeWidth: 0.5, opacity: 0.55 };
  }

  const ratio = clamp(magnitude / maxWeight, 0, 1);

  return {
    stroke: weight > 0 ? '#2563eb' : '#dc2626',
    strokeWidth: clamp(0.5 + ratio * 4.5, 0.5, 5),
    opacity: 0.35 + ratio * 0.65,
  };
}

export function NeuralNetworkDiagram({ inputKeys, hiddenLayers, weights }: NeuralNetworkDiagramProps) {
  const normalizedInputKeys = inputKeys.length > 0 ? inputKeys : ['x'];
  const layerCount = hiddenLayers.length + 2;
  const gap = 560 / Math.max(layerCount - 1, 1);
  const maxWeight = getMaxWeight(weights);
  const layers: DiagramNode[][] = [
    getLayerNodes(normalizedInputKeys.length, 50, 'input', normalizedInputKeys),
    ...hiddenLayers.map((nodeCount, index) =>
      getLayerNodes(nodeCount, 50 + gap * (index + 1), 'hidden'),
    ),
    getLayerNodes(1, 50 + gap * (layerCount - 1), 'output', ['â']),
  ];

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <svg
        viewBox="0 0 660 300"
        role="img"
        aria-label="신경망 구조 다이어그램"
        className="h-72 w-full"
      >
        {layers.slice(0, -1).flatMap((layer, layerIndex) =>
          layer.flatMap((node, nodeIndex) =>
            layers[layerIndex + 1].map((nextNode, nextNodeIndex) => {
              const style = getWeightStyle(
                weights?.[layerIndex]?.[nodeIndex]?.[nextNodeIndex],
                maxWeight,
              );

              return (
                <line
                  key={`${layerIndex}-${node.x}-${node.y}-${nextNode.x}-${nextNode.y}`}
                  x1={node.x + 18}
                  y1={node.y}
                  x2={nextNode.x - 18}
                  y2={nextNode.y}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  opacity={style.opacity}
                />
              );
            }),
          ),
        )}

        {layers.map((layer, layerIndex) => (
          <g key={`layer-${layerIndex}`}>
            {layer.map((node, nodeIndex) => (
              <g key={`${node.kind}-${layerIndex}-${nodeIndex}`}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.kind === 'output' ? 26 : 20}
                  fill={node.kind === 'output' ? '#dcfce7' : '#dbeafe'}
                  stroke={node.kind === 'output' ? '#22c55e' : '#3b82f6'}
                  strokeWidth="2"
                />
                <text
                  x={node.x}
                  y={node.y + 5}
                  textAnchor="middle"
                  className="fill-slate-800 text-[15px] font-bold"
                >
                  {node.label ?? ''}
                </text>
              </g>
            ))}
          </g>
        ))}

        <text x="50" y="28" textAnchor="middle" className="fill-slate-700 text-[13px] font-bold">
          입력층
        </text>
        {hiddenLayers.map((nodeCount, index) => (
          <text
            key={`hidden-label-${index}`}
            x={50 + gap * (index + 1)}
            y="28"
            textAnchor="middle"
            className="fill-slate-700 text-[13px] font-bold"
          >
            은닉층 {index + 1} ({nodeCount})
          </text>
        ))}
        <text
          x={50 + gap * (layerCount - 1)}
          y="28"
          textAnchor="middle"
          className="fill-slate-700 text-[13px] font-bold"
        >
          출력층
        </text>
        <text
          x={50 + gap * (layerCount - 1)}
          y="238"
          textAnchor="middle"
          className="fill-slate-500 text-[12px] font-semibold"
        >
          NN 예측
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-8 rounded bg-blue-600" />
          양의 가중치
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-8 rounded bg-red-600" />
          음의 가중치
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-8 rounded bg-slate-300" />
          작은 가중치
        </span>
      </div>
    </div>
  );
}
