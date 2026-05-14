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

    // Company block — right
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    ink(30, 41, 59);
    doc.text('IRIS BY BCI', rm, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    ink(100, 116, 139);
    doc.setFontSize(7);
    doc.text('One Pacific Place, 15th Floor, CEO Suite 1501', rm, 16, { align: 'right' });
    doc.text('Jl. Jend. Sudirman Kav 52-53, Jakarta 12190, Indonesia', rm, 20, { align: 'right' });
    doc.text('T: (021) 2550 2428', rm, 24, { align: 'right' });

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

    fill(248, 250, 252);
    stroke(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(lm, stripY, pw, stripH, 'FD');

    let cx = lm;
    cellDefs.forEach((cell, i) => {
      const cw = cellWidths[i];
      if (i > 0) {
        stroke(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(cx, stripY + 1.5, cx, stripY + stripH - 1.5);
      }
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      ink(100, 116, 139);
      doc.text(cell.label, cx + 3, stripY + 7);

      const isAmt = i === 4;
      doc.setFontSize(isAmt ? 8 : 9);
      doc.setFont('helvetica', 'bold');
      if (isAmt) ink(37, 99, 235); else ink(15, 23, 42);
      doc.text(doc.splitTextToSize(cell.value, cw - 5)[0], cx + 3, stripY + 15);
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
    const tHdrH = 9;
    const tRowH = 8;
    const colNo   = lm;
    const colName = lm + 12;
    const colRate = lm + 122;
    const colAmt  = rm;

    // Header row — dark navy
    fill(15, 23, 42);
    doc.rect(lm, y, pw, tHdrH, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    ink(255, 255, 255);
    doc.text('NO.', colNo + 5, y + 6, { align: 'right' });
    doc.text('DESCRIPTION OF COVERAGE', colName, y + 6);
    doc.text('RATE', colRate, y + 6);
    doc.text('AMOUNT (IDR)', colAmt, y + 6, { align: 'right' });
    y += tHdrH;

    // Thin accent underline
    fill(37, 99, 235);
    doc.rect(lm, y, pw, 0.8, 'F');
    y += 0.8;

    // Data rows — alternating backgrounds
    soc.coverages.forEach((cov, i) => {
      const isAlt = i % 2 !== 0;
      if (isAlt) {
        fill(248, 250, 252);
        doc.rect(lm, y, pw, tRowH, 'F');
      }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      ink(30, 41, 59);
      doc.text(String(i + 1), colNo + 5, y + 5.5, { align: 'right' });
      doc.text(doc.splitTextToSize(cov.name, colRate - colName - 4)[0], colName, y + 5.5);
      doc.text(cov.rateType === 'percentage' ? `${cov.rate}%` : cov.rate, colRate, y + 5.5);
      doc.text(
        cov.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        colAmt, y + 5.5, { align: 'right' },
      );
      y += tRowH;
    });

    // Table bottom rule
    stroke(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(lm, y, rm, y);
    y += 7;

    // ── TOTALS ──────────────────────────────────────────────────────────────
    const totLblX = rm - 78;
    const totValX = rm;

    const drawTotal = (label: string, value: string, highlight = false) => {
      if (highlight) {
        fill(15, 23, 42);
        doc.rect(lm, y - 6.5, pw, 10.5, 'F');
        ink(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        ink(100, 116, 139);
      }
      doc.text(label, totLblX, y);
      if (!highlight) ink(30, 41, 59);
      doc.text(value, totValX, y, { align: 'right' });
      y += highlight ? 11 : 7.5;
    };

    drawTotal('Sub Total', soc.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }));

    if (soc.discountPercent > 0) {
      const disc = soc.subTotal * (soc.discountPercent / 100);
      drawTotal(
        `Discount (${soc.discountPercent}%)`,
        `– ${disc.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      );
    }

    drawTotal('Admin Fee', soc.adminFee.toLocaleString(undefined, { minimumFractionDigits: 2 }));

    if (soc.policyFee && soc.policyFee > 0) {
      drawTotal('Policy Fee', soc.policyFee.toLocaleString(undefined, { minimumFractionDigits: 2 }));
    }

    // Separator before grand total
    stroke(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(totLblX, y - 2, rm, y - 2);
    y += 4;

    drawTotal(
      'TOTAL PREMIUM (IDR)',
      soc.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      true,
    );

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
