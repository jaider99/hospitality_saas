'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Search,
  FileText,
  Receipt,
  Truck,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  X,
  SlidersHorizontal,
  Calendar,
  CheckSquare,
  Download,
  MoreVertical,
  ExternalLink,
  ChevronDown,
  Columns,
  HelpCircle,
  Check,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Trash2
} from 'lucide-react';
import { documents } from '../mockData';
import { Btn } from '../_components/ui';
import { getApiClient } from '../../../store/auth';
import { API_BASE_URL } from '@hospitality-saas/constants';

export default function DocumentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showBanner, setShowBanner] = useState(true);

  // Web Dialog/Modal Filter States
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempStatusFilter, setTempStatusFilter] = useState<
    'All' | 'completed' | 'processing' | 'flagged' | 'rejected'
  >('All');
  const [tempSupplierFilter, setTempSupplierFilter] = useState<string>('All');

  // Date Range Filter States
  const [tempStartDateFilter, setTempStartDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [tempEndDateFilter, setTempEndDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [startDateFilter, setStartDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [endDateFilter, setEndDateFilter] = useState<string>(''); // YYYY-MM-DD

  const [statusFilter, setStatusFilter] = useState<
    'All' | 'completed' | 'processing' | 'flagged' | 'rejected'
  >('All');
  const [supplierFilter, setSupplierFilter] = useState<string>('All');

  // Column Visibility States
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    docNum: true,
    type: true,
    status: true,
    docDate: true,
    uploadDate: true,
    amount: true,
    paymentStatus: true
  });

  // Multi-selection checkboxes in table list
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Sorting dropdown state
  const [sortBy, setSortBy] = useState<'Upload date' | 'Document date' | 'Amount'>('Upload date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortOpen, setSortOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Server-Side API States
  const [apiDocs, setApiDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Document Upload States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [uploadingIds, setUploadingIds] = useState<Set<number>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Keep a stable ref to fetchInvoices so the SSE listener never closes over a stale version
  const fetchInvoicesRef = React.useRef<() => void>(() => {});

  const fetchInvoices = React.useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.getInvoices();
      if (Array.isArray(data)) {
        // Map backend invoices to table format using rich OCR fields
        const mapped = (data as any[]).map((inv: any) => ({
          id: inv.id || Math.random(),
          supplier: inv.supplier_display_name || inv.supplier?.name || 'Unknown Supplier',
          docNum: inv.document_number || inv.invoice_number || '—',
          date: inv.document_date
            ? new Date(inv.document_date).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              })
            : inv.issue_date
              ? new Date(inv.issue_date).toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric'
                })
              : '—',
          rawDate: inv.document_date || inv.issue_date || null,
          uploadDate: inv.created_at
            ? new Date(inv.created_at).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              })
            : new Date().toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              }),
          amount: inv.total_amount || inv.total_with_iva || 0.0,
          type: inv.document_type || 'Invoice',
          status:
            inv.needs_review
              ? 'flagged'
              : (inv.status === 'PROCESSED' || inv.status === 'completed')
                ? 'completed'
                : inv.status === 'FAILED'
                  ? 'rejected'
                  : 'processing',
          icon: 'invoice',
          paymentStatus: inv.payment_status || 'Pending',
          userInitials: (inv.uploaded_by || 'SYS').slice(0, 2).toUpperCase(),
          needsReview: inv.needs_review,
          ocrConfidence: inv.ocr_confidence,
          currency: inv.currency || 'EUR',
          reviewReasons: inv.review_reasons,
          isDuplicate: inv.is_duplicate,
        }));
        setApiDocs(mapped);

        // Auto-remove any uploadedDocs that are now returned by the backend
        const apiDocIds = new Set(mapped.map((d: any) => String(d.id)));
        setUploadedDocs((prev) => prev.filter((d) => !apiDocIds.has(String(d.id))));

        // Update uploadingIds list (remove any that finished processing/failed)
        setUploadingIds((prev) => {
          const next = new Set(prev);
          mapped.forEach((d: any) => {
            if (d.status !== 'processing') {
              next.delete(d.id);
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error('Error fetching invoices from backend:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep ref always pointing to latest fetchInvoices
  React.useEffect(() => { fetchInvoicesRef.current = fetchInvoices; }, [fetchInvoices]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Real-time EventSource listener to reload the documents list on webhook trigger
  useEffect(() => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const sseUrl = `${protocol}//${hostname}:8000/api/v1/invoices/events`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      if (event.data === 'reload') {
        console.log('Real-time reload event received from server webhook!');
        fetchInvoicesRef.current();
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects on transient errors (CONNECTING state).
      // Only log when the connection has been definitively closed.
      if (eventSource.readyState === EventSource.CLOSED) {
        console.warn('EventSource connection closed — real-time updates unavailable.');
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const allDocuments = [...uploadedDocs, ...apiDocs];

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadModalOpen(false);

    const client = getApiClient();

    for (const file of Array.from(files)) {
      // 1. Add a PENDING placeholder immediately to the table
      const placeholderDoc = {
        id: `pending-${Date.now()}-${Math.random()}`,
        supplier: '—',
        docNum: file.name,
        date: '—',
        uploadDate: new Date().toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        }),
        amount: 0,
        type: 'Invoice',
        status: 'processing',
        icon: 'invoice',
        paymentStatus: 'Pending',
        userInitials: 'AI',
        _pendingFile: file.name
      };
      setUploadedDocs((prev) => [placeholderDoc, ...prev]);

      try {
        // 2. POST file to backend → returns 202 with invoiceId
        const formData = new FormData();
        formData.append('file', file);
        const response = await client.uploadInvoice(formData);
        const invoiceId = response.invoiceId;

        // Replace placeholder with real ID
        setUploadedDocs((prev) =>
          prev.map((d) => (d.id === placeholderDoc.id ? { ...d, id: invoiceId } : d))
        );
        setUploadingIds((prev) => new Set(prev).add(invoiceId));
      } catch (uploadErr) {
        console.error('Upload error for', file.name, uploadErr);
        // Mark placeholder as failed
        setUploadedDocs((prev) =>
          prev.map((d) => (d.id === placeholderDoc.id ? { ...d, status: 'rejected' } : d))
        );
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Dynamic Metrics counts (from all documents)
  const countDigitizing = allDocuments.filter((d) => d.status === 'processing').length;
  const countReview = allDocuments.filter((d) => d.status === 'flagged').length;
  const countRejected = allDocuments.filter((d) => d.status === 'rejected').length;

  const parseDate = (dStr: string) => {
    if (!dStr || dStr === '—') return new Date(0);
    const parts = dStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dStr);
  };
  // Dropdown state for rows
  const [activeRowMenu, setActiveRowMenu] = useState<number | null>(null);

  const handleDeleteInvoice = async (id: number) => {
    try {
      const client = getApiClient();
      await client.deleteInvoice(id);
      await fetchInvoices();
      setActiveRowMenu(null);
    } catch (e) {
      console.error(e);
      alert('Failed to delete invoice');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const client = getApiClient();
      await client.bulkDeleteInvoices(selectedIds);
      setSelectedIds([]);
      await fetchInvoices();
    } catch (e) {
      console.error(e);
      alert('Failed to delete selected invoices');
    }
  };

  const handleDownloadInvoice = (doc: any) => {
    const fileExtension = (doc.source_file ? doc.source_file.split('.').pop()?.toLowerCase() : 'pdf') || 'pdf';
    const objectName = `invoice_${doc.id}.${fileExtension}`;
    window.open(`http://localhost:9012/invoices/${objectName}`, '_blank');
    setActiveRowMenu(null);
  };

  // Sync docs
  const filtered = allDocuments.filter((d) => {
    // Applied dialog filters
    if (statusFilter !== 'All' && d.status !== statusFilter) return false;
    if (
      supplierFilter !== 'All' &&
      !d.supplier.toLowerCase().includes(supplierFilter.toLowerCase())
    )
      return false;

    // Date Range Filter logic
    let docTime = d.rawDate ? new Date(d.rawDate).getTime() : parseDate(d.date).getTime();
    if (docTime === 0 && d.uploadDate) {
      docTime = parseDate(d.uploadDate).getTime();
    }
    if (startDateFilter) {
      const startTime = new Date(startDateFilter).getTime();
      if (docTime < startTime) return false;
    }
    if (endDateFilter) {
      const endDay = new Date(endDateFilter);
      endDay.setHours(23, 59, 59, 999);
      const endTime = endDay.getTime();
      if (docTime > endTime) return false;
    }

    // Search query matching
    if (search.trim()) {
      const q = search.toLowerCase();
      return d.supplier.toLowerCase().includes(q) || d.docNum.toLowerCase().includes(q);
    }

    return true;
  });

  // Sort logic applied
  const sortedDocs = [...filtered].sort((a, b) => {
    let result = 0;
    if (sortBy === 'Upload date') {
      result = parseDate(b.uploadDate).getTime() - parseDate(a.uploadDate).getTime();
    } else if (sortBy === 'Document date') {
      result = parseDate(b.date).getTime() - parseDate(a.date).getTime();
    } else if (sortBy === 'Amount') {
      const amtA = a.amount ?? 0;
      const amtB = b.amount ?? 0;
      result = amtB - amtA;
    }
    return sortOrder === 'desc' ? result : -result;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedDocs.length / itemsPerPage);
  const paginatedDocs = sortedDocs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, supplierFilter, startDateFilter, endDateFilter, sortBy, sortOrder]);

  // Sync filter temp values when modal opens
  useEffect(() => {
    if (filterModalOpen) {
      setTempStatusFilter(statusFilter);
      setTempSupplierFilter(supplierFilter);
      setTempStartDateFilter(startDateFilter);
      setTempEndDateFilter(endDateFilter);
    }
  }, [filterModalOpen, statusFilter, supplierFilter, startDateFilter, endDateFilter]);

  const isFiltersActive =
    statusFilter !== 'All' ||
    supplierFilter !== 'All' ||
    startDateFilter !== '' ||
    endDateFilter !== '';
  const visibleColumnsCount = 2 + Object.values(visibleColumns).filter(Boolean).length;

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedDocs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedDocs.map((d) => d.id));
    }
  };

  const toggleSelectId = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleApplyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setSupplierFilter(tempSupplierFilter);
    setStartDateFilter(tempStartDateFilter);
    setEndDateFilter(tempEndDateFilter);
    setFilterModalOpen(false);
  };

  const handleResetFilters = () => {
    setTempStatusFilter('All');
    setTempSupplierFilter('All');
    setTempStartDateFilter('');
    setTempEndDateFilter('');
    setStatusFilter('All');
    setSupplierFilter('All');
    setStartDateFilter('');
    setEndDateFilter('');
    setFilterModalOpen(false);
  };

  const getStatusBadge = (doc: any) => {
    switch (doc.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-[#e6f4ec] text-[#1f8f5c]">
            Digitized
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-[#e6eef8] text-[#2f6bb0]">
            <RefreshCw size={11} className="animate-spin" />
            AI extracting…
          </span>
        );
      case 'flagged':
        if (doc.isDuplicate) {
          return (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-[#fbf1dd] text-[#b07a1a]">
              Duplicate
            </span>
          );
        }
        return (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-[#fbf1dd] text-[#b07a1a]">
              Review required
            </span>
        );
      case 'rejected': {
        let reasonStr = '';
        if (doc.reviewReasons) {
          try {
            const parsed = JSON.parse(doc.reviewReasons);
            reasonStr = Array.isArray(parsed) ? parsed.join(', ') : parsed;
          } catch (e) {
            reasonStr = doc.reviewReasons;
          }
        }
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-[#fceaea] text-[#b23a3a]">
              Rejected
            </span>
            {reasonStr && (
              <span className="text-[10px] text-red-500 max-w-[150px] truncate" title={reasonStr}>
                {reasonStr}
              </span>
            )}
          </div>
        );
      }
      default:
        return (
          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {doc.status}
          </span>
        );
    }
  };

  const getPaymentBadge = (payStatus: string | null) => {
    if (!payStatus) return null;
    switch (payStatus) {
      case 'Paid':
        return (
          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-[#e6f4ec] text-[#1f8f5c]">
            {payStatus}
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-[#fbf1dd] text-[#b07a1a]">
            {payStatus}
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-[#f1f0ec] text-[#8c8c89]">
            {payStatus}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {payStatus}
          </span>
        );
    }
  };

  const getDocIcon = (icon: string) => {
    switch (icon) {
      case 'invoice':
        return (
          <div className="w-8 h-8 rounded-lg bg-[#e6f4ec] flex items-center justify-center">
            <Receipt size={14} className="text-[#1f8f5c]" />
          </div>
        );
      case 'delivery':
        return (
          <div className="w-8 h-8 rounded-lg bg-[#f5f4f1] flex items-center justify-center">
            <Truck size={14} className="text-[#151515]" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-[#f1f0ec] flex items-center justify-center animate-pulse">
            <RefreshCw size={14} className="text-[#8c8c89] animate-spin" />
          </div>
        );
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto font-sans flex flex-col gap-6 relative min-h-[calc(100vh-80px)]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight">Documents</h1>
        <a
          href="#"
          className="flex items-center gap-1 text-sm font-medium text-[#2f6bb0] hover:underline"
        >
          Learn more <ExternalLink size={13} />
        </a>
      </div>

      {/* WhatsApp Digitization Banner */}
      {showBanner && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-start justify-between shadow-sm relative pr-10 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[#e6f4ec] flex items-center justify-center shrink-0">
              <MessageSquare size={20} className="text-[#1f8f5c]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm">
                Digitalize expenses via WhatsApp
              </h3>
              <p className="text-xs text-muted-foreground">
                Send your invoices and receipts through WhatsApp to digitize them automatically
              </p>
              <button className="mt-2 text-xs font-semibold bg-white text-[#151515] border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
                Add phone numbers
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Summary Metrics Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Digitizing Card */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'processing' ? 'All' : 'processing')}
          className={`bg-card border border-border rounded-xl p-4 space-y-2 shadow-sm cursor-pointer hover:border-border-hover transition-colors ${statusFilter === 'processing' ? 'ring-2 ring-primary/20' : ''}`}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <div className="w-5 h-5 rounded-full bg-[#e6eef8] flex items-center justify-center">
              <RefreshCw size={11} className="text-[#2f6bb0] animate-spin" />
            </div>
            <span>Digitizing</span>
          </div>
          <p className="text-3xl font-mono font-semibold text-foreground">{countDigitizing}</p>
        </div>

        {/* Review Required Card */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'flagged' ? 'All' : 'flagged')}
          className={`bg-card border border-border rounded-xl p-4 space-y-2 shadow-sm cursor-pointer hover:border-border-hover transition-colors ${statusFilter === 'flagged' ? 'ring-2 ring-primary/20' : ''}`}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <div className="w-5 h-5 rounded-full bg-[#fbf1dd] flex items-center justify-center">
              <AlertTriangle size={11} className="text-[#b07a1a]" />
            </div>
            <span>Review required</span>
          </div>
          <p className="text-3xl font-mono font-semibold text-foreground">{countReview}</p>
        </div>

        {/* Rejected Card */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'All' : 'rejected')}
          className={`bg-card border border-border rounded-xl p-4 space-y-2 shadow-sm cursor-pointer hover:border-border-hover transition-colors ${statusFilter === 'rejected' ? 'ring-2 ring-primary/20' : ''}`}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <div className="w-5 h-5 rounded-full bg-[#fceaea] flex items-center justify-center">
              <AlertCircle size={11} className="text-[#b23a3a]" />
            </div>
            <span>Rejected</span>
          </div>
          <p className="text-3xl font-mono font-semibold text-foreground">{countRejected}</p>
        </div>
      </div>

      {/* Advanced Action & Filtering Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Left Side: Search (Choice chips removed) */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search bar */}
            <div className="relative w-full sm:w-80">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents, suppliers..."
                className="w-full bg-card border border-border rounded-full pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Right Side: Tools & Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {/* Order by Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted text-foreground"
              >
                <span>Order by:</span>
                <span className="text-[#353bf4] dark:text-[#a0a5ff] flex items-center gap-1">
                  {sortBy}
                  {sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                </span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>

              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-card border border-border rounded-lg shadow-lg py-1 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                    {[
                      {
                        key: 'Upload date-desc',
                        label: 'Upload date',
                        order: 'desc',
                        text: 'Upload date (Newest first)'
                      },
                      {
                        key: 'Upload date-asc',
                        label: 'Upload date',
                        order: 'asc',
                        text: 'Upload date (Oldest first)'
                      },
                      {
                        key: 'Document date-desc',
                        label: 'Document date',
                        order: 'desc',
                        text: 'Document date (Newest first)'
                      },
                      {
                        key: 'Document date-asc',
                        label: 'Document date',
                        order: 'asc',
                        text: 'Document date (Oldest first)'
                      },
                      {
                        key: 'Amount-desc',
                        label: 'Amount',
                        order: 'desc',
                        text: 'Amount (Highest first)'
                      },
                      {
                        key: 'Amount-asc',
                        label: 'Amount',
                        order: 'asc',
                        text: 'Amount (Lowest first)'
                      }
                    ].map((opt) => {
                      const isSelected = sortBy === opt.label && sortOrder === opt.order;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setSortBy(opt.label as any);
                            setSortOrder(opt.order as any);
                            setSortOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between ${isSelected ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
                        >
                          <span className="flex items-center gap-1.5">
                            {opt.order === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {opt.text}
                          </span>
                          {isSelected && <Check size={12} className="text-[#1f8f5c]" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Filter Dialog button */}
            <button
              onClick={() => setFilterModalOpen(true)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card border rounded-lg hover:bg-muted text-foreground relative ${isFiltersActive ? 'border-primary' : 'border-border'}`}
            >
              <SlidersHorizontal size={13} />
              <span>Filter</span>
              {isFiltersActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2f6bb0] absolute -top-0.5 -right-0.5 border border-white" />
              )}
            </button>

            {/* Export dropdown */}
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted text-foreground">
              <Download size={13} />
              <span>Export</span>
              <ChevronDown size={12} />
            </button>

            {/* Columns dropdown (Fully Functional) */}
            <div className="relative">
              <button
                onClick={() => setColumnsOpen(!columnsOpen)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted text-foreground"
              >
                <Columns size={13} />
                <span>Columns</span>
                <ChevronDown size={12} />
              </button>

              {columnsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setColumnsOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg py-2 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                    <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Show Columns
                    </p>
                    <div className="h-px bg-border my-1" />
                    {[
                      { key: 'docNum', label: 'Document No.' },
                      { key: 'type', label: 'Type' },
                      { key: 'status', label: 'Status' },
                      { key: 'docDate', label: 'Document Date' },
                      { key: 'uploadDate', label: 'Upload Date' },
                      { key: 'amount', label: 'Amount' },
                      { key: 'paymentStatus', label: 'Payment Status' }
                    ].map((col) => {
                      const isVisible = visibleColumns[col.key as keyof typeof visibleColumns];
                      return (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors cursor-pointer text-foreground w-full"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => {
                              setVisibleColumns({
                                ...visibleColumns,
                                [col.key]: !isVisible
                              });
                            }}
                            className="w-3.5 h-3.5 rounded border-border text-[#151515] focus:ring-primary/20"
                          />
                          <span>{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[#fceaea] border border-[#ffb4ab] text-[#b23a3a] rounded-lg hover:bg-[#ffb4ab]/30 transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete selected ({selectedIds.length})</span>
              </button>
            )}

            {/* Upload Document button */}
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-[#353bf4] hover:bg-[#353bf4]/90 text-white rounded-lg transition-colors"
            >
              <Upload size={14} />
              <span>Upload document</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {isFiltersActive && (
          <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-200">
            <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
            {statusFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-card border border-border rounded-full text-foreground font-medium shadow-2xs">
                <span>
                  Status:{' '}
                  {statusFilter === 'processing'
                    ? 'Digitizing'
                    : statusFilter === 'completed'
                      ? 'Digitized'
                      : statusFilter === 'flagged'
                        ? 'Review required'
                        : 'Rejected'}
                </span>
                <button
                  onClick={() => {
                    setStatusFilter('All');
                    setTempStatusFilter('All');
                  }}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {supplierFilter !== 'All' && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-card border border-border rounded-full text-foreground font-medium shadow-2xs">
                <span>Supplier: {supplierFilter}</span>
                <button
                  onClick={() => {
                    setSupplierFilter('All');
                    setTempSupplierFilter('All');
                  }}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {(startDateFilter || endDateFilter) && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-card border border-border rounded-full text-foreground font-medium shadow-2xs">
                <span>
                  Date:{' '}
                  {startDateFilter
                    ? new Date(startDateFilter).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'Start'}{' '}
                  -{' '}
                  {endDateFilter
                    ? new Date(endDateFilter).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'End'}
                </span>
                <button
                  onClick={() => {
                    setStartDateFilter('');
                    setTempStartDateFilter('');
                    setEndDateFilter('');
                    setTempEndDateFilter('');
                  }}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-xs text-primary font-semibold hover:underline px-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Duplicate detection panel */}
      {(() => {
        const doc = allDocuments.find((d) => d.isDuplicate);
        if (doc) {
          return (
            <div key="duplicate-panel" className="bg-[#fceaea] border border-[#ffb4ab] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs mb-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={17} className="text-[#b23a3a] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-bold text-[#7a2828]">Duplicate detected on {doc.docNum}</span>
                  <p className="text-xs text-[#7a2828] opacity-90">This document matches an existing invoice from the same supplier.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                  className="flex items-center gap-1 text-xs font-bold text-white bg-[#b23a3a] px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <FileCheck size={13} /> Review Document →
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Documents Grid Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-visible">
        <div className="overflow-x-visible">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-[#fafaf8] dark:bg-[#1a1916]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === paginatedDocs.length && paginatedDocs.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border text-[#151515] focus:ring-primary/20"
                  />
                </th>
                {visibleColumns.docNum && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Document No.
                  </th>
                )}
                {visibleColumns.type && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                )}
                {visibleColumns.docDate && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Document Date
                  </th>
                )}
                {visibleColumns.uploadDate && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Upload Date
                  </th>
                )}
                {visibleColumns.amount && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                )}
                {visibleColumns.paymentStatus && (
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Payment Status
                  </th>
                )}
                <th className="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumnsCount} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={24} className="text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">
                        Loading invoices from database...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : sortedDocs.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnsCount} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={32} className="text-muted-foreground/60" />
                      <p className="font-semibold text-foreground">
                        No documents matches your filters
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Try clearing filters or running a new search query.
                      </p>
                      {isFiltersActive && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-1.5 text-xs font-semibold bg-[#151515] text-white px-3.5 py-1.5 rounded-lg hover:opacity-90"
                        >
                          Reset filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => {
                  const isChecked = selectedIds.includes(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer group ${isChecked ? 'bg-primary/5' : ''}`}
                      onClick={() =>
                        doc.status !== 'processing' &&
                        router.push(`/dashboard/documents/${doc.id}`)
                      }
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectId(doc.id)}
                          className="w-4 h-4 rounded border-border text-[#151515] focus:ring-primary/20"
                        />
                      </td>

                      {/* Document No / Supplier info */}
                      {visibleColumns.docNum && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {getDocIcon(doc.icon)}
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-sm">
                                {doc.supplier}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {doc.docNum}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Type */}
                      {visibleColumns.type && (
                        <td className="px-4 py-3">
                          <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {doc.type}
                          </span>
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <td className="px-4 py-3">{getStatusBadge(doc)}</td>
                      )}

                      {/* Document Date */}
                      {visibleColumns.docDate && (
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {doc.date}
                        </td>
                      )}

                      {/* Upload Date */}
                      {visibleColumns.uploadDate && (
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {doc.uploadDate}
                        </td>
                      )}

                      {/* Amount */}
                      {visibleColumns.amount && (
                        <td className="px-4 py-3 font-mono font-semibold text-foreground text-sm">
                          {doc.amount != null ? `€${doc.amount.toFixed(2)}` : '—'}
                        </td>
                      )}

                      {/* Payment Status */}
                      {visibleColumns.paymentStatus && (
                        <td className="px-4 py-3">{getPaymentBadge(doc.paymentStatus)}</td>
                      )}

                      {/* Avatar and Action menu */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2.5">
                          {doc.userInitials && (
                            <div
                              className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border text-[10px] font-bold ${
                                doc.userInitials === '@'
                                  ? 'bg-[#e6eef8] border-[#e2e1dd] text-[#2f6bb0]'
                                  : 'bg-muted border-border text-foreground'
                              }`}
                            >
                              {doc.userInitials}
                            </div>
                          )}

                          <div className="relative">
                            <button 
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRowMenu(activeRowMenu === doc.id ? null : doc.id);
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {activeRowMenu === doc.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-20" 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setActiveRowMenu(null); 
                                  }} 
                                />
                                <div className="absolute right-0 mt-1 w-36 bg-card border border-border rounded-lg shadow-lg py-1 z-30">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadInvoice(doc);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                  >
                                    <Download size={13} />
                                    <span>Download</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteInvoice(doc.id);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2 text-[#b23a3a]"
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="bg-[#fafaf8] dark:bg-[#1a1916] border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <span>
              Selected {selectedIds.length} of {paginatedDocs.length} items
            </span>
            <span className="text-border">|</span>
            <span>
              Showing {sortedDocs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, sortedDocs.length)} of {sortedDocs.length}{' '}
              entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-card border border-border rounded-md hover:bg-muted text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-1 text-foreground font-medium">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1 bg-card border border-border rounded-md hover:bg-muted text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Floating help button */}
      <button className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-[#151515] text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-40">
        <HelpCircle size={20} />
      </button>

      {/* Proper Web Filter Dialog Modal */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <div
            onClick={() => setFilterModalOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          {/* Modal box */}
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full relative z-10 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-md font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal size={15} />
                <span>Filter documents</span>
              </h2>
              <button
                onClick={() => setFilterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 1. Date Range Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>Document Date Range</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      From
                    </span>
                    <input
                      type="date"
                      value={tempStartDateFilter}
                      onChange={(e) => setTempStartDateFilter(e.target.value)}
                      className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      To
                    </span>
                    <input
                      type="date"
                      value={tempEndDateFilter}
                      onChange={(e) => setTempEndDateFilter(e.target.value)}
                      className="w-full p-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Supplier Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Truck size={12} />
                  <span>Supplier</span>
                </label>
                <select
                  value={tempSupplierFilter}
                  onChange={(e) => setTempSupplierFilter(e.target.value)}
                  className="w-full p-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                >
                  <option value="All">All Suppliers</option>
                  {Array.from(new Set(allDocuments.map(d => d.supplier)))
                    .filter(s => s && s !== '—' && s !== 'Unknown Supplier')
                    .sort()
                    .map(supplier => (
                    <option key={supplier} value={supplier}>{supplier}</option>
                  ))}
                </select>
              </div>

              {/* 3. Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <CheckSquare size={12} />
                  <span>Status</span>
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(['All', 'processing', 'completed', 'flagged', 'rejected'] as const).map(
                    (opt) => {
                      const isSel = tempStatusFilter === opt;
                      const labelMap = {
                        All: 'All',
                        processing: 'Digitizing',
                        completed: 'Digitized',
                        flagged: 'Review required',
                        rejected: 'Rejected'
                      };
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setTempStatusFilter(opt)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            isSel
                              ? 'bg-[#151515] border-[#151515] text-white dark:bg-[#efede7] dark:text-[#14130f]'
                              : 'bg-card border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          {labelMap[opt]}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Other mock fields for appearance */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Categories
                  </label>
                  <div className="p-2 border border-border rounded-lg text-xs text-muted-foreground bg-muted/20 flex justify-between items-center cursor-not-allowed">
                    <span>All categories</span>
                    <ChevronDown size={11} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Due date
                  </label>
                  <div className="p-2 border border-border rounded-lg text-xs text-muted-foreground bg-muted/20 flex justify-between items-center cursor-not-allowed">
                    <span>Any due date</span>
                    <ChevronDown size={11} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 p-4 border-t border-border bg-[#fafaf8] dark:bg-[#1a1916]">
              <button
                onClick={handleResetFilters}
                className="flex-1 py-2 text-xs font-semibold text-[#151515] bg-white border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Delete filters
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex-1 py-2 text-xs font-semibold text-white bg-[#151515] hover:opacity-90 rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <div
            onClick={() => setUploadModalOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          {/* Modal box */}
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-xl w-full relative z-10 overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Upload your documents</h2>
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  className="flex items-center gap-1 text-xs font-semibold text-[#353bf4] dark:text-[#a0a5ff] hover:underline"
                >
                  How to upload documents <ExternalLink size={12} />
                </a>
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Mass upload info alert */}
            <div className="bg-[#fafaf8] dark:bg-[#1a1916] border border-border rounded-xl p-3.5 text-center mb-4">
              <p className="text-xs text-muted-foreground font-medium">
                <span className="font-bold text-foreground">Mass upload</span> available for PDFs
                and images
              </p>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
                dragActive
                  ? 'border-[#353bf4] bg-[#353bf4]/5'
                  : 'border-border bg-[#fafaf8]/50 dark:bg-[#151515]/30 hover:bg-[#fafaf8] dark:hover:bg-[#151515]/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleUploadFiles(e.target.files)}
                className="hidden"
              />

              {/* Custom Double Page Icon */}
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-muted-foreground/30"
              >
                {/* Back Angled Page */}
                <g transform="translate(10, 5) rotate(-8 45 60)">
                  <rect
                    x="25"
                    y="20"
                    width="50"
                    height="70"
                    rx="6"
                    fill="white"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  {/* Small checkboxes on the left */}
                  <rect
                    x="31"
                    y="28"
                    width="6"
                    height="6"
                    rx="1"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  <rect
                    x="31"
                    y="38"
                    width="6"
                    height="6"
                    rx="1"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  <rect
                    x="31"
                    y="48"
                    width="6"
                    height="6"
                    rx="1"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  {/* Lines on the right */}
                  <rect
                    x="42"
                    y="30"
                    width="26"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <rect
                    x="42"
                    y="40"
                    width="20"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <rect
                    x="42"
                    y="50"
                    width="24"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  {/* Long lines below */}
                  <rect
                    x="31"
                    y="62"
                    width="38"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <rect
                    x="31"
                    y="70"
                    width="34"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <rect
                    x="31"
                    y="78"
                    width="28"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.2"
                  />
                </g>

                {/* Front Page (straight) */}
                <g transform="translate(15, 5)">
                  <rect
                    x="35"
                    y="25"
                    width="50"
                    height="70"
                    rx="6"
                    fill="white"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="shadow-sm"
                  />
                  {/* Top-left header box */}
                  <rect x="42" y="33" width="14" height="12" rx="2" fill="#8c8c89" opacity="0.7" />
                  {/* Lines next to header box */}
                  <rect
                    x="62"
                    y="35"
                    width="16"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  <rect
                    x="62"
                    y="42"
                    width="10"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  {/* Lines below */}
                  <rect
                    x="42"
                    y="55"
                    width="36"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  <rect
                    x="42"
                    y="63"
                    width="36"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.3"
                  />
                  <rect
                    x="42"
                    y="71"
                    width="20"
                    height="3"
                    rx="1.5"
                    fill="currentColor"
                    opacity="0.3"
                  />
                </g>
              </svg>

              <p className="text-xs text-muted-foreground font-semibold text-center max-w-[240px]">
                Drag and drop your invoices in PDF or image format
              </p>

              <button
                type="button"
                className="bg-[#353bf4] text-white hover:bg-[#353bf4]/90 text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={14} />
                <span>Upload documents</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
