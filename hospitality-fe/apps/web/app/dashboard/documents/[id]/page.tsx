'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit3,
  Check,
  X,
  Download,
  Info,
  Truck,
  FileText,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Trash2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { getApiClient } from '../../../../store/auth';

interface SupplierData {
  id?: number;
  name?: string;
  legal_name?: string;
  vat_id?: string;
  address?: string;
}

interface InvoiceLineData {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name?: string;
  unit?: string;
  iva_pct?: number;
  base?: number;
  provider_code?: string;
  gross_price?: number;
  discount_pct?: number;
  applied_discount?: number;
  other_fees?: number;
  nominal_price?: number;
}

interface TaxBracketData {
  id: number;
  rate_pct: number;
  base: number;
  iva_amount: number;
  row_total: number;
  equivalence_surcharge_rate?: number;
  equivalence_surcharge?: number;
}

interface InvoiceDetail {
  id: number;
  invoice_number?: string;
  document_number?: string;
  issue_date?: string;
  total_amount: number;
  total_with_iva?: number;
  base_amount?: number;
  iva_amount?: number;
  discount?: number;
  status: string;
  supplier?: SupplierData;
  supplier_display_name?: string;
  lines: InvoiceLineData[];
  tax_brackets: TaxBracketData[];
  payment_status?: string;
  reconciliation_status?: string;
  needs_review: boolean;
  ocr_confidence?: number;
  extraction_method?: string;
  supplier_contact_count?: number;
  paye?: number;
  green_point?: number;
  ibee?: number;
  attributable_cost?: number;
  tax_free_costs?: number;
  source_file?: string;
  review_reasons?: string;
  ocr_time?: number;
  llm_time?: number;
  ocr_duration?: number;
  llm_duration?: number;
  is_duplicate?: boolean;
  llm_confidence?: number;
}

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editing States
  const [editSupplier, setEditSupplier] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierLegalName, setSupplierLegalName] = useState('');
  const [supplierVatId, setSupplierVatId] = useState('');

  const [editGeneral, setEditGeneral] = useState(false);
  const [docType, setDocType] = useState('Invoice');
  const [docNum, setDocNum] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docCategory] = useState('Marketing and communication');

  const [editTotals, setEditTotals] = useState(false);
  const [editLines, setEditLines] = useState(false);
  const [linesData, setLinesData] = useState<any[]>([]);

  // VAT Breakdown state
  const [editVat, setEditVat] = useState(false);
  const [vatData, setVatData] = useState<any[]>([]);

  const [baseAmount, setBaseAmount] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paye, setPaye] = useState(0);
  const [greenPoint, setGreenPoint] = useState(0);
  const [ibee, setIbee] = useState(0);
  const [attributableCost, setAttributableCost] = useState(0);
  const [taxFreeCosts, setTaxFreeCosts] = useState(0);

  // Zoom state for image preview
  const [zoomLevel, setZoomLevel] = useState(1);
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.5, 0.5));

  // Load Invoice Details from Backend
  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const client = getApiClient();
        const data = await client.getInvoiceDetails(Number(id));
        setInvoice(data);

        // Initialize editing inputs
        if (data) {
          setSupplierName(data.supplier_display_name || data.supplier?.name || '');
          setSupplierLegalName(data.supplier_legal_name || data.supplier?.legal_name || '');
          setSupplierVatId(data.supplier_tax_id || data.supplier?.vat_id || '');

          setDocNum(data.document_number || data.invoice_number || '');
          setDocDate(data.issue_date ? new Date(data.issue_date).toISOString().split('T')[0] : '');
          if (data.document_type) {
            const val = data.document_type.toLowerCase();
            if (val === 'invoice') setDocType('Invoice');
            else if (val === 'credit note' || val === 'credit_note') setDocType('Credit note');
            else if (val === 'receipt') setDocType('Receipt');
            else
              setDocType(data.document_type.charAt(0).toUpperCase() + data.document_type.slice(1));
          } else {
            setDocType('Invoice');
          }

          setBaseAmount(
            data.base_amount !== undefined && data.base_amount !== null
              ? data.base_amount
              : data.total_amount || 0
          );
          setVatAmount(data.iva_amount || 0);
          setDiscount(data.discount || 0);
          setPaye(data.paye || 0);
          setGreenPoint(data.green_point || 0);
          setIbee(data.ibee || 0);
          setAttributableCost(data.attributable_cost || 0);
          setTaxFreeCosts(data.tax_free_costs || 0);
          setLinesData(data.lines || []);
          setVatData(data.tax_brackets || []);
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Document not found. It may have been deleted.');
        } else {
          console.warn('Error loading invoice details:', err);
          setError('Failed to load document details. Please ensure the backend is running.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();

    // Polling if invoice is PENDING
    const pollStatus = async (intervalId: NodeJS.Timeout) => {
      try {
        const client = getApiClient();
        const statusData = await client.getInvoiceDetails(Number(id)); // Reuse details fetch to grab all data when ready
        if (statusData.status === 'PROCESSED' || statusData.status === 'FAILED') {
          clearInterval(intervalId);
          setInvoice(statusData);
          if (statusData) {
            setSupplierName(statusData.supplier_display_name || statusData.supplier?.name || '');
            setSupplierLegalName(
              statusData.supplier_legal_name || statusData.supplier?.legal_name || ''
            );
            setSupplierVatId(statusData.supplier_tax_id || statusData.supplier?.vat_id || '');
            setDocNum(statusData.document_number || statusData.invoice_number || '');
            setDocDate(
              statusData.issue_date
                ? new Date(statusData.issue_date).toISOString().split('T')[0]
                : ''
            );

            if (statusData.document_type) {
              const val = statusData.document_type.toLowerCase();
              if (val === 'invoice') setDocType('Invoice');
              else if (val === 'credit note' || val === 'credit_note') setDocType('Credit note');
              else if (val === 'receipt') setDocType('Receipt');
              else
                setDocType(
                  statusData.document_type.charAt(0).toUpperCase() +
                    statusData.document_type.slice(1)
                );
            } else {
              setDocType('Invoice');
            }

            setBaseAmount(
              statusData.base_amount !== undefined && statusData.base_amount !== null
                ? statusData.base_amount
                : statusData.total_amount || 0
            );
            setVatAmount(statusData.iva_amount || 0);
            setDiscount(statusData.discount || 0);
            setPaye(statusData.paye || 0);
            setGreenPoint(statusData.green_point || 0);
            setIbee(statusData.ibee || 0);
            setAttributableCost(statusData.attributable_cost || 0);
            setTaxFreeCosts(statusData.tax_free_costs || 0);
            setLinesData(statusData.lines || []);
            setVatData(statusData.tax_brackets || []);
          }
        }
      } catch (err) {
        console.warn('Error polling status:', err);
      }
    };

    const interval = setInterval(() => {
      // We check if the current state in ref or just naive interval
      // Better to just fetch and see
      pollStatus(interval);
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] gap-3">
        <RefreshCw size={36} className="text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading document details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle size={48} className="text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Error Loading Document</h2>
        <p className="text-sm text-muted-foreground">{error || 'Document not found.'}</p>
        <button
          onClick={() => router.push('/dashboard/documents')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Back to Documents
        </button>
      </div>
    );
  }

  // Format currency helper
  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '€0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(val);
  };

  // MinIO preview URL
  const backendFileUrl = invoice.source_file || '';
  const fileExtension = backendFileUrl.split('.').pop()?.toLowerCase() || 'pdf';

  // If backend didn't provide a full URL, fallback to local minio construct
  const objectName = `invoice_${invoice.id}.${fileExtension}`;
  const minioUrl = process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9012';
  const fileUrl = backendFileUrl.startsWith('http')
    ? backendFileUrl
    : `${minioUrl}/invoices/${objectName}?cb=${Date.now()}`;

  // Formatted display values
  const standardVatRates = [0, 2, 4, 5, 7.5, 10, 12, 21];

  const handleSaveSupplier = async () => {
    if (invoice) {
      try {
        const client = getApiClient();
        await client.updateInvoice(invoice.id, {
          supplierName: supplierName,
          supplier: {
            ...invoice.supplier,
            name: supplierName,
            legal_name: supplierLegalName,
            vat_id: supplierVatId
          }
        });
        setInvoice({
          ...invoice,
          supplier_display_name: supplierName,
          supplier_legal_name: supplierLegalName,
          supplier_tax_id: supplierVatId,
          supplier: {
            ...invoice.supplier,
            name: supplierName,
            legal_name: supplierLegalName,
            vat_id: supplierVatId
          }
        } as any);
      } catch (err) {
        console.error('Failed to update supplier:', err);
      }
    }
    setEditSupplier(false);
  };

  const handleSaveGeneral = async () => {
    if (invoice) {
      try {
        const client = getApiClient();
        await client.updateInvoice(invoice.id, {
          documentNumber: docNum,
          invoiceNumber: docNum,
          date: docDate
        });
        setInvoice({
          ...invoice,
          document_number: docNum,
          invoice_number: docNum,
          issue_date: docDate
        } as any);
      } catch (err) {
        console.error('Failed to update general info:', err);
      }
    }
    setEditGeneral(false);
  };

  const handleSaveTotals = async () => {
    if (invoice) {
      try {
        const total =
          baseAmount + vatAmount + greenPoint + ibee + attributableCost + taxFreeCosts - discount;
        const client = getApiClient();
        await client.updateInvoice(invoice.id, {
          baseAmount: baseAmount,
          ivaAmount: vatAmount,
          discount: discount,
          totalAmount: total,
          taxFreeCosts: taxFreeCosts
        });
        setInvoice({
          ...invoice,
          total_amount: total,
          base_amount: baseAmount,
          iva_amount: vatAmount,
          discount: discount,
          green_point: greenPoint,
          ibee: ibee,
          attributable_cost: attributableCost,
          tax_free_costs: taxFreeCosts
        } as any);
      } catch (err) {
        console.error('Failed to update totals:', err);
      }
    }
    setEditTotals(false);
  };

  const handleSaveLines = async () => {
    if (invoice) {
      try {
        const client = getApiClient();
        await client.updateInvoice(invoice.id, {
          lines: linesData
        });
        setInvoice({
          ...invoice,
          lines: linesData
        } as any);
      } catch (e) {
        console.error('Failed to update line items', e);
        alert('Failed to update line items.');
      }
    }
    setEditLines(false);
  };

  const handleLineChange = (index: number, field: string, value: string | number) => {
    const updated = [...linesData];
    updated[index] = { ...updated[index], [field]: value };
    setLinesData(updated);
  };

  const handleSaveVat = async () => {
    if (invoice) {
      try {
        const client = getApiClient();
        await client.updateInvoice(invoice.id, { tax_brackets: vatData });
        setInvoice({ ...invoice, tax_brackets: vatData } as any);
      } catch (e) {
        console.error('Failed to update VAT breakdown', e);
        alert('Failed to update VAT breakdown.');
      }
    }
    setEditVat(false);
  };

  const handleVatChange = (index: number, field: string, value: number) => {
    const updated = [...vatData];
    updated[index] = { ...updated[index], [field]: value };
    setVatData(updated);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto font-sans flex flex-col gap-6">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/documents')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Documents</span>
        </button>
        <div className="flex items-center gap-2">
          {invoice.needs_review && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fbf1dd] text-[#b07a1a] text-xs font-semibold">
              <AlertTriangle size={14} />
              Review required
            </span>
          )}
          {invoice.is_duplicate && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fceaea] text-[#b23a3a] text-xs font-semibold">
              <AlertTriangle size={14} />
              Duplicate
            </span>
          )}
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e6f4ec] text-[#1f8f5c] text-xs font-semibold capitalize">
            {invoice.status.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Duplicate Alert Panel */}
      {invoice.is_duplicate && (
        <div className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={17} className="text-[#b23a3a] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-sm font-bold text-[#7a2828]">Duplicate Detected</span>
              <p className="text-xs text-[#7a2828] opacity-90">
                This document is a duplicate of another invoice with the same document number from
                this supplier.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Needs Review Alert Panel */}
      {invoice.needs_review && (
        <div className="bg-[#fbf1dd]/40 border border-[#fbf1dd] rounded-xl p-4 flex gap-3 shadow-xs relative">
          <AlertTriangle size={18} className="text-[#b07a1a] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">Extraction Review Needed</h3>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {(() => {
                let reasons: string[] = [];
                try {
                  if (invoice.review_reasons) {
                    reasons = JSON.parse(invoice.review_reasons);
                  }
                } catch (e) {
                  // Fallback if it's not JSON
                  reasons = [invoice.review_reasons as string];
                }

                if (reasons.length > 0) {
                  return (
                    <ul className="list-disc pl-4 space-y-1 mt-1">
                      {reasons.map((reason, idx) => (
                        <li
                          key={idx}
                          className={
                            reason.includes('llm_fallback_error') ? 'text-red-500 font-medium' : ''
                          }
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  );
                }

                return (
                  <p>
                    Gemini flagged this document because some fields require human validation.
                    Common reasons include missing supplier matching or low confidence scores.
                  </p>
                );
              })()}
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                // Optimistically update UI first so badge changes immediately
                setInvoice({ ...invoice, needs_review: false, status: 'PROCESSED' } as any);
                const client = getApiClient();
                await client.updateInvoice(invoice.id, {
                  needs_review: false,
                  status: 'PROCESSED'
                });
              } catch (e) {
                console.error(e);
                // Revert on failure
                setInvoice({ ...invoice } as any);
                alert('Failed to update status');
              }
            }}
            className="absolute top-4 right-4 bg-[#b07a1a] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#8f6315] transition-colors"
          >
            Mark as Digitized
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Document File Preview (4 cols) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm min-h-[500px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText size={15} />
              Document Source
            </h2>
            <div className="flex items-center gap-1">
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                title="Open original file"
              >
                <ExternalLink size={15} />
              </a>
              <a
                href={fileUrl}
                download
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                title="Download original file"
              >
                <Download size={15} />
              </a>
            </div>
          </div>

          <div className="relative flex-1 bg-muted/30 rounded-lg border border-dashed border-border p-2 overflow-auto min-h-[500px]">
            {['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension) && (
              <div className="sticky top-2 float-right z-10 flex flex-col gap-2 bg-background/80 backdrop-blur-sm border border-border p-1 rounded-lg shadow-sm mr-2 mb-2">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={18} />
                </button>
                <div className="h-px bg-border/50 mx-1"></div>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={18} />
                </button>
              </div>
            )}
            <div className="flex items-center justify-center min-h-full">
              {fileExtension === 'pdf' ? (
                <embed
                  src={fileUrl}
                  type="application/pdf"
                  className="w-full h-[500px] rounded-md"
                />
              ) : ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension) ? (
                <img
                  src={fileUrl}
                  alt="Document preview"
                  className="max-w-none transition-all duration-200 ease-in-out rounded-md"
                  style={{ height: `${zoomLevel * 500}px` }}
                />
              ) : (
                <div className="text-center space-y-2 p-8">
                  <FileText size={48} className="text-muted-foreground/40 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Preview not available for .{fileExtension} files
                  </p>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs font-semibold text-primary hover:underline"
                  >
                    Open directly
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cards (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Supplier & General Information Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supplier Card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm relative">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Truck size={16} />
                  Supplier
                </h2>
                {!editSupplier ? (
                  <button
                    onClick={() => setEditSupplier(true)}
                    className="text-xs font-semibold border border-border hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSaveSupplier}
                      className="p-1 hover:bg-[#e6f4ec] text-[#1f8f5c] rounded-lg transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditSupplier(false)}
                      className="p-1 hover:bg-[#fceaea] text-[#b23a3a] rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {!editSupplier ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#e6eef8] border border-[#e2e1dd] text-[#2f6bb0] flex items-center justify-center text-sm font-bold shadow-2xs">
                      {supplierName.slice(0, 1).toUpperCase() || 'M'}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {supplierName || 'Unknown Supplier'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{supplierVatId || '—'}</p>
                    </div>
                  </div>
                  {supplierLegalName && (
                    <div className="pt-1 text-xs text-muted-foreground border-t border-border/60">
                      <span className="font-medium text-foreground block">Legal Name</span>
                      {supplierLegalName}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full mt-1 p-2 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Legal Name
                    </label>
                    <input
                      type="text"
                      value={supplierLegalName}
                      onChange={(e) => setSupplierLegalName(e.target.value)}
                      className="w-full mt-1 p-2 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      VAT ID / Tax ID
                    </label>
                    <input
                      type="text"
                      value={supplierVatId}
                      onChange={(e) => setSupplierVatId(e.target.value)}
                      className="w-full mt-1 p-2 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* General Information Card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Info size={16} />
                  General information
                </h2>
                {!editGeneral ? (
                  <button
                    onClick={() => setEditGeneral(true)}
                    className="text-xs font-semibold border border-border hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSaveGeneral}
                      className="p-1 hover:bg-[#e6f4ec] text-[#1f8f5c] rounded-lg transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditGeneral(false)}
                      className="p-1 hover:bg-[#fceaea] text-[#b23a3a] rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {!editGeneral ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                    <span className="text-muted-foreground text-xs">Document type</span>
                    <span className="font-medium text-foreground">{docType}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                    <span className="text-muted-foreground text-xs">Document number</span>
                    <span className="font-mono text-foreground font-semibold">{docNum || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                    <span className="text-muted-foreground text-xs">Date</span>
                    <span className="font-medium text-foreground">
                      {docDate
                        ? new Date(docDate).toLocaleDateString('en-GB', { timeZone: 'UTC' })
                        : '—'}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center py-0.5 ${(invoice.ocr_duration !== undefined && invoice.ocr_duration !== null) || (invoice.llm_duration !== undefined && invoice.llm_duration !== null) ? 'border-b border-border/40' : ''}`}
                  >
                    <span className="text-muted-foreground text-xs">Category</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#e6eef8] text-[#2f6bb0] text-xs font-medium">
                      {docCategory}
                    </span>
                  </div>
                  {invoice.ocr_duration !== undefined && invoice.ocr_duration !== null && (
                    <div className="flex justify-between items-center py-0.5 border-t border-border/40 mt-1 pt-1">
                      <span className="text-muted-foreground text-xs">OCR Time</span>
                      <span className="font-medium text-foreground">
                        {invoice.ocr_duration.toFixed(2)}s
                      </span>
                    </div>
                  )}
                  {invoice.llm_duration !== undefined && invoice.llm_duration !== null && (
                    <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                      <span className="text-muted-foreground text-xs">LLM Time</span>
                      <span className="font-medium text-foreground">
                        {invoice.llm_duration.toFixed(2)}s
                      </span>
                    </div>
                  )}
                  {invoice.extraction_method && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground text-xs">Method</span>
                      <span className="font-medium text-foreground capitalize">
                        {invoice.extraction_method}
                      </span>
                    </div>
                  )}
                  {invoice.ocr_confidence !== undefined && invoice.ocr_confidence !== null && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground text-xs">OCR Confidence</span>
                      <span
                        className={`font-medium text-xs px-2 py-0.5 rounded-full ${
                          invoice.ocr_confidence >= 0.7
                            ? 'bg-[#e6f4ec] text-[#1f8f5c]'
                            : invoice.ocr_confidence >= 0.4
                              ? 'bg-[#fbf1dd] text-[#b07a1a]'
                              : 'bg-[#fceaea] text-[#b23a3a]'
                        }`}
                      >
                        {(invoice.ocr_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {invoice.llm_confidence !== undefined && invoice.llm_confidence !== null && (
                    <div className="flex justify-between items-center py-0.5 mt-1">
                      <span className="text-muted-foreground text-xs">LLM Confidence</span>
                      <span
                        className={`font-medium text-xs px-2 py-0.5 rounded-full ${
                          invoice.llm_confidence >= 0.7
                            ? 'bg-[#e6f4ec] text-[#1f8f5c]'
                            : invoice.llm_confidence >= 0.4
                              ? 'bg-[#fbf1dd] text-[#b07a1a]'
                              : 'bg-[#fceaea] text-[#b23a3a]'
                        }`}
                      >
                        {(invoice.llm_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Document Type
                    </label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full mt-1 p-2 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option>Invoice</option>
                      <option>Credit note</option>
                      <option>Receipt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Document Number
                    </label>
                    <input
                      type="text"
                      value={docNum}
                      onChange={(e) => setDocNum(e.target.value)}
                      className="w-full mt-1 p-2 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Document Date
                    </label>
                    <input
                      type="date"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                      className="w-full mt-1 p-2 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Totals & VAT breakdown sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Total (with VAT) Card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    TOTAL (with VAT)
                  </span>
                  <span className="text-3xl font-extrabold text-foreground font-mono mt-1 block">
                    {formatCurrency(
                      invoice.total_with_iva !== undefined && invoice.total_with_iva !== null
                        ? invoice.total_with_iva
                        : invoice.total_amount
                    )}
                  </span>
                </div>
                {!editTotals ? (
                  <button
                    onClick={() => setEditTotals(true)}
                    className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                  >
                    <Edit3 size={15} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSaveTotals}
                      className="p-1.5 hover:bg-[#e6f4ec] text-[#1f8f5c] rounded-lg transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditTotals(false)}
                      className="p-1.5 hover:bg-[#fceaea] text-[#b23a3a] rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {!editTotals ? (
                <div className="grid grid-cols-2 gap-3 pt-2 text-sm border-t border-border/40">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Base amount</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.base_amount !== undefined && invoice.base_amount !== null
                          ? invoice.base_amount
                          : invoice.total_amount - (invoice.iva_amount || 0)
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">VAT amount</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.iva_amount !== undefined && invoice.iva_amount !== null
                          ? invoice.iva_amount
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Line Discounts</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.lines?.reduce(
                          (sum, line) => sum + (line.applied_discount || 0),
                          0
                        ) || 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Global Discount</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.discount !== undefined && invoice.discount !== null
                          ? invoice.discount
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">PAYE</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.paye !== undefined && invoice.paye !== null ? invoice.paye : 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Green Point</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.green_point !== undefined && invoice.green_point !== null
                          ? invoice.green_point
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">IBEE</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.ibee !== undefined && invoice.ibee !== null ? invoice.ibee : 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Attributable cost</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.attributable_cost !== undefined &&
                          invoice.attributable_cost !== null
                          ? invoice.attributable_cost
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Tax-free costs</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatCurrency(
                        invoice.tax_free_costs !== undefined && invoice.tax_free_costs !== null
                          ? invoice.tax_free_costs
                          : 0
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40 max-h-[300px] overflow-y-auto pr-1">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Base amount
                    </label>
                    <input
                      type="number"
                      value={baseAmount}
                      onChange={(e) => setBaseAmount(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      VAT amount
                    </label>
                    <input
                      type="number"
                      value={vatAmount}
                      onChange={(e) => setVatAmount(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Discount
                    </label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      PAYE
                    </label>
                    <input
                      type="number"
                      value={paye}
                      onChange={(e) => setPaye(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Green Point
                    </label>
                    <input
                      type="number"
                      value={greenPoint}
                      onChange={(e) => setGreenPoint(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      IBEE
                    </label>
                    <input
                      type="number"
                      value={ibee}
                      onChange={(e) => setIbee(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Attributable Cost
                    </label>
                    <input
                      type="number"
                      value={attributableCost}
                      onChange={(e) => setAttributableCost(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Tax-free Costs
                    </label>
                    <input
                      type="number"
                      value={taxFreeCosts}
                      onChange={(e) => setTaxFreeCosts(Number(e.target.value))}
                      className="w-full mt-0.5 p-1.5 bg-muted/40 border border-border rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* VAT breakdown Card */}
            <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  VAT breakdown
                </h2>
                {!editVat ? (
                  <button
                    onClick={() => setEditVat(true)}
                    className="text-xs font-semibold border border-border hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSaveVat}
                      className="p-1 hover:bg-[#e6f4ec] text-[#1f8f5c] rounded-lg transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setEditVat(false);
                        setVatData(invoice.tax_brackets || []);
                      }}
                      className="p-1 hover:bg-[#fceaea] text-[#b23a3a] rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-[#fafaf8] border-b border-border text-muted-foreground font-semibold">
                      <th className="px-3 py-2 text-center">VAT</th>
                      <th className="px-3 py-2 text-right">Base amount</th>
                      <th className="px-3 py-2 text-right">VAT (€)</th>
                      <th className="px-3 py-2 text-center">IS (%)</th>
                      <th className="px-3 py-2 text-right">ES (€)</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standardVatRates.map((rate) => {
                      // Look up matching bracket
                      let bracketIdx = -1;
                      let bracket = null;

                      if (editVat) {
                        bracketIdx = vatData.findIndex((b) => Math.round(b.rate_pct) === rate);
                        bracket = bracketIdx >= 0 ? vatData[bracketIdx] : null;
                      } else {
                        bracket = invoice.tax_brackets?.find(
                          (b) => Math.round(b.rate_pct) === rate
                        );
                      }

                      return (
                        <tr key={rate} className="border-b border-border/40 hover:bg-muted/10">
                          <td className="px-3 py-2 text-center font-bold text-foreground bg-muted/10">
                            {rate}%
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {editVat && bracket ? (
                              <input
                                type="number"
                                className="w-20 p-1 text-xs border rounded text-right"
                                value={bracket.base || 0}
                                onChange={(e) =>
                                  handleVatChange(bracketIdx, 'base', Number(e.target.value))
                                }
                              />
                            ) : bracket ? (
                              formatCurrency(bracket.base)
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {editVat && bracket ? (
                              <input
                                type="number"
                                className="w-20 p-1 text-xs border rounded text-right"
                                value={bracket.iva_amount || 0}
                                onChange={(e) =>
                                  handleVatChange(bracketIdx, 'iva_amount', Number(e.target.value))
                                }
                              />
                            ) : bracket ? (
                              formatCurrency(bracket.iva_amount)
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                            {editVat && bracket ? (
                              <input
                                type="number"
                                className="w-16 p-1 text-xs border rounded text-center"
                                value={bracket.equivalence_surcharge_rate || 0}
                                onChange={(e) =>
                                  handleVatChange(
                                    bracketIdx,
                                    'equivalence_surcharge_rate',
                                    Number(e.target.value)
                                  )
                                }
                              />
                            ) : bracket?.equivalence_surcharge_rate !== undefined &&
                              bracket?.equivalence_surcharge_rate !== null ? (
                              `${bracket.equivalence_surcharge_rate}%`
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {editVat && bracket ? (
                              <input
                                type="number"
                                className="w-20 p-1 text-xs border rounded text-right"
                                value={bracket.equivalence_surcharge || 0}
                                onChange={(e) =>
                                  handleVatChange(
                                    bracketIdx,
                                    'equivalence_surcharge',
                                    Number(e.target.value)
                                  )
                                }
                              />
                            ) : bracket?.equivalence_surcharge !== undefined &&
                              bracket?.equivalence_surcharge !== null ? (
                              formatCurrency(bracket.equivalence_surcharge)
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                            {editVat && bracket ? (
                              <input
                                type="number"
                                className="w-20 p-1 text-xs border rounded text-right"
                                value={bracket.row_total || 0}
                                onChange={(e) =>
                                  handleVatChange(bracketIdx, 'row_total', Number(e.target.value))
                                }
                              />
                            ) : bracket ? (
                              formatCurrency(
                                bracket.row_total ||
                                  (bracket.base || 0) +
                                    (bracket.iva_amount || 0) +
                                    (bracket.equivalence_surcharge || 0)
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Line Items (Full Width Bottom) */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-2">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Line Items ({invoice.lines?.length || 0})
          </h2>
          {!editLines ? (
            <button
              onClick={() => setEditLines(true)}
              className="text-xs font-semibold border border-border hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSaveLines}
                className="p-1 hover:bg-[#e6f4ec] text-[#1f8f5c] rounded-lg transition-colors"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setEditLines(false);
                  setLinesData(invoice.lines || []);
                }}
                className="p-1 hover:bg-[#fceaea] text-[#b23a3a] rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#fafaf8] border-b border-border text-muted-foreground font-semibold">
                <th className="px-5 py-3 whitespace-nowrap">Provider Code</th>
                <th className="px-5 py-3 whitespace-nowrap">Product</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Quantity</th>
                <th className="px-5 py-3 whitespace-nowrap text-center">Unit</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Gross Price</th>
                <th className="px-5 py-3 whitespace-nowrap text-center">Discounts</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Applied Discount</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Other Fees</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Nominal Price</th>
                <th className="px-5 py-3 whitespace-nowrap text-center">IVA</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Base</th>
                <th className="px-5 py-3 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {linesData && linesData.length > 0 ? (
                linesData.map((line, idx) => (
                  <tr
                    key={line.id || idx}
                    className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="text"
                          className="w-24 p-1 text-xs border rounded"
                          value={line.provider_code || ''}
                          onChange={(e) => handleLineChange(idx, 'provider_code', e.target.value)}
                        />
                      ) : (
                        line.provider_code || '—'
                      )}
                    </td>
                    <td className="px-5 py-3 font-semibold text-foreground min-w-[200px]">
                      {editLines ? (
                        <input
                          type="text"
                          className="w-full p-1 text-xs border rounded"
                          value={
                            line.description ||
                            line.product_name ||
                            (typeof line.product === 'object'
                              ? line.product?.name
                              : line.product) ||
                            ''
                          }
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                        />
                      ) : (
                        line.description ||
                        line.product_name ||
                        (typeof line.product === 'object' ? line.product?.name : line.product)
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-16 p-1 text-xs border rounded text-right"
                          value={line.quantity || 0}
                          onChange={(e) =>
                            handleLineChange(idx, 'quantity', Number(e.target.value))
                          }
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="text"
                          className="w-16 p-1 text-xs border rounded text-center"
                          value={line.unit || ''}
                          onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                        />
                      ) : (
                        line.unit || '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-20 p-1 text-xs border rounded text-right"
                          value={line.gross_price || 0}
                          onChange={(e) =>
                            handleLineChange(idx, 'gross_price', Number(e.target.value))
                          }
                        />
                      ) : line.gross_price !== undefined && line.gross_price !== null ? (
                        formatCurrency(line.gross_price)
                      ) : (
                        formatCurrency(line.unit_price)
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-16 p-1 text-xs border rounded text-center"
                          value={line.discount_pct || 0}
                          onChange={(e) =>
                            handleLineChange(idx, 'discount_pct', Number(e.target.value))
                          }
                        />
                      ) : line.discount_pct !== undefined && line.discount_pct !== null ? (
                        `${line.discount_pct}%`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-20 p-1 text-xs border rounded text-right"
                          value={line.applied_discount || 0}
                          onChange={(e) =>
                            handleLineChange(idx, 'applied_discount', Number(e.target.value))
                          }
                        />
                      ) : line.applied_discount !== undefined && line.applied_discount !== null ? (
                        formatCurrency(line.applied_discount)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-20 p-1 text-xs border rounded text-right"
                          value={line.other_fees || 0}
                          onChange={(e) =>
                            handleLineChange(idx, 'other_fees', Number(e.target.value))
                          }
                        />
                      ) : line.other_fees !== undefined && line.other_fees !== null ? (
                        formatCurrency(line.other_fees)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-20 p-1 text-xs border rounded text-right"
                          value={line.nominal_price || line.unit_price || 0}
                          onChange={(e) =>
                            handleLineChange(idx, 'nominal_price', Number(e.target.value))
                          }
                        />
                      ) : line.nominal_price !== undefined && line.nominal_price !== null ? (
                        formatCurrency(line.nominal_price)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-16 p-1 text-xs border rounded text-center"
                          value={line.iva_pct || 0}
                          onChange={(e) => handleLineChange(idx, 'iva_pct', Number(e.target.value))}
                        />
                      ) : line.iva_pct !== undefined && line.iva_pct !== null ? (
                        `${line.iva_pct}%`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                      {editLines ? (
                        <input
                          type="number"
                          className="w-20 p-1 text-xs border rounded text-right"
                          value={line.base || line.total_price || 0}
                          onChange={(e) => handleLineChange(idx, 'base', Number(e.target.value))}
                        />
                      ) : line.base !== undefined && line.base !== null ? (
                        formatCurrency(line.base)
                      ) : line.total_price !== undefined &&
                        line.total_price !== null &&
                        line.iva_pct !== undefined &&
                        line.iva_pct !== null ? (
                        formatCurrency(line.total_price / (1 + line.iva_pct / 100))
                      ) : line.gross_price !== undefined && line.gross_price !== null ? (
                        formatCurrency(line.gross_price)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this line item?')) {
                            if (line.id) {
                              try {
                                const client = getApiClient();
                                await client.deleteInvoiceLine(invoice.id, line.id);
                                const updated = linesData.filter((_, i) => i !== idx);
                                setLinesData(updated);
                                setInvoice({ ...invoice, lines: updated } as any);
                              } catch (e) {
                                console.error(e);
                                alert('Failed to delete line item');
                              }
                            } else {
                              const updated = linesData.filter((_, i) => i !== idx);
                              setLinesData(updated);
                            }
                          }
                        }}
                        className="p-1.5 hover:bg-[#fceaea] text-[#b23a3a] rounded-lg transition-colors"
                        title="Delete line"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="px-5 py-8 text-center text-muted-foreground">
                    No line items found for this document.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
