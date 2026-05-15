import jsPDF from 'jspdf';
import { Deal, Client } from '../types';
import { format } from 'date-fns';

export const generateSOC = (deal: Deal, client?: Client) => {
  const doc = new jsPDF();
  const soc = deal.socDetails;

  // Shorthand colour helpers
  const fill   = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
  const stroke = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);
  const ink    = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  // Layout
  const lm = 15;   // left margin (mm)
  const rm = 195;  // right edge
  const pw = 180;  // usable page width

  // ─── Shared header/footer ─────────────────────────────────────────────────
  const drawHeader = (title: string, subtitle: string) => {
    // Accent bar
    fill(37, 99, 235);
    doc.rect(0, 0, 210, 2.5, 'F');

    // Address — right
    doc.setFont('helvetica', 'normal');
    ink(150, 160, 175);
    doc.setFontSize(6.5);
    doc.text('One Pacific Place, 15th Floor, CEO Suite 1501', rm, 13, { align: 'right' });
    doc.text('Jl. Jend. Sudirman Kav 52-53, Jakarta 12190, Indonesia', rm, 17.5, { align: 'right' });
    doc.text('T: (021) 2550 2428', rm, 22, { align: 'right' });

    // Title — left
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    ink(15, 23, 42);
    doc.text(title, lm, 18);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    ink(100, 116, 139);
    doc.text(subtitle, lm, 25);

    // Accent rule
    stroke(37, 99, 235);
    doc.setLineWidth(0.4);
    doc.line(lm, 29, rm, 29);
  };

  const drawFooter = () => {
    stroke(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(lm, 275, rm, 275);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    ink(150, 160, 175);
    doc.text('IRIS by BCI — Confidential Document', lm, 281);
    doc.text(`Generated ${format(new Date(), 'dd MMM yyyy')}`, rm, 281, { align: 'right' });
  };

  // ─── ADVANCED SOC MODE ────────────────────────────────────────────────────
  if (soc) {
    drawHeader(
      'SUMMARY OF COVER',
      soc.templateType.toUpperCase() + ' INSURANCE',
    );

    // ── INFO STRIP ──────────────────────────────────────────────────────────
    const stripY = 33;
    const stripH = 19;
    const cellWidths = [52, 28, 36, 22, 42];
    const cellDefs = [
      { label: 'ATTENTION TO',     value: soc.attentionTo || client?.companyName || '—' },
      { label: 'DATE',             value: soc.socDate || format(new Date(), 'dd-MMM-yyyy') },
      { label: 'SOC NUMBER',       value: soc.socNumber || deal.coverNoteNumber || `SOC-${new Date().getFullYear()}` },
      { label: 'CODE',             value: soc.templateType === 'Motor Vehicle' ? 'MV/PT' : 'GN/PT' },
      { label: 'AMOUNT DUE (IDR)', value: soc.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
    ];

    // Base strip — grey background for first 4 cells
    fill(248, 250, 252);
    stroke(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(lm, stripY, pw, stripH, 'FD');

    // Accent fill for last cell (Amount Due)
    const lastCellX = lm + cellWidths.slice(0, 4).reduce((a, b) => a + b, 0);
    fill(37, 99, 235);
    doc.rect(lastCellX + 0.1, stripY + 0.1, cellWidths[4] - 0.2, stripH - 0.2, 'F');

    let cx = lm;
    cellDefs.forEach((cell, i) => {
      const cw = cellWidths[i];
      const isAmt = i === 4;

      if (i > 0 && !isAmt) {
        stroke(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(cx, stripY + 1.5, cx, stripY + stripH - 1.5);
      }

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      ink(isAmt ? 191 : 100, isAmt ? 219 : 116, isAmt ? 254 : 139);
      doc.text(cell.label, cx + 3, stripY + 7);

      doc.setFontSize(isAmt ? 9 : 9);
      doc.setFont('helvetica', 'bold');
      ink(isAmt ? 255 : 15, isAmt ? 255 : 23, isAmt ? 255 : 42);
      if (isAmt) {
        doc.text(
          doc.splitTextToSize(cell.value, cw - 6)[0],
          cx + cw - 3, stripY + 15, { align: 'right' },
        );
      } else {
        doc.text(doc.splitTextToSize(cell.value, cw - 5)[0], cx + 3, stripY + 15);
      }
      cx += cw;
    });

    // ── POLICY INFO ROWS ────────────────────────────────────────────────────
    let y = stripY + stripH + 9;
    const labelW = 58;

    const drawInfoRow = (label: string, value: string, valueBold = false) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      ink(100, 116, 139);
      doc.text(label, lm, y);
      doc.setFont('helvetica', valueBold ? 'bold' : 'normal');
      ink(15, 23, 42);
      const lines = doc.splitTextToSize(value, pw - labelW - 2);
      doc.text(lines, lm + labelW, y);
      y += Math.max(1, lines.length) * 6.5;
    };

    const drawDivider = () => {
      y += 2;
      stroke(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(lm, y, rm, y);
      y += 5;
    };

    drawInfoRow('Insured Name', client?.companyName || '—', true);
    if (deal.qq && deal.qq.length > 0) {
      drawInfoRow('QQ (Atas Nama)', deal.qq.join(' QQ '));
    }
    drawInfoRow('Address', client?.companyAddress || '—');
    drawDivider();
    drawInfoRow('Type of Insurance', deal.typeOfInsurance || '—');
    drawInfoRow('Insured Object', deal.riskLocation || client?.companyAddress || '—');
    const pStart = deal.periodStart ? format(new Date(deal.periodStart), 'dd MMM yyyy') : 'TBA';
    const pEnd   = deal.periodEnd   ? format(new Date(deal.periodEnd),   'dd MMM yyyy') : 'TBA';
    drawInfoRow('Period of Insurance', `${pStart}  –  ${pEnd}`);
    drawDivider();
    drawInfoRow('Sum Insured', `${deal.currency} ${deal.sumInsured?.toLocaleString() || '0.00'}`);
    drawInfoRow('Deductible', soc.deductible || '—');
    drawInfoRow('Existing Policy No.', deal.coverNoteNumber || 'NEW');
    drawInfoRow('Security (Insurer)', deal.insuranceCompany || 'TBA');
    y += 7;

    // ── COVERAGE TABLE ──────────────────────────────────────────────────────
    // Column layout (mm):  NO. 13 | DESC 91 | RATE 37 | AMOUNT 39
    const tHdrH   = 10;
    const tRowH   = 12;
    const colNoR   = lm + 13;       // NO. right-align point
    const colName  = lm + 17;       // Description left edge
    const colRateL = rm - 76;       // Rate column left edge (for desc max-width)
    const colRateR = rm - 39;       // Rate right-align point
    const colAmt   = rm;            // Amount right-align point

    // Outer table border
    stroke(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(lm, y, pw, tHdrH, 'S');

    // Header row — dark navy fill
    fill(15, 23, 42);
    doc.rect(lm, y, pw, tHdrH, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    ink(255, 255, 255);
    doc.text('NO.', colNoR, y + 6.8, { align: 'right' });
    doc.text('DESCRIPTION OF COVERAGE', colName, y + 6.8);
    doc.text('RATE', colRateR, y + 6.8, { align: 'right' });
    doc.text('AMOUNT (IDR)', colAmt, y + 6.8, { align: 'right' });
    y += tHdrH;

    // Blue accent underline below header
    fill(37, 99, 235);
    doc.rect(lm, y, pw, 1, 'F');
    y += 1;

    // Data rows
    soc.coverages.forEach((cov, i) => {
      const isAlt = i % 2 !== 0;
      fill(isAlt ? 249 : 255, isAlt ? 250 : 255, isAlt ? 251 : 255);
      doc.rect(lm, y, pw, tRowH, 'F');

      const mid = y + tRowH / 2 + 3; // vertical centre of row

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      ink(148, 163, 184);
      doc.text(String(i + 1), colNoR, mid, { align: 'right' });

      doc.setFontSize(8.5);
      ink(30, 41, 59);
      doc.text(doc.splitTextToSize(cov.name, colRateL - colName - 3)[0], colName, mid);

      ink(100, 116, 139);
      doc.text(
        cov.rateType === 'percentage' ? `${cov.rate}%` : cov.rate,
        colRateR, mid, { align: 'right' },
      );

      doc.setFont('helvetica', 'bold');
      ink(15, 23, 42);
      doc.text(
        cov.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        colAmt, mid, { align: 'right' },
      );

      // Row separator
      stroke(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(lm, y + tRowH, rm, y + tRowH);
      y += tRowH;
    });

    // Table closing border
    stroke(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.line(lm, y, rm, y);
    y += 8;

    // ── TOTALS ──────────────────────────────────────────────────────────────
    const panelX  = rm - 92;
    const panelW  = 92;
    const totLblX = panelX + 5;
    const totValX = rm - 4;
    const subRowH = 7.5;
    const grandH  = 12;

    // Collect sub-rows
    type TotRow = { label: string; value: string; negative?: boolean };
    const subRows: TotRow[] = [
      { label: 'Sub Total', value: soc.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
    ];
    if (soc.discountPercent > 0) {
      const disc = soc.subTotal * (soc.discountPercent / 100);
      subRows.push({
        label: `Discount (${soc.discountPercent}%)`,
        value: disc.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        negative: true,
      });
    }
    subRows.push({ label: 'Admin Fee', value: soc.adminFee.toLocaleString(undefined, { minimumFractionDigits: 2 }) });
    if (soc.policyFee && soc.policyFee > 0) {
      subRows.push({ label: 'Policy Fee', value: soc.policyFee.toLocaleString(undefined, { minimumFractionDigits: 2 }) });
    }

    const panelH = subRows.length * subRowH + 2 + grandH;

    // Panel container — subtle box on the right
    fill(248, 250, 252);
    stroke(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.rect(panelX, y, panelW, panelH, 'FD');

    let ty = y;
    subRows.forEach(row => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      ink(100, 116, 139);
      doc.text(row.label, totLblX, ty + 5);
      if (row.negative) {
        ink(220, 38, 38);
        doc.text(`– ${row.value}`, totValX, ty + 5, { align: 'right' });
      } else {
        doc.setFont('helvetica', 'bold');
        ink(15, 23, 42);
        doc.text(row.value, totValX, ty + 5, { align: 'right' });
      }
      ty += subRowH;
    });

    // Divider inside panel before grand total
    ty += 1;
    stroke(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(panelX + 4, ty, rm - 4, ty);
    ty += 1;

    // Grand total — blue accent row
    fill(37, 99, 235);
    doc.rect(panelX, ty, panelW, grandH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    ink(191, 219, 254);
    doc.text('TOTAL PREMIUM (IDR)', totLblX, ty + 4.5);
    doc.setFontSize(10.5);
    ink(255, 255, 255);
    doc.text(
      soc.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      totValX, ty + 9.5, { align: 'right' },
    );
    y = ty + grandH + 8;

  } else {
    // ─── BASIC / FALLBACK MODE ───────────────────────────────────────────────
    drawHeader(
      'STATEMENT OF COVERAGE',
      deal.dealType === 'New Business' ? 'NEW POLICY SUMMARY' : 'RENEWAL POLICY SUMMARY',
    );

    const companyName = client?.companyName || 'Unknown Client';
    const rows: [string, string][] = [
      ['Date Issued',      format(new Date(), 'dd MMM yyyy')],
      ['Client',           companyName],
      ['Line of Business', client?.lineOfBusiness || '—'],
      ['Type of Insurance',deal.typeOfInsurance || '—'],
      ['Sum Insured',      `${deal.currency} ${deal.sumInsured?.toLocaleString() || '0'}`],
      ['Premium',          deal.premiumAmount ? `${deal.currency} ${deal.premiumAmount.toLocaleString()}` : 'TBD'],
      ['Policy Stage',     deal.statusStage],
      ['Deal Type',        deal.dealType],
    ];

    let yPos = 38;
    rows.forEach(([label, value]) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      ink(100, 116, 139);
      doc.text(label, lm, yPos);
      doc.setFont('helvetica', 'bold');
      ink(15, 23, 42);
      doc.text(value, lm + 58, yPos);
      stroke(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(lm, yPos + 3, rm, yPos + 3);
      yPos += 10;
    });

    yPos += 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    ink(150, 160, 175);
    const note = 'This document is a summary and does not constitute the full binding policy. Please review the complete policy terms carefully.';
    doc.text(doc.splitTextToSize(note, pw), lm, yPos);
  }

  drawFooter();
  return doc;
};
