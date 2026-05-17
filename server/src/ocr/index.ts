import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  type Block,
} from '@aws-sdk/client-textract';
import type { RawTransaction } from '../ai';
import logger from '../utils/logger';

const textract = new TextractClient({ region: 'ca-central-1' });

const S3_BUCKET = process.env.AWS_S3_BUCKET ?? '';

// ─── Credential guard ─────────────────────────────────────────────────────────

function hasAwsCredentials(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    S3_BUCKET
  );
}

// ─── extractTextFromS3 ────────────────────────────────────────────────────────

/**
 * Uses Textract DetectDocumentText to extract all text from a document stored in S3.
 * Returns all LINE blocks joined with newlines.
 * If AWS credentials are missing (test env), returns empty string.
 */
export async function extractTextFromS3(s3Key: string): Promise<string> {
  if (!hasAwsCredentials()) {
    logger.warn('AWS credentials not configured — skipping Textract OCR', { s3Key });
    return '';
  }

  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: S3_BUCKET,
          Name: s3Key,
        },
      },
    });

    const response = await textract.send(command);
    const blocks: Block[] = response.Blocks ?? [];

    const lines = blocks
      .filter((b) => b.BlockType === 'LINE' && b.Text)
      .map((b) => b.Text as string);

    return lines.join('\n');
  } catch (err) {
    logger.error('Textract DetectDocumentText failed', {
      s3Key,
      error: err instanceof Error ? err.message : String(err),
    });
    return '';
  }
}

// ─── extractTablesFromBankStatement ──────────────────────────────────────────

/**
 * Uses Textract AnalyzeDocument with TABLES feature to extract transaction rows
 * from a bank statement stored in S3.
 * Returns RawTransaction[]. If AWS credentials are missing or Textract fails, returns [].
 */
export async function extractTablesFromBankStatement(s3Key: string): Promise<RawTransaction[]> {
  if (!hasAwsCredentials()) {
    logger.warn('AWS credentials not configured — skipping Textract table extraction', { s3Key });
    return [];
  }

  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: S3_BUCKET,
          Name: s3Key,
        },
      },
      FeatureTypes: ['TABLES'],
    });

    const response = await textract.send(command);
    const blocks: Block[] = response.Blocks ?? [];

    return parseTransactionsFromBlocks(blocks);
  } catch (err) {
    logger.error('Textract AnalyzeDocument (TABLES) failed', {
      s3Key,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ─── Table parsing helpers ────────────────────────────────────────────────────

interface CellPosition {
  rowIndex: number;
  colIndex: number;
  text: string;
}

function parseTransactionsFromBlocks(blocks: Block[]): RawTransaction[] {
  // Build a map from block ID → block
  const blockMap = new Map<string, Block>();
  for (const block of blocks) {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  }

  // Collect all CELL blocks with their text
  const cells: CellPosition[] = [];

  for (const block of blocks) {
    if (block.BlockType !== 'CELL') continue;

    const rowIndex = (block.RowIndex ?? 1) - 1;
    const colIndex = (block.ColumnIndex ?? 1) - 1;

    // Gather child WORD text
    const words: string[] = [];
    for (const rel of block.Relationships ?? []) {
      if (rel.Type === 'CHILD') {
        for (const childId of rel.Ids ?? []) {
          const child = blockMap.get(childId);
          if (child?.BlockType === 'WORD' && child.Text) {
            words.push(child.Text);
          }
        }
      }
    }

    cells.push({ rowIndex, colIndex, text: words.join(' ').trim() });
  }

  if (cells.length === 0) return [];

  // Find the max row/col
  const maxRow = Math.max(...cells.map((c) => c.rowIndex));
  const maxCol = Math.max(...cells.map((c) => c.colIndex));

  // Build a 2D grid
  const grid: string[][] = Array.from({ length: maxRow + 1 }, () =>
    Array(maxCol + 1).fill(''),
  );

  for (const cell of cells) {
    grid[cell.rowIndex][cell.colIndex] = cell.text;
  }

  if (grid.length === 0) return [];

  // Detect column headers from row 0
  const headers = grid[0].map((h) => h.toLowerCase());

  const dateColIdx = headers.findIndex((h) => h.includes('date'));
  const descColIdx = headers.findIndex(
    (h) => h.includes('desc') || h.includes('detail') || h.includes('transaction') || h.includes('memo'),
  );
  const debitColIdx = headers.findIndex(
    (h) => h.includes('debit') || h.includes('withdrawal') || h.includes('payment'),
  );
  const creditColIdx = headers.findIndex(
    (h) => h.includes('credit') || h.includes('deposit'),
  );
  const balanceColIdx = headers.findIndex(
    (h) => h.includes('balance') || h.includes('running'),
  );

  const transactions: RawTransaction[] = [];

  // Process data rows (skip header row 0)
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];

    const dateStr = dateColIdx >= 0 ? row[dateColIdx] : '';
    const desc = descColIdx >= 0 ? row[descColIdx] : row.slice(1).join(' ').trim();

    if (!dateStr && !desc) continue; // skip empty rows

    const parseCurrency = (s: string): number | null => {
      if (!s) return null;
      const cleaned = s.replace(/[$, ]/g, '');
      const val = parseFloat(cleaned);
      return isNaN(val) ? null : val;
    };

    const debit = debitColIdx >= 0 ? parseCurrency(row[debitColIdx]) : null;
    const credit = creditColIdx >= 0 ? parseCurrency(row[creditColIdx]) : null;
    const balance = balanceColIdx >= 0 ? parseCurrency(row[balanceColIdx]) : null;

    transactions.push({
      date: dateStr,
      description: desc,
      debit,
      credit,
      balance,
    });
  }

  return transactions;
}
