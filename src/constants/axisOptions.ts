import type { AxisOption } from '../types/axis';

export const axisOptions: AxisOption[] = [
  { key: 't', label: '시간 t', unit: 's' },
  { key: 'x', label: '위치 x', unit: 'm' },
  { key: 'v', label: '속도 v', unit: 'm/s' },
  { key: 'a', label: '가속도 a', unit: 'm/s²' },
];

export function getAxisOption(axisKey: AxisOption['key']) {
  return axisOptions.find((option) => option.key === axisKey) ?? axisOptions[0];
}
