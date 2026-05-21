import type { DatasetRow, MotionDataset } from '../types/dataset';

const requiredColumns = ['t', 'x', 'v', 'a'] as const;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === ',' && !isQuoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function toNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function parseMotionCsv(text: string, datasetName: string): MotionDataset {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('CSV 파일이 비어 있습니다.');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`필수 열이 없습니다: ${missingColumns.join(', ')}`);
  }

  const columnIndexes = requiredColumns.reduce<Record<(typeof requiredColumns)[number], number>>(
    (indexes, column) => {
      indexes[column] = headers.indexOf(column);
      return indexes;
    },
    { t: -1, x: -1, v: -1, a: -1 },
  );

  const rows = lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const row = requiredColumns.reduce<Partial<DatasetRow>>((currentRow, column) => {
      const numberValue = toNumber(cells[columnIndexes[column]] ?? '');

      if (numberValue === null) {
        throw new Error(`${rowIndex + 2}행의 ${column} 값이 숫자가 아닙니다.`);
      }

      currentRow[column] = numberValue;
      return currentRow;
    }, {});

    return row as DatasetRow;
  });

  if (rows.length === 0) {
    throw new Error('데이터 행이 없습니다.');
  }

  return {
    id: `imported-${Date.now()}`,
    name: datasetName,
    rows,
  };
}
