/* eslint-disable no-useless-escape */
import { createWorker } from 'tesseract.js';

let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await createWorker('eng');
  }
  return worker;
}

// Extract text from a receipt image and attempt to parse structured data
export async function extractReceiptData(imageFile) {
  try {
    const w = await getWorker();
    const { data: { text } } = await w.recognize(imageFile);

    const result = {
      rawText: text,
      amount: null,
      date: null,
      vendor: null,
    };

    // Extract amount — look for currency symbols and numbers
    const amountPatterns = [
      /(?:total|amount|sum|due|pay|grand\s*total)[:\s]*[₹$€£¥]?\s*([\d,]+\.?\d{0,2})/i,
      /[₹$€£¥]\s*([\d,]+\.?\d{0,2})/,
      /(?:total|amount)[:\s]*([\d,]+\.?\d{0,2})/i,
      /([\d,]+\.\d{2})\s*(?:total|due)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.amount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // Extract date
    const datePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
      /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s*\d{4})/i,
      /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          result.date = parsed.toISOString().split('T')[0];
        } else {
          result.date = match[1];
        }
        break;
      }
    }

    // Extract vendor — usually the first prominent line
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    if (lines.length > 0) {
      // Skip lines that are just numbers/dates
      for (const line of lines.slice(0, 5)) {
        if (!/^\d+$/.test(line) && !/^\d{1,2}[\/\-]/.test(line) && line.length > 2) {
          result.vendor = line.substring(0, 60);
          break;
        }
      }
    }

    // Extract Description (Use vendor or a general line)
    result.description = result.vendor || "Auto-extracted expense";

    // Auto-categorize based on keywords
    const lowerText = text.toLowerCase();
    if (/(flight|airline|airways|uber|lyft|taxi|train|transit|travel)/.test(lowerText)) {
      result.category = 'travel';
    } else if (/(restaurant|cafe|coffee|food|dining|snack|meal|lunch|dinner|pizza|burger)/.test(lowerText)) {
      result.category = 'food';
    } else if (/(hotel|inn|motel|resort|suites|room|lodging)/.test(lowerText)) {
      result.category = 'accommodation';
    } else if (/(staples|office|supply|supplies|paper|ink|printer|stationery|electronics)/.test(lowerText)) {
      result.category = 'office_supplies';
    } else {
      result.category = 'other';
    }

    return result;
  } catch (err) {
    console.error('OCR failed:', err);
    return { rawText: '', amount: null, date: null, vendor: null, category: 'other', description: '' };
  }
}

export async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
