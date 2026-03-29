/* eslint-disable no-useless-escape */
import Tesseract from 'tesseract.js';

const { createWorker } = Tesseract;

let workerInstance = null;
let workerReady = false;

async function getWorker() {
  // If the previous worker is broken, discard it
  if (workerInstance && !workerReady) {
    try { await workerInstance.terminate(); } catch (_) { /* ignore */ }
    workerInstance = null;
  }

  if (!workerInstance) {
    try {
      console.log('[OCR] Initializing Tesseract worker...');
      workerInstance = await createWorker('eng', 1, {
        logger: m => {
          if (m.status) console.log(`[OCR] ${m.status}: ${Math.round((m.progress || 0) * 100)}%`);
        },
      });
      workerReady = true;
      console.log('[OCR] Worker ready');
    } catch (err) {
      console.error('[OCR] Worker initialization failed:', err);
      workerInstance = null;
      workerReady = false;
      throw new Error('Failed to initialize OCR engine: ' + (err?.message || err));
    }
  }
  return workerInstance;
}

// Convert a File/Blob to a data URL for more reliable recognition
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Extract text from a receipt image and attempt to parse structured data
export async function extractReceiptData(imageFile) {
  let w;
  try {
    w = await getWorker();
  } catch (initErr) {
    console.error('[OCR] Cannot get worker:', initErr);
    throw initErr;
  }

  try {
    // Convert File to dataURL for cross-browser reliability
    let imageInput = imageFile;
    if (imageFile instanceof File || imageFile instanceof Blob) {
      imageInput = await fileToDataURL(imageFile);
    }

    console.log('[OCR] Starting recognition...');
    const ocrResult = await w.recognize(imageInput);
    console.log('[OCR] Raw recognize result:', ocrResult);
    // tesseract.js v5+ returns { data: { text } }, but some versions return { jobId, data: { text } }
    const text = ocrResult?.data?.text || '';
    console.log('[OCR] Raw text extracted:', text.substring(0, 200));

    if (!text || text.trim().length === 0) {
      console.warn('[OCR] No text could be extracted from the image');
      return { rawText: '', amount: null, date: null, vendor: null, category: 'other', description: '' };
    }

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
      // Fallback: any number with decimal
      /([\d,]+\.\d{2})/,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (parsed > 0 && parsed < 1000000) {
          result.amount = parsed;
          break;
        }
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
      for (const line of lines.slice(0, 5)) {
        if (!/^\d+$/.test(line) && !/^\d{1,2}[\/\-]/.test(line) && line.length > 2) {
          result.vendor = line.substring(0, 60);
          break;
        }
      }
    }

    // Extract Description
    result.description = result.vendor || 'Auto-extracted expense';

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

    console.log('[OCR] Parsed result:', { amount: result.amount, date: result.date, vendor: result.vendor, category: result.category });
    return result;
  } catch (err) {
    console.error('[OCR] Recognition failed:', err);
    // Mark worker as broken so it gets recreated next time
    workerReady = false;
    throw new Error('OCR recognition failed: ' + (err?.message || err));
  }
}

export async function terminateWorker() {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
    } catch (_) { /* ignore */ }
    workerInstance = null;
    workerReady = false;
  }
}
