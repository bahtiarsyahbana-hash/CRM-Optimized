import * as XLSX from 'xlsx';
import { Client, LineOfBusiness } from '../types';

// Template columns in display order. These match the header row in the generated template.
export const IMPORT_COLUMNS = [
  'Company Name',
  'Line of Business',
  'Business Occupation',
  'Company Address',
  'Asset Detail',
  'Estimated Asset Value (IDR)',
  'Parent Group',
  'PIC Name',
  'PIC Email',
  'PIC Phone',
] as const;

const VALID_LOB: LineOfBusiness[] = ['Manufacture', 'Trading', 'Financial Institution', 'Property', 'Others'];

/** Loose case-insensitive LOB synonyms users tend to write. */
const LOB_SYNONYMS: Record<string, LineOfBusiness> = {
  'manufacture': 'Manufacture',
  'manufacturer': 'Manufacture',
  'manufacturing': 'Manufacture',
  'trading': 'Trading',
  'trade': 'Trading',
  'financial institution': 'Financial Institution',
  'financial': 'Financial Institution',
  'finance': 'Financial Institution',
  'fi': 'Financial Institution',
  'bank': 'Financial Institution',
  'property': 'Property',
  'real estate': 'Property',
  'others': 'Others',
  'other': 'Others',
};

export type ImportableClient = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;

/** A row that parsed cleanly into a valid client. */
export interface ValidRow {
  rowNumber: number; // 1-based row number in the source spreadsheet (header is row 1)
  client: ImportableClient;
  /** If non-null, an existing client with the same companyName (case-insensitive). */
  existingClientId: string | null;
}

/** A row that failed validation and won't be imported. */
export interface InvalidRow {
  rowNumber: number;
  rawCompanyName: string;
  errors: string[];
}

export interface ParseResult {
  valid: ValidRow[];
  invalid: InvalidRow[];
}

// ---------- Template generation ----------------------------------------------

/**
 * Build and trigger a download for an .xlsx template the user fills in.
 * Includes the header row, two example rows, and a notes row at the bottom.
 */
export function downloadImportTemplate(): void {
  const wb = XLSX.utils.book_new();

  const data: (string | number)[][] = [
    // Header
    [...IMPORT_COLUMNS],
    // Example 1
    [
      'PT Maju Jaya',
      'Manufacture',
      'Food and beverage manufacturing',
      'Jl. Industri No. 5, Cikarang, Bekasi',
      'Main factory + 12 production lines',
      50_000_000_000,
      'Jaya Group',
      'Budi Santoso',
      'budi.santoso@majujaya.co.id',
      '+62 21 555 1234',
    ],
    // Example 2
    [
      'CV Sumber Rejeki',
      'Trading',
      'Wholesale textile distribution',
      'Ruko Permata No. 12, Jakarta Utara',
      'Warehouse + delivery fleet (4 trucks)',
      2_500_000_000,
      '',
      'Linda Wijaya',
      'linda@sumberrejeki.co.id',
      '+62 812 9876 5432',
    ],
    // Notes spacer + instructions row
    [],
    ['NOTE: Delete the two example rows above before importing. Required columns: Company Name, Line of Business, Business Occupation.'],
    ['Line of Business must be one of: Manufacture, Trading, Financial Institution, Property, Others.'],
    ['Estimated Asset Value is in IDR. You can leave it blank if unknown.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set sensible column widths so the template is readable when opened
  ws['!cols'] = [
    { wch: 24 }, // Company Name
    { wch: 22 }, // LOB
    { wch: 36 }, // Business Occupation
    { wch: 40 }, // Address
    { wch: 32 }, // Asset Detail
    { wch: 24 }, // Estimated Value
    { wch: 18 }, // Parent Group
    { wch: 20 }, // PIC Name
    { wch: 28 }, // PIC Email
    { wch: 18 }, // PIC Phone
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  XLSX.writeFile(wb, 'IRIS_Clients_Import_Template.xlsx');
}

// ---------- Parsing & validation ---------------------------------------------

/**
 * Parse an uploaded .xlsx file. Returns valid rows and invalid rows with errors.
 * `existingClients` is used to detect duplicates by company name.
 */
export async function parseImportFile(file: File, existingClients: Client[]): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded file has no sheets.');
  }
  const ws = wb.Sheets[sheetName];
  // header: 1 → first row is the header; rest are rows of arrays
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length === 0) {
    throw new Error('The uploaded sheet is empty.');
  }

  // Build column index from the header so user can reorder columns or have extras.
  const header = rows[0].map((h: any) => String(h || '').trim());
  const headerIndex: Partial<Record<typeof IMPORT_COLUMNS[number], number>> = {};
  for (const col of IMPORT_COLUMNS) {
    const idx = header.findIndex(h => h.toLowerCase() === col.toLowerCase());
    if (idx >= 0) headerIndex[col] = idx;
  }

  // Required columns must exist in the header.
  const missing = (['Company Name', 'Line of Business', 'Business Occupation'] as const).filter(c => headerIndex[c] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required column(s) in header row: ${missing.join(', ')}. Please use the downloaded template.`);
  }

  // Build a lookup of existing clients by lowercased trimmed name.
  const existingByName = new Map<string, Client>();
  for (const c of existingClients) {
    existingByName.set(c.companyName.trim().toLowerCase(), c);
  }

  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i];

    // Skip entirely empty rows.
    if (!raw || raw.every((cell: any) => String(cell || '').trim() === '')) continue;

    // Skip rows that look like instructions ("NOTE:", "Line of Business must be one of...").
    const firstCell = String(raw[0] || '').trim();
    if (firstCell.toUpperCase().startsWith('NOTE:') || firstCell.toLowerCase().startsWith('line of business must')) continue;
    if (firstCell.toLowerCase().startsWith('estimated asset value')) continue;

    const rowNumber = i + 1; // 1-based, matching spreadsheet row numbers
    const get = (col: typeof IMPORT_COLUMNS[number]): string => {
      const idx = headerIndex[col];
      if (idx === undefined) return '';
      return String(raw[idx] ?? '').trim();
    };

    const errors: string[] = [];

    // Required fields
    const companyName = get('Company Name');
    if (!companyName) errors.push('Company Name is required');

    const rawLOB = get('Line of Business');
    let normalizedLOB: LineOfBusiness | null = null;
    if (!rawLOB) {
      errors.push('Line of Business is required');
    } else {
      // Try exact match first
      const exact = VALID_LOB.find(v => v.toLowerCase() === rawLOB.toLowerCase());
      if (exact) {
        normalizedLOB = exact;
      } else {
        // Synonym match
        const syn = LOB_SYNONYMS[rawLOB.toLowerCase()];
        if (syn) {
          normalizedLOB = syn;
        } else {
          errors.push(`Line of Business "${rawLOB}" is not valid. Must be one of: ${VALID_LOB.join(', ')}`);
        }
      }
    }

    const businessOccupation = get('Business Occupation');
    if (!businessOccupation) errors.push('Business Occupation is required');

    // Optional with format checks
    let estimatedValueAsset: number | undefined;
    const rawValue = get('Estimated Asset Value (IDR)');
    if (rawValue) {
      const parsed = parseFlexibleNumber(rawValue);
      if (parsed === null) {
        errors.push(`Estimated Asset Value "${rawValue}" is not a valid number`);
      } else {
        estimatedValueAsset = parsed;
      }
    }

    const picEmail = get('PIC Email');
    if (picEmail && !isPlausibleEmail(picEmail)) {
      errors.push(`PIC Email "${picEmail}" doesn't look valid`);
    }

    if (errors.length > 0) {
      invalid.push({ rowNumber, rawCompanyName: companyName, errors });
      continue;
    }

    // Build the client object (we know required fields are present at this point).
    const client: ImportableClient = {
      companyName,
      lineOfBusiness: normalizedLOB!,
      businessOccupation,
      companyAddress: get('Company Address') || undefined,
      assetDetail: get('Asset Detail') || undefined,
      estimatedValueAsset,
      parentGroup: get('Parent Group') || undefined,
      picName: get('PIC Name') || undefined,
      picEmail: picEmail || undefined,
      picPhone: get('PIC Phone') || undefined,
      // companyClass intentionally left unset — auto-classification will compute it
      companyClassMode: 'auto',
    };

    const existing = existingByName.get(companyName.trim().toLowerCase()) || null;
    valid.push({ rowNumber, client, existingClientId: existing?.id ?? null });
  }

  return { valid, invalid };
}

/**
 * Parse loose number strings like "Rp 100.000.000", "100,000,000.50", "100M", "2.5B".
 * Returns null if it really can't make sense of it.
 */
function parseFlexibleNumber(input: string): number | null {
  let s = input.trim();
  if (s === '') return null;

  // Strip currency prefixes / symbols
  s = s.replace(/^(rp\.?|idr\.?|usd\.?|\$|€|£)/i, '').trim();

  // Suffix multipliers (M / B / K / Jt / Mn)
  let multiplier = 1;
  const suffixMatch = s.match(/([kmb]|jt|mn)$/i);
  if (suffixMatch) {
    const suffix = suffixMatch[1].toLowerCase();
    if (suffix === 'k') multiplier = 1_000;
    else if (suffix === 'm' || suffix === 'mn' || suffix === 'jt') multiplier = 1_000_000;
    else if (suffix === 'b') multiplier = 1_000_000_000;
    s = s.slice(0, -suffixMatch[1].length).trim();
  }

  // Strip thousand separators. Heuristic: if both '.' and ',' present, the rightmost is the decimal.
  // If only one is present and appears multiple times or 3 digits trailing, treat as thousands.
  if (s.includes('.') && s.includes(',')) {
    // Whichever comes last is decimal
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) {
      // dot is decimal: remove commas
      s = s.replace(/,/g, '');
    } else {
      // comma is decimal: remove dots, swap comma → dot
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (s.includes(',')) {
    // Assume thousands if it's a clean digit pattern; otherwise treat as decimal
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (s.includes('.')) {
    // Assume thousands if pattern matches; otherwise leave as decimal
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
  }

  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n * multiplier;
}

function isPlausibleEmail(s: string): boolean {
  // Permissive check — just enough to catch typos like missing @ or domain
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}