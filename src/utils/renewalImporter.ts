import * as XLSX from 'xlsx';
import {
  Client,
  Deal,
  DealStage,
  DealType,
  LineOfBusiness,
  Currency,
  CURRENCIES,
} from '../types';

// ---------- Template definition ---------------------------------------------

export const RENEWAL_COLUMNS = [
  'Insured Name',
  'Type of Insurance',
  'Business Occupation',
  'Period Start',
  'Period End',
  'Sum Insured',
  'Currency',
  'Premium',
  'Policy Number',
  'Insurance Company',
  'Risk Description',
  'Address',
  'PIC Name',
  'PIC Email',
  'PIC Phone',
  'Parent Group',
  'Line of Business',
  'Estimated Asset Value (IDR)',
  'Deal Type',
  'Stage',
  'Notes',
] as const;

const REQUIRED_COLUMNS = [
  'Insured Name',
  'Type of Insurance',
  'Business Occupation',
  'Period Start',
  'Period End',
  'Sum Insured',
] as const;

const VALID_STAGES: DealStage[] = [
  'Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress', 'Lost',
];
const VALID_DEAL_TYPES: DealType[] = [
  'New Business', 'Renewal', 'Cross Sell', 'Upsell', 'Existing Client Update',
];
const VALID_LOB: LineOfBusiness[] = [
  'Manufacture', 'Trading', 'Financial Institution', 'Property', 'Others',
];

const LOB_SYNONYMS: Record<string, LineOfBusiness> = {
  manufacture: 'Manufacture', manufacturer: 'Manufacture', manufacturing: 'Manufacture',
  trading: 'Trading', trade: 'Trading',
  'financial institution': 'Financial Institution', financial: 'Financial Institution', finance: 'Financial Institution', bank: 'Financial Institution',
  property: 'Property', 'real estate': 'Property',
  others: 'Others', other: 'Others',
};

// ---------- Types -----------------------------------------------------------

export interface RenewalRow {
  rowNumber: number;
  insuredName: string;
  clientData: {
    companyName: string;
    lineOfBusiness: LineOfBusiness;
    businessOccupation: string;
    companyAddress?: string;
    parentGroup?: string;
    picName?: string;
    picEmail?: string;
    picPhone?: string;
    estimatedValueAsset?: number;
  };
  dealData: {
    typeOfInsurance: string;
    sumInsured: number;
    currency: Currency;
    premiumAmount?: number;
    coverNoteNumber?: string;
    insuranceCompany?: string;
    riskDetail?: string;
    periodStart: string;
    periodEnd: string;
    dealType: DealType;
    statusStage: DealStage;
    notes?: string;
  };
}

export interface InvalidRow {
  rowNumber: number;
  rawInsuredName: string;
  errors: string[];
}

export interface ImportGroup {
  insuredName: string;
  clientData: RenewalRow['clientData'];
  existingClientId: string | null;
  deals: RenewalRow['dealData'][];
  sourceRowNumbers: number[];
}

export interface ParseResult {
  groups: ImportGroup[];
  invalid: InvalidRow[];
  totalRowsProcessed: number;
}

// ---------- Template generation ---------------------------------------------

export function downloadRenewalTemplate(): void {
  const wb = XLSX.utils.book_new();
  const data: any[][] = [
    [...RENEWAL_COLUMNS],
    [
      'PT BPR Dana Mandiri Bogor',
      'Property All Risk',
      'Rural bank office operations',
      '01/01/2026',
      '01/01/2027',
      23_000_000_000,
      'IDR',
      52_858_600,
      '0101-0109-25-000079/8',
      'Avrist',
      'Office building - Bogor branch',
      'Jl. Raya Puncak No.402, Seuseupan - Ciawi, Bogor',
      'Andi Setiawan',
      'andi@bprdanamandiri.co.id',
      '+62 251 555 1234',
      '',
      'Financial Institution',
      30_000_000_000,
      'Renewal',
      'Policy On Progress',
      'Annual renewal — relationship since 2022',
    ],
    [
      'PT Vertex Global Indonesia',
      'Motor Vehicle',
      'Logistics and distribution',
      '03/01/2026',
      '03/01/2027',
      240_000_000,
      'IDR',
      5_865_000,
      '0101-0210-25-000026',
      'Avrist',
      'Toyota Avanza W101RE LBMFJ 1.5 G CVT /2022 - B1832CIB',
      'Kawasan Pergudangan Bandara Benda Permai G No. 10, Banten',
      'Rina Maulani',
      'rina@vertex.co.id',
      '+62 21 555 9999',
      '',
      'Trading',
      '',
      'Renewal',
      'Policy On Progress',
      '',
    ],
    [],
    ['NOTE: Delete the two example rows above before importing.'],
    [`Required columns: ${REQUIRED_COLUMNS.join(', ')}`],
    ['Same Insured Name across multiple rows → one Client with multiple Deals.'],
    ['Dates: DD/MM/YYYY or "1 Januari 2026" both work. Numbers can be "100,000,000" or "Rp 100M".'],
    [`Stage must be one of: ${VALID_STAGES.join(', ')} (defaults to "Policy On Progress" if blank).`],
    [`Deal Type must be one of: ${VALID_DEAL_TYPES.join(', ')} (defaults to "Renewal" if blank).`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 28 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 24 }, { wch: 22 },
    { wch: 34 }, { wch: 36 }, { wch: 20 }, { wch: 28 }, { wch: 18 },
    { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Renewals');
  XLSX.writeFile(wb, 'IRIS_Renewal_Workbook_Template.xlsx');
}

// ---------- Parsing ----------------------------------------------------------

export async function parseRenewalFile(file: File, existingClients: Client[]): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('The uploaded file has no sheets.');
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (rows.length === 0) throw new Error('The uploaded sheet is empty.');

  const header = (rows[0] || []).map((h: any) => String(h || '').trim());
  const headerIndex: Partial<Record<typeof RENEWAL_COLUMNS[number], number>> = {};
  for (const col of RENEWAL_COLUMNS) {
    const idx = header.findIndex(h => h.toLowerCase() === col.toLowerCase());
    if (idx >= 0) headerIndex[col] = idx;
  }

  const missing = REQUIRED_COLUMNS.filter(c => headerIndex[c] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required column(s) in header: ${missing.join(', ')}. Please use the downloaded template.`);
  }

  const existingByName = new Map<string, Client>();
  for (const c of existingClients) existingByName.set(c.companyName.trim().toLowerCase(), c);

  const validRows: RenewalRow[] = [];
  const invalid: InvalidRow[] = [];
  let totalProcessed = 0;

  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw || raw.every((c: any) => String(c || '').trim() === '')) continue;
    const first = String(raw[0] || '').trim();
    if (first.toUpperCase().startsWith('NOTE:')) continue;
    if (first.toLowerCase().startsWith('required column')) continue;
    if (first.toLowerCase().startsWith('same insured')) continue;
    if (first.toLowerCase().startsWith('dates:')) continue;
    if (first.toLowerCase().startsWith('stage must')) continue;
    if (first.toLowerCase().startsWith('deal type must')) continue;

    totalProcessed++;
    const rowNumber = i + 1;
    const get = (col: typeof RENEWAL_COLUMNS[number]) => {
      const idx = headerIndex[col];
      if (idx === undefined) return '';
      const v = raw[idx];
      if (v instanceof Date) return v.toISOString();
      return String(v ?? '').trim();
    };

    const errors: string[] = [];
    const insuredName = get('Insured Name');
    const typeOfInsurance = get('Type of Insurance');
    const businessOccupation = get('Business Occupation');
    const rawStart = get('Period Start');
    const rawEnd = get('Period End');
    const rawSumInsured = get('Sum Insured');

    if (!insuredName) errors.push('Insured Name is required');
    if (!typeOfInsurance) errors.push('Type of Insurance is required');
    if (!businessOccupation) errors.push('Business Occupation is required');

    const periodStart = parseFlexibleDate(rawStart);
    if (!rawStart) errors.push('Period Start is required');
    else if (!periodStart) errors.push(`Period Start "${rawStart}" is not a recognizable date`);

    const periodEnd = parseFlexibleDate(rawEnd);
    if (!rawEnd) errors.push('Period End is required');
    else if (!periodEnd) errors.push(`Period End "${rawEnd}" is not a recognizable date`);

    const sumInsured = parseFlexibleNumber(rawSumInsured);
    if (!rawSumInsured) errors.push('Sum Insured is required');
    else if (sumInsured === null) errors.push(`Sum Insured "${rawSumInsured}" is not a valid number`);

    let premium: number | undefined;
    const rawPremium = get('Premium');
    if (rawPremium) {
      const p = parseFlexibleNumber(rawPremium);
      if (p === null) errors.push(`Premium "${rawPremium}" is not a valid number`);
      else premium = p;
    }

    let estimatedValueAsset: number | undefined;
    const rawAsset = get('Estimated Asset Value (IDR)');
    if (rawAsset) {
      const a = parseFlexibleNumber(rawAsset);
      if (a === null) errors.push(`Estimated Asset Value "${rawAsset}" is not a valid number`);
      else estimatedValueAsset = a;
    }

    const rawCurrency = get('Currency').toUpperCase();
    let currency: Currency = 'IDR';
    if (rawCurrency) {
      if ((CURRENCIES as readonly string[]).includes(rawCurrency)) {
        currency = rawCurrency as Currency;
      } else {
        errors.push(`Currency "${rawCurrency}" is not supported. Must be one of: ${CURRENCIES.join(', ')}`);
      }
    }

    const rawLOB = get('Line of Business');
    let lineOfBusiness: LineOfBusiness = 'Others';
    if (rawLOB) {
      const exact = VALID_LOB.find(v => v.toLowerCase() === rawLOB.toLowerCase());
      if (exact) lineOfBusiness = exact;
      else {
        const syn = LOB_SYNONYMS[rawLOB.toLowerCase()];
        if (syn) lineOfBusiness = syn;
        else errors.push(`Line of Business "${rawLOB}" is not valid. Must be one of: ${VALID_LOB.join(', ')}`);
      }
    }

    const rawDealType = get('Deal Type');
    let dealType: DealType = 'Renewal';
    if (rawDealType) {
      const match = VALID_DEAL_TYPES.find(t => t.toLowerCase() === rawDealType.toLowerCase());
      if (match) dealType = match;
      else errors.push(`Deal Type "${rawDealType}" is not valid. Must be one of: ${VALID_DEAL_TYPES.join(', ')}`);
    }

    const rawStage = get('Stage');
    let statusStage: DealStage = 'Policy On Progress';
    if (rawStage) {
      const match = VALID_STAGES.find(s => s.toLowerCase() === rawStage.toLowerCase());
      if (match) statusStage = match;
      else errors.push(`Stage "${rawStage}" is not valid. Must be one of: ${VALID_STAGES.join(', ')}`);
    }

    const picEmail = get('PIC Email');
    if (picEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(picEmail)) {
      errors.push(`PIC Email "${picEmail}" doesn't look valid`);
    }

    if (errors.length > 0) {
      invalid.push({ rowNumber, rawInsuredName: insuredName, errors });
      continue;
    }

    validRows.push({
      rowNumber,
      insuredName,
      clientData: {
        companyName: insuredName,
        lineOfBusiness,
        businessOccupation,
        companyAddress: get('Address') || undefined,
        parentGroup: get('Parent Group') || undefined,
        picName: get('PIC Name') || undefined,
        picEmail: picEmail || undefined,
        picPhone: get('PIC Phone') || undefined,
        estimatedValueAsset,
      },
      dealData: {
        typeOfInsurance,
        sumInsured: sumInsured!,
        currency,
        premiumAmount: premium,
        coverNoteNumber: get('Policy Number') || undefined,
        insuranceCompany: get('Insurance Company') || undefined,
        riskDetail: get('Risk Description') || undefined,
        periodStart: periodStart!,
        periodEnd: periodEnd!,
        dealType,
        statusStage,
        notes: get('Notes') || undefined,
      },
    });
  }

  const groupMap = new Map<string, ImportGroup>();
  for (const row of validRows) {
    const key = row.insuredName.trim().toLowerCase();
    let group = groupMap.get(key);
    if (!group) {
      const existing = existingByName.get(key) || null;
      group = {
        insuredName: row.insuredName,
        clientData: row.clientData,
        existingClientId: existing?.id ?? null,
        deals: [],
        sourceRowNumbers: [],
      };
      groupMap.set(key, group);
    }
    group.deals.push(row.dealData);
    group.sourceRowNumbers.push(row.rowNumber);
  }

  return {
    groups: Array.from(groupMap.values()),
    invalid,
    totalRowsProcessed: totalProcessed,
  };
}

// ---------- Helpers ----------------------------------------------------------

function parseFlexibleNumber(input: string): number | null {
  if (input === '' || input == null) return null;
  if (typeof input === 'number') return input;
  let s = String(input).trim();
  if (s === '') return null;

  s = s.replace(/^(rp\.?|idr\.?|usd\.?|\$|€|£)/i, '').trim();

  let multiplier = 1;
  const suffixMatch = s.match(/([kmb]|jt|mn)$/i);
  if (suffixMatch) {
    const suffix = suffixMatch[1].toLowerCase();
    if (suffix === 'k') multiplier = 1_000;
    else if (suffix === 'm' || suffix === 'mn' || suffix === 'jt') multiplier = 1_000_000;
    else if (suffix === 'b') multiplier = 1_000_000_000;
    s = s.slice(0, -suffixMatch[1].length).trim();
  }

  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  } else if (s.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }

  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n * multiplier;
}

function parseFlexibleDate(input: string): string | null {
  if (!input) return null;

  const isoMatch = input.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const s = input.trim();

  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    let [, dd, mm, yyyy] = dmyMatch;
    let year = parseInt(yyyy, 10);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const [, yyyy, mm, dd] = ymdMatch;
    const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const monthMap: Record<string, number> = {
    januari: 0, january: 0, jan: 0,
    februari: 1, february: 1, feb: 1,
    maret: 2, march: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4, may: 4,
    juni: 5, june: 5, jun: 5,
    juli: 6, july: 6, jul: 6,
    agustus: 7, august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    oktober: 9, october: 9, oct: 9,
    november: 10, nov: 10,
    desember: 11, december: 11, dec: 11,
  };
  const namedMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const [, dd, monthName, yyyy] = namedMatch;
    const monthIdx = monthMap[monthName.toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(parseInt(yyyy, 10), monthIdx, parseInt(dd, 10));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback.toISOString();
  return null;
}