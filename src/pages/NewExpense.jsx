/* eslint-disable no-unused-vars */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExpenseActions } from '../hooks/useExpenses';
import { convertCurrency } from '../lib/currency';
import { extractReceiptData } from '../lib/ocr';
import { Upload, Scan, Loader2, ArrowRight, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const categories = [
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'food', label: 'Food & Dining', icon: '🍽️' },
  { value: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { value: 'office_supplies', label: 'Office Supplies', icon: '📎' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const currencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD', 'AED', 'KRW'];

export default function NewExpense() {
  const { profile, company } = useAuth();
  const { createExpense, submitExpense, uploadReceipt } = useExpenseActions();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);

  const [form, setForm] = useState({
    amount: '',
    currency: company?.base_currency || 'USD',
    category: 'other',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    vendor: '',
  });

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target.result);
    reader.readAsDataURL(file);

    // Auto trigger scanning
    handleOCR(file);
  }

  async function handleOCR(fileToScan = receiptFile) {
    if (!fileToScan) return;

    setScanning(true);
    toast.loading('Scanning receipt with OCR...', { id: 'ocr' });

    try {
      const result = await extractReceiptData(fileToScan);

      if (result.amount) updateForm('amount', result.amount.toString());
      if (result.date) updateForm('expense_date', result.date);
      if (result.vendor) updateForm('vendor', result.vendor);
      if (result.category) updateForm('category', result.category);
      if (result.description && !form.description) updateForm('description', result.description);

      const extractedFields = [
        result.amount && 'amount',
        result.date && 'date',
        result.vendor && 'vendor',
        result.category !== 'other' && 'category',
      ].filter(Boolean);

      if (extractedFields.length > 0) {
        toast.success(`Extracted: ${extractedFields.join(', ')}`, { id: 'ocr' });
      } else {
        toast('Could not extract data. Please fill manually.', { id: 'ocr', icon: '⚠️' });
      }
    } catch (err) {
      console.error('OCR error:', err);
      toast.error(err.message || 'OCR failed. Please fill manually.', { id: 'ocr' });
    } finally {
      setScanning(false);
    }
  }

  function removeReceipt() {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e, asDraft = false) {
    e.preventDefault();

    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      // Currency conversion
      let convertedAmount = null;
      let exchangeRate = null;
      let baseCurrency = company?.base_currency || 'USD';

      if (form.currency !== baseCurrency) {
        const result = await convertCurrency(Number(form.amount), form.currency, baseCurrency);
        convertedAmount = result.convertedAmount;
        exchangeRate = result.exchangeRate;
      } else {
        convertedAmount = Number(form.amount);
        exchangeRate = 1;
      }

      // Upload receipt
      let receiptUrl = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile, null);
      }

      // Create expense
      const expense = await createExpense({
        amount: Number(form.amount),
        currency: form.currency,
        converted_amount: convertedAmount,
        base_currency: baseCurrency,
        exchange_rate: exchangeRate,
        category: form.category,
        description: form.description,
        expense_date: form.expense_date,
        vendor: form.vendor,
        receipt_url: receiptUrl,
        status: asDraft ? 'draft' : 'submitted',
      });

      if (!asDraft) {
        try {
          await submitExpense(expense.id);
          toast.success('Expense submitted for approval!');
        } catch (submitErr) {
          toast.error('Expense created but could not submit: ' + submitErr.message);
        }
      } else {
        toast.success('Draft saved');
      }

      navigate('/expenses');
    } catch (err) {
      toast.error(err.message || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-display text-3xl">New Expense</h2>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Fill in the details or scan a receipt to auto-fill
        </p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-8 animate-fade-in-up stagger-1">
        {/* Receipt Upload */}
        <div className="card-elevated">
          <h3 className="text-heading text-base mb-4">Receipt</h3>
          
          {receiptPreview ? (
            <div className="relative">
              <img
                src={receiptPreview}
                alt="Receipt preview"
                className="w-full max-h-64 object-contain rounded-lg bg-[var(--color-surface-secondary)]"
              />
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleOCR}
                  disabled={scanning}
                  className="btn-primary text-sm flex-1"
                >
                  {scanning ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Scan size={16} />
                  )}
                  {scanning ? 'Scanning...' : 'Scan Receipt (OCR)'}
                </button>
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="btn-secondary text-sm"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="receipt-upload"
              className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-text-muted)] transition-colors"
            >
              <Upload size={24} className="text-[var(--color-text-muted)] mb-2" />
              <p className="text-sm font-medium">Upload receipt</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                PNG, JPG, or PDF · Max 10MB
              </p>
              <input
                ref={fileInputRef}
                id="receipt-upload"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleReceiptUpload}
              />
            </label>
          )}
        </div>

        {/* Amount & Currency */}
        <div className="card-elevated">
          <h3 className="text-heading text-base mb-4">Amount</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-label block mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field text-xl font-bold"
                placeholder="0.00"
                value={form.amount}
                onChange={e => updateForm('amount', e.target.value)}
                required
                id="expense-amount"
              />
            </div>
            <div>
              <label className="text-label block mb-2">Currency</label>
              <select
                className="input-field"
                value={form.currency}
                onChange={e => updateForm('currency', e.target.value)}
                id="expense-currency"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {form.amount && form.currency !== company?.base_currency && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-2 animate-fade-in">
              Will be converted to {company?.base_currency} at current exchange rate
            </p>
          )}
        </div>

        {/* Details */}
        <div className="card-elevated">
          <h3 className="text-heading text-base mb-4">Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-label block mb-2">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => updateForm('category', cat.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      form.category === cat.value
                        ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-white'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                    }`}
                    id={`cat-${cat.value}`}
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-label block mb-2">Description</label>
              <input
                type="text"
                className="input-field"
                placeholder="What was this expense for?"
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                id="expense-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label block mb-2">Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.expense_date}
                  onChange={e => updateForm('expense_date', e.target.value)}
                  required
                  id="expense-date"
                />
              </div>
              <div>
                <label className="text-label block mb-2">Vendor</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Store or vendor name"
                  value={form.vendor}
                  onChange={e => updateForm('vendor', e.target.value)}
                  id="expense-vendor"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 justify-center py-3"
            id="expense-submit"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Submit for Approval
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={(e) => handleSubmit(e, true)}
            className="btn-secondary py-3"
            id="expense-save-draft"
          >
            <FileText size={18} />
            Save Draft
          </button>
        </div>
      </form>
    </div>
  );
}
