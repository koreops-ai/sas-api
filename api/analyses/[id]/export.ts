/**
 * Analysis Export API
 * GET /api/analyses/[id]/export?format=pdf|excel
 * Export analysis results as PDF or Excel
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  asyncHandler,
  sendSuccess,
  sendError,
  requireAuth,
  setCorsHeaders,
  handleOptions,
  getQueryParam,
} from '../../../src/lib/api.js';
import { getAnalysis, getAnalysisModules } from '../../../src/lib/supabase.js';

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 'Method not allowed', 405);
    return;
  }

  const userId = await requireAuth(req);
  const analysisId = req.query.id as string;
  const format = getQueryParam(req, 'format') || 'pdf';

  if (!analysisId || typeof analysisId !== 'string') {
    sendError(res, 'Invalid analysis ID', 400);
    return;
  }

  if (!['pdf', 'excel'].includes(format)) {
    sendError(res, 'Invalid format. Must be "pdf" or "excel"', 400);
    return;
  }

  try {
    // Get analysis and verify ownership
    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      sendError(res, 'Analysis not found', 404);
      return;
    }

    if (analysis.user_id !== userId) {
      sendError(res, 'Access denied', 403);
      return;
    }

    // Get all modules
    const modules = await getAnalysisModules(analysisId);

    // Generate export based on format
    if (format === 'pdf') {
      const pdfBuffer = await generatePDF(analysis, modules);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-${analysisId}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    if (format === 'excel') {
      const excelBuffer = await generateExcel(analysis, modules);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-${analysisId}.xlsx"`);
      res.send(excelBuffer);
      return;
    }
  } catch (error) {
    console.error('Error generating export:', error);
    sendError(
      res,
      error instanceof Error ? error.message : 'Failed to generate export',
      500
    );
  }
}

async function generatePDF(analysis: any, modules: any[]): Promise<Buffer> {
  // Dynamic import to avoid bundling issues if not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFKit = require('pdfkit');
  const PDFDocument = PDFKit.default || PDFKit;
  const doc = new PDFDocument({ margin: 50 });
  const buffers: Buffer[] = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  // Header
  doc.fontSize(20).text('Market Validation Analysis Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12);
  doc.text(`Analysis: ${analysis.name}`, { align: 'left' });
  doc.text(`Company: ${analysis.company_name}`);
  if (analysis.product_name) doc.text(`Product: ${analysis.product_name}`);
  if (analysis.target_market) doc.text(`Target Market: ${analysis.target_market}`);
  doc.text(`Status: ${analysis.status}`);
  doc.text(`Progress: ${analysis.progress}%`);
  doc.text(`Created: ${new Date(analysis.created_at).toLocaleDateString()}`);
  doc.moveDown(2);

  // Modules section
  doc.fontSize(16).text('Analysis Modules', { underline: true });
  doc.moveDown();

  for (const module of modules) {
    doc.fontSize(14).text(getModuleDisplayName(module.module_type), { underline: true });
    doc.fontSize(10);
    doc.text(`Status: ${module.status}`);
    doc.text(`Progress: ${module.progress}%`);
    if (module.cost > 0) doc.text(`Cost: ${module.cost} credits`);

    if (module.data) {
      doc.moveDown(0.5);
      doc.text('Results:', { underline: true });
      doc.fontSize(9);
      
      // Format module data as readable text
      const formattedData = formatModuleDataForPDF(module.module_type, module.data);
      doc.text(formattedData, { align: 'left' });
    }

    if (module.error) {
      doc.moveDown(0.5);
      doc.fillColor('red');
      doc.text(`Error: ${module.error}`);
      doc.fillColor('black');
    }

    doc.moveDown(2);
  }

  // Summary
  doc.addPage();
  doc.fontSize(16).text('Summary', { underline: true });
  doc.moveDown();
  doc.fontSize(12);
  doc.text(`Total Cost: ${analysis.actual_cost || analysis.estimated_cost} credits`);
  doc.text(`Modules Completed: ${modules.filter(m => m.status === 'completed').length} / ${modules.length}`);
  
  if (analysis.completed_at) {
    doc.text(`Completed: ${new Date(analysis.completed_at).toLocaleDateString()}`);
  }

  doc.end();

  // Wait for PDF to be generated
  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
  });
}

async function generateExcel(analysis: any, modules: any[]): Promise<Buffer> {
  // Dynamic import to avoid bundling issues if not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Analysis Overview');

  // Header row
  worksheet.columns = [
    { header: 'Analysis Name', key: 'name', width: 30 },
    { header: 'Company', key: 'company', width: 25 },
    { header: 'Product', key: 'product', width: 25 },
    { header: 'Target Market', key: 'market', width: 25 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Progress', key: 'progress', width: 15 },
    { header: 'Cost', key: 'cost', width: 15 },
  ];

  worksheet.addRow({
    name: analysis.name,
    company: analysis.company_name,
    product: analysis.product_name || '',
    market: analysis.target_market || '',
    status: analysis.status,
    progress: `${analysis.progress}%`,
    cost: analysis.actual_cost || analysis.estimated_cost,
  });

  worksheet.addRow({}); // Empty row

  // Modules sheet
  const modulesSheet = workbook.addWorksheet('Modules');
  modulesSheet.columns = [
    { header: 'Module Type', key: 'type', width: 25 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Progress', key: 'progress', width: 12 },
    { header: 'Cost', key: 'cost', width: 12 },
    { header: 'Started', key: 'started', width: 20 },
    { header: 'Completed', key: 'completed', width: 20 },
    { header: 'Error', key: 'error', width: 50 },
  ];

  for (const module of modules) {
    modulesSheet.addRow({
      type: getModuleDisplayName(module.module_type),
      status: module.status,
      progress: `${module.progress}%`,
      cost: module.cost,
      started: module.started_at ? new Date(module.started_at).toLocaleString() : '',
      completed: module.completed_at ? new Date(module.completed_at).toLocaleString() : '',
      error: module.error || '',
    });
  }

  // Module data sheets
  for (const module of modules) {
    if (module.data && module.status === 'completed') {
      const moduleSheet = workbook.addWorksheet(getModuleDisplayName(module.module_type).substring(0, 31));
      addModuleDataToSheet(moduleSheet, module.module_type, module.data);
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function getModuleDisplayName(moduleType: string): string {
  const names: Record<string, string> = {
    market_demand: 'Market Demand',
    revenue_intelligence: 'Revenue Intelligence',
    competitive_intelligence: 'Competitive Intelligence',
    social_sentiment: 'Social Sentiment',
    financial_modeling: 'Financial Modeling',
    risk_assessment: 'Risk Assessment',
    operational_feasibility: 'Operational Feasibility',
  };
  return names[moduleType] || moduleType;
}

function formatModuleDataForPDF(moduleType: string, data: any): string {
  try {
    if (typeof data === 'string') {
      return data.substring(0, 5000); // Limit length
    }

    // Format based on module type
    if (moduleType === 'market_demand' && data.tam) {
      return `TAM: ${data.tam.value} ${data.tam.currency || 'USD'}\n` +
             `SAM: ${data.sam?.value || 'N/A'} ${data.sam?.currency || 'USD'}\n` +
             `SOM: ${data.som?.value || 'N/A'} ${data.som?.currency || 'USD'}\n` +
             `Growth Rate: ${data.growth_rate?.cagr || 'N/A'}%`;
    }

    if (moduleType === 'financial_modeling' && data.unit_economics) {
      return `ARPU: ${data.unit_economics.average_revenue_per_user || 'N/A'}\n` +
             `CAC: ${data.unit_economics.customer_acquisition_cost || 'N/A'}\n` +
             `LTV: ${data.unit_economics.lifetime_value || 'N/A'}\n` +
             `LTV/CAC: ${data.unit_economics.ltv_cac_ratio || 'N/A'}`;
    }

    if (moduleType === 'risk_assessment' && data.risks) {
      return `Total Risks: ${data.risks.length}\n` +
             `Overall Risk Score: ${data.overall_risk_score || 'N/A'}\n` +
             `High Risks: ${data.risks.filter((r: any) => r.risk_score >= 15).length}`;
    }

    // Default: JSON stringify (truncated)
    return JSON.stringify(data, null, 2).substring(0, 5000);
  } catch {
    return 'Data formatting error';
  }
}

function addModuleDataToSheet(sheet: any, moduleType: string, data: any): void {
  try {
    // Market Demand
    if (moduleType === 'market_demand' && data.tam) {
      sheet.addRow(['Metric', 'Value', 'Currency', 'Source']);
      sheet.addRow(['TAM', data.tam.value, data.tam.currency || 'USD', data.tam.source || '']);
      if (data.sam) sheet.addRow(['SAM', data.sam.value, data.sam.currency || 'USD', data.sam.source || '']);
      if (data.som) sheet.addRow(['SOM', data.som.value, data.som.currency || 'USD', '']);
      if (data.growth_rate) {
        sheet.addRow(['CAGR', `${data.growth_rate.cagr}%`, '', data.growth_rate.source || '']);
      }
      return;
    }

    // Financial Modeling
    if (moduleType === 'financial_modeling') {
      if (data.unit_economics) {
        sheet.addRow(['Unit Economics']);
        sheet.addRow(['Metric', 'Value']);
        Object.entries(data.unit_economics).forEach(([key, value]) => {
          sheet.addRow([key.replace(/_/g, ' ').toUpperCase(), value]);
        });
        sheet.addRow([]);
      }

      if (data.revenue_projections) {
        sheet.addRow(['Revenue Projections']);
        sheet.addRow(['Year', 'Revenue', 'Customers', 'Growth Rate']);
        data.revenue_projections.forEach((proj: any) => {
          sheet.addRow([proj.year, proj.revenue, proj.customers, `${proj.growth_rate}%`]);
        });
      }
      return;
    }

    // Risk Assessment
    if (moduleType === 'risk_assessment' && data.risks) {
      sheet.addRow(['Risk ID', 'Category', 'Name', 'Likelihood', 'Impact', 'Score']);
      data.risks.forEach((risk: any) => {
        sheet.addRow([
          risk.id,
          risk.category,
          risk.name,
          risk.likelihood,
          risk.impact,
          risk.risk_score,
        ]);
      });
      return;
    }

    // Default: Flatten JSON
    sheet.addRow(['Key', 'Value']);
    const flatten = (obj: any, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, newKey);
        } else {
          sheet.addRow([newKey, String(value)]);
        }
      }
    };
    flatten(data);
  } catch (error) {
    sheet.addRow(['Error formatting data:', String(error)]);
  }
}

export default asyncHandler(handler);
