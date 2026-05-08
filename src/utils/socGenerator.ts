import jsPDF from 'jspdf';
import { Deal, Client } from '../types';
import { format } from 'date-fns';

export const generateSOC = (deal: Deal, client?: Client) => {
  const doc = new jsPDF();
  const companyName = client ? client.companyName : 'Unknown Client';
  const soc = deal.socDetails;

  if (soc) {
    // Advanced SOC Mode
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text('SUMMARY OF COVER', 14, 25);
    
    // Company Address (Right aligned)
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text('One Pacific Place, 15th floor, CEO Suite 1501', 196, 15, { align: 'right' });
    doc.text('Jl. Jend. Sudirman kav 52-53, Jakarta 12190, Indonesia', 196, 20, { align: 'right' });
    doc.text('(021) 2550 2428', 196, 25, { align: 'right' });

    // Blue separator line
    doc.setDrawColor(41, 128, 185); // Blue
    doc.setLineWidth(1);
    doc.line(14, 32, 196, 32);

    // Upper section boxes (Light blue)
    doc.setFillColor(214, 230, 245); // light blue
    doc.rect(14, 36, 50, 16, 'F'); // Attention To
    doc.rect(65, 36, 25, 16, 'F'); // Date
    doc.rect(91, 36, 30, 16, 'F'); // SOC Number
    doc.rect(122, 36, 20, 16, 'F'); // Code
    doc.rect(143, 36, 53, 16, 'F'); // Amount Due

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    doc.text('Attention to:', 16, 41);
    doc.text(soc.attentionTo || client?.companyName || '-', 16, 48);

    doc.text('Date:', 67, 41);
    const todayStr = soc.socDate || format(new Date(), 'dd-MMM-yyyy');
    doc.setFont("helvetica", "bold");
    doc.text(todayStr, 67, 48);
    doc.setFont("helvetica", "normal");

    doc.text('SOC Number:', 93, 41);
    doc.setFont("helvetica", "bold");
    doc.text(soc.socNumber || deal.coverNoteNumber || `SOC-${new Date().getFullYear()}`, 93, 48);
    doc.setFont("helvetica", "normal");

    doc.text('Code:', 124, 41);
    doc.setFont("helvetica", "bold");
    doc.text(soc.templateType === 'Motor Vehicle' ? 'MV/PT' : 'GN/PT', 124, 48);
    doc.setFont("helvetica", "normal");

    doc.text('Amount Due:', 145, 41);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(soc.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 }), 193, 49, { align: 'right' });
    doc.setFont("helvetica", "normal");

    // Clear and reset sizes
    let infoYPos = 65;
    const labelX = 14;
    const colonX = 60;
    const valueX = 64;
    const rowHeight = 7;

    const addInfoRow = (label: string, value: string) => {
        doc.text(label, labelX, infoYPos);
        doc.text(':', colonX, infoYPos);
        // split value if long
        const splitText = doc.splitTextToSize(value, 130);
        doc.text(splitText, valueX, infoYPos);
        infoYPos += splitText.length * rowHeight;
    };

    doc.setFontSize(10);
    addInfoRow('Insured Name', client?.companyName || '-');
    addInfoRow('Address', client?.companyAddress || '-');
    infoYPos += 3;

    addInfoRow('Type Of Insurance', deal.typeOfInsurance || '-');
    addInfoRow('Insured Object', deal.riskLocation || client?.companyAddress || '-');

    const pStart = deal.periodStart ? format(new Date(deal.periodStart), 'dd-MMM-yyyy') : 'TBA';
    const pEnd = deal.periodEnd ? format(new Date(deal.periodEnd), 'dd-MMM-yyyy') : 'TBA';
    addInfoRow('Period Of Insurance', `${pStart}   -   ${pEnd}`);
    infoYPos += 3;

    addInfoRow('Sum Insured', `${deal.currency} ${deal.sumInsured?.toLocaleString() || '0.00'}`);
    addInfoRow('Deductible', soc.deductible || '-');

    infoYPos += 3;
    doc.text('Existing Policy (Optional)', labelX, infoYPos);
    doc.text(':', colonX, infoYPos);
    doc.text(deal.coverNoteNumber || 'NEW', valueX, infoYPos);

    doc.setFont("helvetica", "bold");
    doc.text('Security :', 140, infoYPos);
    doc.setFont("helvetica", "normal");
    doc.text(deal.insuranceCompany || 'TBA', 160, infoYPos);

    infoYPos += 12;

    // Table Header
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(0, 0, 0); // Black background
    doc.rect(14, infoYPos, 182, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text('NO.', 16, infoYPos + 5);
    doc.text('COVERAGE', 30, infoYPos + 5);
    doc.text('RATE', 110, infoYPos + 5);
    doc.text('AMOUNT', 160, infoYPos + 5);
    
    doc.setTextColor(0, 0, 0);
    let yPos = infoYPos + 15;
    doc.setFont("helvetica", "normal");

    soc.coverages.forEach((cov, i) => {
      doc.text((i + 1).toString(), 18, yPos);
      doc.text(cov.name, 30, yPos);
      doc.text(cov.rateType === 'percentage' ? `${cov.rate}%` : cov.rate, 110, yPos);
      doc.text(cov.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 190, yPos, { align: 'right' });
      yPos += 8;
    });

    yPos += 2;
    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos, 196, yPos);
    yPos += 8;

    const rightAlignX = 194;
    const totalLabelX = 130;
    doc.text('Sub Total:', totalLabelX, yPos);
    doc.text(soc.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), rightAlignX, yPos, { align: 'right' });
    yPos += 8;

    if (soc.discountPercent > 0) {
      const discountAmount = soc.subTotal * (soc.discountPercent / 100);
      doc.text(`Discount (${soc.discountPercent}%):`, totalLabelX, yPos);
      doc.text(`-${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, rightAlignX, yPos, { align: 'right' });
      yPos += 8;
    }

    doc.text('Admin Cost:', totalLabelX, yPos);
    doc.text(soc.adminFee.toLocaleString(undefined, { minimumFractionDigits: 2 }), rightAlignX, yPos, { align: 'right' });
    yPos += 8;

    if (soc.policyFee && soc.policyFee > 0) {
      doc.text('Policy Fee:', totalLabelX, yPos);
      doc.text(soc.policyFee.toLocaleString(undefined, { minimumFractionDigits: 2 }), rightAlignX, yPos, { align: 'right' });
      yPos += 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text('Total Premium:', totalLabelX, yPos);
    doc.text(soc.totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 }), rightAlignX, yPos, { align: 'right' });

  } else {
    // Basic Mode (Fallback)
    const today = format(new Date(), 'MMMM do, yyyy');
    const lineOfBusiness = client ? client.lineOfBusiness : 'Unknown LOB';
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(33, 33, 33);
    doc.text('STATEMENT OF COVERAGE (SOC)', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(deal.dealType === 'New Business' ? 'NEW POLICY SUMMARY' : 'RENEWAL POLICY SUMMARY', 105, 30, { align: 'center' });

    // Draw a line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);

    // Client Details
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Date Issued: ${today}`, 20, 45);
    doc.text(`Company Name: ${companyName}`, 20, 55);
    doc.text(`Line of Business: ${lineOfBusiness}`, 20, 65);
    if (deal.typeOfInsurance) {
      doc.text(`Insurance Type: ${deal.typeOfInsurance}`, 20, 75);
    }
    
    // Deal/Policy Details
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Policy Information', 20, 95);
    doc.setLineWidth(0.5);
    doc.line(20, 98, 80, 98);

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    let yPos = 110;
    doc.text(`Sum Insured: ${deal.currency} ${deal.sumInsured?.toLocaleString() || '0'}`, 20, yPos);
    
    if (deal.sumInsuredBreakdown && deal.sumInsuredBreakdown.length > 0) {
      yPos += 10;
      doc.setFontSize(10);
      deal.sumInsuredBreakdown.forEach((b) => {
        doc.text(`- ${b.assetName}: ${deal.currency} ${b.amount.toLocaleString()}`, 25, yPos);
        yPos += 8;
      });
      doc.setFontSize(12);
    } else {
      yPos += 10;
    }
    
    doc.text(`Premium: ${deal.premiumAmount ? `${deal.currency} ${deal.premiumAmount.toLocaleString()}` : 'TBD'}`, 20, yPos);
    yPos += 10;
    doc.text(`Pipeline Stage: ${deal.statusStage}`, 20, yPos);
    yPos += 10;
    doc.text(`Policy Type: ${deal.dealType}`, 20, yPos);
    
    // Terms & Conditions stub
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Terms & Conditions', 20, yPos + 20);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const termsText = deal.dealType === 'New Business' 
      ? "This Statement of Coverage outlines the terms and conditions for your new insurance policy. Please review carefully. This document is a summary and does not constitute the full binding policy documentation."
      : "This Statement of Coverage outlines the terms and conditions for your policy renewal. Existing terms carry over unless specified otherwise. Please review any amendments carefully.";
    
    const splitText = doc.splitTextToSize(termsText, 170);
    doc.text(splitText, 20, yPos + 30);
  }

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Risk Flow CRM', 105, 280, { align: 'center' });

  return doc;
};
