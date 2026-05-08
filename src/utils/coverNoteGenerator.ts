import { jsPDF } from 'jspdf';
import { Deal, Client } from '../types';

export const generateCoverNote = (deal: Deal, client: Client) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 50, 150);
  doc.text('COVER NOTE', 105, 20, { align: 'center' });
  
  // Date & Reference
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const cnNumber = deal.coverNoteNumber || `CN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  doc.text(`Cover Note No: ${cnNumber}`, 20, 35);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, 140, 35);
  
  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 42, 190, 42);

  // Content
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  
  let yPos = 55;
  const lineSpace = 10;
  
  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, yPos);
    
    doc.setFont("helvetica", "normal");
    const splitValue = doc.splitTextToSize(value || '-', 110);
    doc.text(splitValue, 70, yPos);
    
    yPos += splitValue.length * lineSpace;
  };
  
  addRow('Name of Insured:', client.companyName);
  addRow('Correspondence Address:', client.companyAddress || '-');
  
  const periodStart = deal.periodStart ? new Date(deal.periodStart).toLocaleDateString() : 'TBA';
  const periodEnd = deal.periodEnd ? new Date(deal.periodEnd).toLocaleDateString() : 'TBA';
  addRow('Period of Insurance:', `${periodStart} to ${periodEnd}`);
  
  addRow('Risk Occupation:', client.businessOccupation || '-');
  addRow('Risk Location:', deal.riskLocation || client.companyAddress || '-');
  addRow('Type of Insurance:', deal.typeOfInsurance || '-');
  addRow('Insurance Company:', deal.insuranceCompany || '-');
  
  // Sum Insured logic
  let sumInsuredStr = `${deal.currency} ${deal.sumInsured?.toLocaleString() || '0'}`;
  if (deal.sumInsuredBreakdown && deal.sumInsuredBreakdown.length > 0) {
    sumInsuredStr += '\n' + deal.sumInsuredBreakdown.map(b => `- ${b.assetName}: ${deal.currency} ${b.amount.toLocaleString()}`).join('\n');
  }
  addRow('Interest/Sum Insured:', sumInsuredStr);
  
  // Premium Rate
  if (deal.premiumRate) {
    addRow('Premium Rate:', deal.premiumRate);
  }
  
  // Premium Calculation
  if (deal.premiumAmount) {
     addRow('Premium Calculation:', `${deal.premiumType || 'Premium'}: ${deal.currency} ${deal.premiumAmount.toLocaleString()}`);
  }

  // Footer / Signatures
  yPos = Math.max(yPos + 20, 220);
  doc.setFontSize(10);
  doc.text('This cover note is issued subject to the terms, conditions, and exceptions of the standard policy.', 20, yPos);
  
  yPos += 20;
  doc.text('Authorized Signature:', 20, yPos);
  doc.line(20, yPos + 10, 80, yPos + 10);
  doc.text('For and on behalf of RiskFlow Enterprise', 20, yPos + 15);

  doc.save(`${client.companyName.replace(/\s+/g, '_')}_Cover_Note.pdf`);
};
