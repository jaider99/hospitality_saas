'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Pencil,
  Star,
  Package,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Plus,
  X,
  Filter,
  Sparkles,
  HelpCircle,
  Loader2,
  Info,
  MoreVertical,
  Merge,
  EyeOff,
  Calendar as CalendarIcon,
  Activity,
  DollarSign,
  Search,
  Trash2,
  GitMerge,
  Eye
} from 'lucide-react';
import { getApiClient } from '../../../store/auth';
import { Badge, Btn } from '../_components/ui';
import ConfirmModal from '../suppliers/_components/ConfirmModal';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/components/ui/utils';

interface Category {
  id: number;
  category_id: string;  // e.g. "CAT-XXXXXXXX" — used as FK value
  name: string;
  color?: string | null;
  parent_category_id?: string | null;
}


interface SupplierOption {
  id: number;
  name: string;
  category_id?: string | null;  // FK to categories.category_id
}


export default function ProductsPage() {
  const apiClient = getApiClient();

  // Navigation View States: 'list' | 'review' | 'detail' | 'config'
  const [view, setView] = useState<'list' | 'review' | 'detail' | 'config'>('list');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Sidebar config active tab: 'general' | 'prices' | 'formats' | 'consumption'
  const [configTab, setConfigTab] = useState<'general' | 'prices' | 'formats' | 'consumption'>(
    'prices'
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Data lists
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [recipeProductIds, setRecipeProductIds] = useState<Set<string>>(new Set());

  // Detail page states
  const [productDetail, setProductDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'purchases' | 'recipes'>('purchases');
  const [docFilter, setDocFilter] = useState<'all' | 'invoices' | 'delivery_notes'>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  
  // Global merge state (from main list)
  const [isGlobalMergeModalOpen, setIsGlobalMergeModalOpen] = useState(false);
  const [globalMergeSourceId, setGlobalMergeSourceId] = useState<string>('');
  const [globalMergeTargetId, setGlobalMergeTargetId] = useState<string>('');
  
  const [mergeSearch, setMergeSearch] = useState('');
  const [globalMergeSourceSearch, setGlobalMergeSourceSearch] = useState('');
  const [globalMergeTargetSearch, setGlobalMergeTargetSearch] = useState('');

  // Totals & Counts
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Search, Sort & Pagination
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Filter Drawer Accordion Expansion States
  const [accordionOpen, setAccordionOpen] = useState({
    date: true,
    supplier: true,
    category: true,
    more: true
  });

  // Filter Drawer Selection States
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Supplier search & selections
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(['all']);

  // Category search & selections
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(['all']);

  // Date range
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // More filters
  const [filterRecipeMode, setFilterRecipeMode] = useState<'all' | 'with' | 'without'>('all');
  const [filterViewBookmarks, setFilterViewBookmarks] = useState(false);
  const [filterWithPriceIncrease, setFilterWithPriceIncrease] = useState(false);
  const [filterViewHidden, setFilterViewHidden] = useState(false);
  const [filterNegativePrices, setFilterNegativePrices] = useState(false);

  // Active filters applied to the view
  const [appliedFilters, setAppliedFilters] = useState<any>({
    suppliers: ['all'],
    categories: ['all'],
    dateRange: undefined,
    recipeMode: 'all',
    viewBookmarks: false,
    withPriceIncrease: false,
    viewHidden: false,
    negativePrices: false
  });

  // Loading & Saving States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createForm, setCreateForm] = useState({
    name: '',
    product_code: '',
    supplier_id: '',
    category_id: '',
    price: '',
    unit_of_measure: 'ud',
    shrinkage_pct: '0',
    tax_rate: '0.1'
  });

  // Config price options
  const [configPriceOption, setConfigPriceOption] = useState<'custom' | 'last' | 'average'>(
    'average'
  );
  const [configCustomPrice, setConfigCustomPrice] = useState<string>('');
  const [configFixedPrice, setConfigFixedPrice] = useState<string>('');
  const [configTaxRate, setConfigTaxRate] = useState<string>('0.1');

  // Load initial products, categories, suppliers
  useEffect(() => {
    loadData();
  }, [search, sortBy, order, page, view, appliedFilters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const client = getApiClient();

      // Load categories, suppliers, and recipes once
      if (categories.length === 0) {
        const catRes = await client.getCategories();
        setCategories(catRes);
      }
      if (suppliers.length === 0) {
        const suppRes = await client.get('/suppliers');
        setSuppliers(suppRes.data || []);
      }
      if (recipeProductIds.size === 0) {
        try {
          const recRes = await client.getRecipes();
          const ids = new Set<string>();
          recRes.forEach((r: any) => {
            if (r.ingredients) {
              r.ingredients.forEach((i: any) => {
                if (i.product_id) ids.add(String(i.product_id));
              });
            }
          });
          setRecipeProductIds(ids);
        } catch (e) {
          console.warn('Failed to load recipes costing data:', e);
        }
      }

      if (view === 'list') {
        // Query backend for products (including archived true/false based on filter)
        const prodRes = await client.getProducts({
          name: search || undefined,
          sort_by: sortBy,
          order: order,
          archived: appliedFilters.viewHidden ? true : false,
          bookmarked: appliedFilters.viewBookmarks ? true : undefined,
          category_id:
            appliedFilters.categories.length === 1 && appliedFilters.categories[0] !== 'all'
              ? appliedFilters.categories[0]
              : undefined,
          supplier_id:
            appliedFilters.suppliers.length === 1 && appliedFilters.suppliers[0] !== 'all'
              ? parseInt(appliedFilters.suppliers[0])
              : undefined,
          start_date: appliedFilters.dateRange?.from
            ? format(appliedFilters.dateRange.from, 'yyyy-MM-dd')
            : undefined,
          end_date: appliedFilters.dateRange?.to
            ? format(appliedFilters.dateRange.to, 'yyyy-MM-dd')
            : undefined,
          skip: 0, // Fetch all matched to allow multi-select and complex toggle filtering locally
          limit: 500
        });

        let filteredItems = prodRes.items || [];

        // 1. Multi-supplier local filter
        if (
          appliedFilters.suppliers &&
          !appliedFilters.suppliers.includes('all') &&
          appliedFilters.suppliers.length > 0
        ) {
          filteredItems = filteredItems.filter((p: any) => {
            if (!p.suppliers) return false;
            return p.suppliers.some((s: any) => appliedFilters.suppliers.includes(String(s.id)));
          });
        }

        // 2. Multi-category local filter
        if (
          appliedFilters.categories &&
          !appliedFilters.categories.includes('all') &&
          appliedFilters.categories.length > 0
        ) {
          filteredItems = filteredItems.filter((p: any) => {
            return appliedFilters.categories.includes(String(p.category_id));
          });
        }

        // 3. Price increase filter
        if (appliedFilters.withPriceIncrease) {
          filteredItems = filteredItems.filter((p: any) => p.price_difference_percentage > 0);
        }

        // 4. Recipes filter
        if (appliedFilters.recipeMode === 'with') {
          filteredItems = filteredItems.filter((p: any) => recipeProductIds.has(String(p.id)));
        } else if (appliedFilters.recipeMode === 'without') {
          filteredItems = filteredItems.filter((p: any) => !recipeProductIds.has(String(p.id)));
        }

        // 5. Negative prices filter
        if (appliedFilters.negativePrices) {
          filteredItems = filteredItems.filter(
            (p: any) => (p.last_price || 0) < 0 || (p.reference_price || 0) < 0
          );
        }

        // Apply local pagination
        const total = filteredItems.length;
        const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

        setProducts(paginatedItems);
        setTotalCount(total);
        setPendingCount(prodRes.pending_review_count || 0);
      } else if (view === 'review') {
        const revRes = await client.getReviewQueue({
          name: search || undefined,
          limit: 100
        });
        setReviewItems(revRes.items);
        setPendingCount(revRes.total);
      }
    } catch (err) {
      console.error('Failed to load products list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load product details
  const handleProductClick = async (productId: string) => {
    try {
      setSelectedProductId(productId);
      setView('detail');
      setLoading(true);
      const client = getApiClient();
      const detail = await client.getProductDetail(productId);
      setProductDetail(detail);

      // Seed configuration state
      setConfigTaxRate(String(detail.tax_rate ?? '0.1'));
      setConfigFixedPrice(String(detail.config?.fixed_price ?? ''));
      setConfigPriceOption(detail.config?.reference_price_mode || 'average');
      setConfigCustomPrice(String(detail.config?.custom_reference_price ?? ''));
    } catch (err) {
      console.error('Failed to load product detail:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual Creation Save
  const handleCreateSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const client = getApiClient();
      await client.createProduct({
        name: createForm.name,
        product_code: createForm.product_code || undefined,
        supplier_ids: createForm.supplier_id ? [parseInt(createForm.supplier_id)] : [],
        app_category_id: createForm.category_id || undefined,
        price: createForm.price ? parseFloat(createForm.price) : undefined,
        unit_of_measure: createForm.unit_of_measure,
        shrinkage_pct: parseFloat(createForm.shrinkage_pct || '0'),
        tax_rate: parseFloat(createForm.tax_rate)
      });
      setCreateModalOpen(false);
      setCreateForm({
        name: '',
        product_code: '',
        supplier_id: '',
        category_id: '',
        price: '',
        unit_of_measure: 'ud',
        shrinkage_pct: '0',
        tax_rate: '0.1'
      });
      setCreateStep(1);
      loadData();
    } catch (err) {
      console.error('Failed to manually create product:', err);
    } finally {
      setSaving(false);
    }
  };

  // Save product prices/tax configuration
  const handleSavePriceConfig = async () => {
    if (!selectedProductId) return;
    try {
      setSaving(true);
      const client = getApiClient();
      await client.updateProduct(selectedProductId, {
        tax_rate: parseFloat(configTaxRate),
        config: {
          ...productDetail?.config,
          reference_price_mode: configPriceOption,
          custom_reference_price: configCustomPrice ? parseFloat(configCustomPrice) : null,
          fixed_price: configFixedPrice ? parseFloat(configFixedPrice) : null
        }
      });

      // Reload detail
      const detail = await client.getProductDetail(selectedProductId);
      setProductDetail(detail);
      setAlertConfig({ title: 'Success', message: 'Price configuration saved successfully!' });
    } catch (err) {
      console.error('Failed to save price configuration:', err);
    } finally {
      setSaving(false);
    }
  };

  // Star/Bookmark Toggle
  const handleToggleBookmark = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const client = getApiClient();
      const res = await client.toggleProductBookmark(productId);
      setProducts((p) =>
        p.map((prod) => (prod.id === productId ? { ...prod, bookmarked: res.bookmarked } : prod))
      );
      if (productDetail && productDetail.id === productId) {
        setProductDetail((prev: any) => (prev ? { ...prev, bookmarked: res.bookmarked } : null));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  // Archive Toggle
  const handleArchive = async (productId: string, currentArchived: boolean) => {
    try {
      const client = getApiClient();
      await client.archiveProduct(productId, !currentArchived);
      setView('list');
      setSelectedProductId(null);
      setProductDetail(null);
      loadData();
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string) => {
    try {
      const client = getApiClient();
      await client.deleteProduct(productId);
      setIsDeleteModalOpen(false);
      setView('list');
      setSelectedProductId(null);
      setProductDetail(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to delete product:', err);
    }
  };

  const handleMergeProduct = async () => {
    if (!productDetail || !mergeTargetId) return;
    try {
      setLoading(true);
      const client = getApiClient();
      await client.mergeProduct(mergeTargetId, productDetail.id);
      setIsMergeModalOpen(false);
      setMergeTargetId('');
      // Reload the master product (mergeTargetId) to show the new stats
      handleProductClick(mergeTargetId);
      loadData();
    } catch (err: any) {
      console.error('Failed to merge product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalMergeProduct = async () => {
    if (!globalMergeSourceId || !globalMergeTargetId) return;
    try {
      setLoading(true);
      const client = getApiClient();
      await client.mergeProduct(globalMergeTargetId, globalMergeSourceId);
      setIsGlobalMergeModalOpen(false);
      setGlobalMergeSourceId('');
      setGlobalMergeTargetId('');
      loadData();
    } catch (err: any) {
      console.error('Failed to merge product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      const client = getApiClient();
      await client.bulkDeleteProducts(selectedIds);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to bulk delete products:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length && products.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const toggleSelectId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Review Queue: Unify
  const handleUnify = async (lineId: number, productId: string) => {
    try {
      const client = getApiClient();
      await client.unifyLineWithProduct(lineId, productId);
      loadData();
    } catch (err) {
      console.error('Failed to unify line:', err);
    }
  };

  // Review Queue: Standalone Create (No Match)
  const handleNoMatch = async (lineId: number) => {
    try {
      const client = getApiClient();
      await client.markLineNoMatch(lineId);
      loadData();
    } catch (err) {
      console.error('Failed to mark no match:', err);
    }
  };

  // Supplier selections logic
  const toggleSupplierSelection = (id: string) => {
    if (id === 'all') {
      setSelectedSupplierIds(['all']);
    } else {
      let next = selectedSupplierIds.filter((x) => x !== 'all');
      if (next.includes(id)) {
        next = next.filter((x) => x !== id);
      } else {
        next.push(id);
      }
      if (next.length === 0) next = ['all'];
      setSelectedSupplierIds(next);
    }
  };

  // Category selections logic
  const toggleCategorySelection = (id: string) => {
    if (id === 'all') {
      setSelectedCategoryIds(['all']);
    } else {
      let next = selectedCategoryIds.filter((x) => x !== 'all');
      if (next.includes(id)) {
        next = next.filter((x) => x !== id);
      } else {
        next.push(id);
      }
      if (next.length === 0) next = ['all'];
      setSelectedCategoryIds(next);
    }
  };

  // Filter Drawer Actions
  const handleApplyFilters = () => {
    setAppliedFilters({
      suppliers: selectedSupplierIds,
      categories: selectedCategoryIds,
      dateRange: dateRange,
      recipeMode: filterRecipeMode,
      viewBookmarks: filterViewBookmarks,
      withPriceIncrease: filterWithPriceIncrease,
      viewHidden: filterViewHidden,
      negativePrices: filterNegativePrices
    });
    setPage(1);
    setFilterDrawerOpen(false);
  };

  const handleClearFilters = () => {
    setSelectedSupplierIds(['all']);
    setSelectedCategoryIds(['all']);
    setDateRange(undefined);
    setFilterRecipeMode('all');
    setFilterViewBookmarks(false);
    setFilterWithPriceIncrease(false);
    setFilterViewHidden(false);
    setFilterNegativePrices(false);

    setAppliedFilters({
      suppliers: ['all'],
      categories: ['all'],
      dateRange: undefined,
      recipeMode: 'all',
      viewBookmarks: false,
      withPriceIncrease: false,
      viewHidden: false,
      negativePrices: false
    });
    setPage(1);
    setFilterDrawerOpen(false);
  };

  // Helper to filter purchase history by doc type
  const getFilteredPurchases = () => {
    if (!productDetail || !productDetail.purchase_history) return [];
    return productDetail.purchase_history.filter((h: any) => {
      const isInvoice = (h.document_type || 'Invoice').toLowerCase().includes('invoice');
      if (docFilter === 'invoices') return isInvoice;
      if (docFilter === 'delivery_notes') return !isInvoice;
      return true;
    });
  };

  // Search filtered suppliers & categories for checkboxes
  const getFilteredSuppliersList = () => {
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())
    );
  };

  const getFilteredCategoriesList = () => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background font-sans relative">
      {/* 1. MAIN CATALOG PRODUCT LIST VIEW */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">
          {/* VIEW HEADER */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
                  Products
                </h1>
                {!loading && (
                  <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-md text-xs font-semibold mt-1">
                    {totalCount} total
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your normalized items database synced from invoice line items.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsGlobalMergeModalOpen(true)}
                className="flex items-center justify-center gap-1.5 shadow-sm bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-500 dark:border-amber-900/50 dark:hover:bg-amber-900/50 font-semibold px-4 py-2.5 rounded-xl text-sm border border-amber-200 transition-colors"
              >
                <Merge size={16} /> Merge Products
              </button>
              <Btn
                onClick={() => setCreateModalOpen(true)}
                className="gap-1.5 shadow-sm bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm"
              >
                <Plus size={16} /> Add product
              </Btn>
            </div>
          </div>

          {/* PENDING REVIEW BANNER */}
          {pendingCount > 0 && (
            <div
              onClick={() => {
                setView('review');
                setSearch('');
              }}
              className="bg-[#fcf8e3] hover:bg-[#faebcc] border border-[#fbeed5] text-[#c09853] rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/70 rounded-xl flex items-center justify-center text-[#c09853] shadow-sm">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <span className="text-sm font-bold text-[#8a6d3b]">
                    New articles pending review
                  </span>
                  <p className="text-xs text-[#8a6d3b]/80 mt-0.5">
                    You have{' '}
                    <strong className="font-bold text-[#8a6d3b]">{pendingCount} articles</strong>{' '}
                    from digitized invoices that require mapping to catalog items.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#8a6d3b] uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                Review Now <ChevronRight size={14} />
              </div>
            </div>
          )}

          {/* SEARCH AND FILTERS */}
          <div className="flex items-center gap-3 mb-6 flex-wrap md:flex-nowrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <input
                type="text"
                placeholder="Search by product name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setFilterDrawerOpen(true)}
                className={`flex items-center gap-1.5 bg-card border rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  (appliedFilters.suppliers.length > 0 &&
                    !appliedFilters.suppliers.includes('all')) ||
                  (appliedFilters.categories.length > 0 &&
                    !appliedFilters.categories.includes('all')) ||
                  appliedFilters.dateRange?.from ||
                  appliedFilters.recipeMode !== 'all' ||
                  appliedFilters.viewBookmarks ||
                  appliedFilters.withPriceIncrease ||
                  appliedFilters.viewHidden ||
                  appliedFilters.negativePrices
                    ? 'border-primary text-primary bg-primary/5 font-bold'
                    : 'border-border text-foreground hover:bg-muted font-semibold'
                }`}
              >
                <Filter size={14} />
                <span>Filters</span>
                {((appliedFilters.suppliers.length > 0 &&
                  !appliedFilters.suppliers.includes('all')) ||
                  (appliedFilters.categories.length > 0 &&
                    !appliedFilters.categories.includes('all')) ||
                  appliedFilters.dateRange?.from ||
                  appliedFilters.recipeMode !== 'all' ||
                  appliedFilters.viewBookmarks ||
                  appliedFilters.withPriceIncrease ||
                  appliedFilters.viewHidden ||
                  appliedFilters.negativePrices) && (
                  <span className="bg-primary text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] ml-1 font-bold">
                    !
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-sm text-muted-foreground">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-medium text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="name">Name</option>
                  <option value="total">Total spend</option>
                  <option value="last_price">Latest price</option>
                  <option value="quantity">Quantity</option>
                </select>
              </div>

              <button
                onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                className="bg-card border border-border rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                {order === 'asc' ? '↑' : '↓'}
              </button>

              {selectedIds.length > 0 && (
                <button
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[#fceaea] border border-[#ffb4ab] text-[#b23a3a] rounded-xl hover:bg-[#ffb4ab]/30 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Delete selected ({selectedIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* CATALOG TABLE */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-2xl shadow-sm">
              <Loader2 className="animate-spin text-muted-foreground mb-3" size={24} />
              <p className="text-sm text-muted-foreground">
                Loading products and catalog mapping...
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col justify-between">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="w-12 py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === products.length && products.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-border text-[#151515] focus:ring-primary/20 cursor-pointer"
                        />
                      </th>
                      <th className="w-12 py-3 px-4 text-center"></th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Supplier
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Categories
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Quantity
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Ref. price
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Latest price
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.map((p) => {
                      const hasSpike =
                        p.last_price &&
                        p.reference_price &&
                        p.last_price > p.reference_price * 1.05;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleProductClick(p.id)}
                          className="hover:bg-muted/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={(e: any) => toggleSelectId(p.id, e)}
                              className="w-4 h-4 rounded border-border text-[#151515] focus:ring-primary/20 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={(e) => handleToggleBookmark(p.id, e)}
                              className={`transition-colors ${
                                p.bookmarked
                                  ? 'text-amber-500'
                                  : 'text-muted-foreground/30 hover:text-muted-foreground'
                              }`}
                            >
                              <Star size={16} fill={p.bookmarked ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td className="py-4 px-4 font-semibold text-foreground">{p.name}</td>
                          <td className="py-4 px-4 text-sm text-muted-foreground">
                            {p.suppliers && p.suppliers.length > 0
                              ? p.suppliers[0].name
                              : 'No supplier'}
                            {p.suppliers && p.suppliers.length > 1 && (
                              <span className="ml-1 text-[11px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                +{p.suppliers.length - 1} more
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {(p.app_category_name || p.category_name) ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                                style={p.app_category_color ? { backgroundColor: p.app_category_color, color: 'white', borderColor: 'transparent' } : undefined}
                              >
                                {p.app_category_name || p.category_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right text-sm font-mono text-muted-foreground">
                            {p.quantity !== null && p.quantity !== undefined
                              ? `${p.quantity.toFixed(2)} ${p.unit_of_measure || 'ud'}`
                              : 'No data'}
                          </td>
                          <td className="py-4 px-4 text-right text-sm font-mono text-muted-foreground">
                            {p.reference_price !== null && p.reference_price !== undefined
                              ? `€${p.reference_price.toFixed(2)}`
                              : 'No data'}
                          </td>
                          <td className="py-4 px-4 text-right text-sm font-mono">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-medium text-foreground">
                                {p.last_price !== null && p.last_price !== undefined
                                  ? `€${p.last_price.toFixed(2)}`
                                  : '—'}
                              </span>
                              {hasSpike && (
                                <span className="bg-red-50 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  ▲ {Math.round((p.price_difference_percentage || 0) * 100)}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right text-sm font-semibold text-foreground font-mono">
                            €{p.total ? p.total.toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      );
                    })}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                          No products matched your active filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION FOOTER */}
              <div className="border-t border-border px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} of{' '}
                  {totalCount} entries
                </span>
                <div className="flex items-center gap-2">
                  <Btn
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Btn>
                  <span className="text-sm font-semibold text-foreground px-2">{page}</span>
                  <Btn
                    variant="secondary"
                    size="sm"
                    disabled={page * limit >= totalCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PRODUCT REVIEW QUEUE VIEW */}
      {view === 'review' && (
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setView('list');
                setSearch('');
              }}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors border border-border"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              New articles pending review
            </h1>
          </div>

          <div className="space-y-4">
            {reviewItems.map((item) => (
              <div
                key={item.line_id}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:border-border/80 transition-all"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap border-b border-border/55 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#fceaea] text-[#b23a3a] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        UNLINKED ARTICLE
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {item.document_date} · {item.document_type}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground font-mono leading-snug">
                      {item.description}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Supplier: <strong className="text-foreground">{item.supplier_name}</strong>
                    </p>
                  </div>

                  <div className="flex flex-col items-end text-right font-mono flex-shrink-0">
                    <span className="text-sm font-bold text-foreground">
                      €{item.total_price ? item.total_price.toFixed(2) : '0.00'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} @ €{item.unit_price?.toFixed(2)}/unit
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Suggested Catalog Matches
                  </p>

                  {item.similar_products &&
                    item.similar_products.map((sim: any) => {
                      const colors =
                        {
                          exact:
                            'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800/30 dark:text-green-400',
                          llm_suggested:
                            'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/20 dark:border-purple-800/30 dark:text-purple-400',
                          possibly_different:
                            'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-400',
                          looks_different: 'bg-muted border-border text-muted-foreground'
                        }[sim.confidence as 'exact' | 'llm_suggested' | 'possibly_different' | 'looks_different'] ||
                        'bg-muted border-border text-muted-foreground';

                      return (
                        <div
                          key={sim.product_id}
                          className={`border rounded-xl p-3 flex items-center justify-between gap-4 transition-all ${colors}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">
                                {sim.product_name}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-white/70 rounded shadow-sm leading-none border border-black/5">
                                {sim.confidence === 'llm_suggested' ? 'Possible match' : sim.confidence.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs opacity-80 mt-0.5 font-mono">
                              Latest price: €{sim.last_price?.toFixed(2)}
                            </p>
                          </div>

                          <Btn
                            onClick={() => handleUnify(item.line_id, sim.product_id)}
                            variant="secondary"
                            size="sm"
                            className="font-bold flex-shrink-0 hover:bg-white hover:text-black transition-colors"
                          >
                            Unify
                          </Btn>
                        </div>
                      );
                    })}

                  <div className="flex items-center justify-between p-3 bg-muted/40 border border-dashed border-border rounded-xl gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-card rounded-lg flex items-center justify-center border border-border text-muted-foreground shadow-xs">
                        <Sparkles size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">
                          Create standalone product
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          No existing catalog items match this description. Add as a new product.
                        </p>
                      </div>
                    </div>
                    <Btn
                      onClick={() => handleNoMatch(item.line_id)}
                      variant="secondary"
                      size="sm"
                      className="font-bold border border-border hover:bg-muted"
                    >
                      No match
                    </Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. DETAILED PRODUCT SCREEN (Screenshot 1) */}
      {view === 'detail' && productDetail && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#fafaf9]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => {
                setView('list');
                setProductDetail(null);
                setSelectedProductId(null);
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-semibold transition-colors"
            >
              <ArrowLeft size={16} /> Products
            </button>

            {/* Actions Menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-muted rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground transition-all"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-44 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden font-sans">
                    <button
                      onClick={() => {
                        setView('config');
                        setConfigTab('prices');
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Pencil size={14} /> Configuration
                    </button>
                    <button 
                      onClick={() => { setIsDeleteModalOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2 border-t border-border/50"
                    >
                      <Trash2 size={14} /> Delete Product
                    </button>
                    <button 
                      onClick={() => { setIsMergeModalOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors flex items-center gap-2 border-t border-border/50"
                    >
                      <Merge size={14} /> Merge into another Product
                    </button>
                    <button 
                      onClick={() => { handleArchive(productDetail.id, productDetail.archived); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2 border-t border-border/50"
                    >
                      {productDetail.archived ? (
                        <>
                          <Eye size={14} /> Unhide / Unarchive
                        </>
                      ) : (
                        <>
                          <EyeOff size={14} /> Hide / Archive
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Product Title / Meta */}
          <div className="mb-6 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleToggleBookmark(productDetail.id, e)}
                className="text-muted-foreground/45 hover:text-amber-500"
              >
                <Star
                  size={20}
                  className={productDetail.bookmarked ? 'text-amber-500 fill-amber-500' : ''}
                />
              </button>
              <h1 className="text-2xl font-bold text-foreground">{productDetail.name}</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(productDetail.app_category?.name || productDetail.category?.name) && (
                <span 
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={productDetail.app_category?.color ? { backgroundColor: productDetail.app_category.color, color: 'white' } : { backgroundColor: '#fef9c3', color: '#854d0e' }}
                >
                  {productDetail.app_category?.name || productDetail.category?.name}
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-primary hover:underline cursor-pointer">
              {productDetail.suppliers && productDetail.suppliers.length > 0
                ? productDetail.suppliers[0].name
                : 'No supplier'}
            </p>

            <p className="text-xs text-muted-foreground">
              VAT {productDetail.tax_rate !== undefined && productDetail.tax_rate !== null ? `${productDetail.tax_rate}%` : "10%"} · {productDetail.unit_of_measure || 'unit'} · First purchase :{' '}
              {productDetail.purchase_history && productDetail.purchase_history.length > 0
                ? new Date(
                    productDetail.purchase_history[productDetail.purchase_history.length - 1]
                      .document_date
                  ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Unknown'}
            </p>
          </div>

          {/* Stats blocks */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-1">
              <span className="text-xs text-muted-foreground">Latest price</span>
              <div className="text-2xl font-bold text-foreground font-mono">
                {productDetail.price_stats?.last
                  ? `€${productDetail.price_stats.last.toFixed(2)}`
                  : '—'}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {productDetail.purchase_history && productDetail.purchase_history.length > 0
                  ? productDetail.purchase_history[0].document_date
                  : ''}
              </p>
            </div>

            <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-1 relative">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Reference price</span>
                <HelpCircle size={13} className="text-muted-foreground/60 cursor-help" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {productDetail.price_stats?.reference
                  ? `€${productDetail.price_stats.reference.toFixed(2)}`
                  : 'No data'}
              </div>
            </div>

            <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>▲ Max</span>
                <span>▼ Min</span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-foreground font-mono pt-1">
                <span>
                  {productDetail.price_stats?.max
                    ? `€${productDetail.price_stats.max.toFixed(2)}`
                    : '—'}
                </span>
                <span className="text-muted-foreground/30">|</span>
                <span>
                  {productDetail.price_stats?.min
                    ? `€${productDetail.price_stats.min.toFixed(2)}`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-1">
              <span className="text-xs text-muted-foreground">Total purchases</span>
              <div className="text-lg font-bold text-foreground font-mono flex items-center justify-between pt-1">
                <span>{productDetail.total_units_purchased.toFixed(1)} unit</span>
                <span className="text-muted-foreground/30">|</span>
                <span>€{productDetail.total_cost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tabs header */}
          <div className="flex border-b border-border bg-white px-4 rounded-t-xl">
            <button
              onClick={() => setDetailTab('purchases')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                detailTab === 'purchases'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Purchases ({productDetail.purchase_history.length})
            </button>
            <button
              onClick={() => setDetailTab('recipes')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                detailTab === 'recipes'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Recipes ({recipeProductIds.has(String(productDetail.id)) ? 1 : 0})
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="bg-white border-x border-b border-border rounded-b-xl p-6 shadow-xs min-h-[300px]">
            {detailTab === 'purchases' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs text-muted-foreground">
                    Prices are calculated based on All documents.{' '}
                    <span className="text-primary hover:underline cursor-pointer">
                      Change supplier settings
                    </span>
                  </p>

                  {/* Doc selector: Invoices / Delivery Notes */}
                  <div className="bg-muted p-0.5 rounded-lg flex items-center gap-0.5 text-xs font-semibold">
                    <button
                      onClick={() => setDocFilter('all')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        docFilter === 'all'
                          ? 'bg-card shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All docs
                    </button>
                    <button
                      onClick={() => setDocFilter('invoices')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        docFilter === 'invoices'
                          ? 'bg-card shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Invoices
                    </button>
                    <button
                      onClick={() => setDocFilter('delivery_notes')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        docFilter === 'delivery_notes'
                          ? 'bg-card shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Delivery notes
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Product description
                        </th>
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Document
                        </th>
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Supplier
                        </th>
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                          Quantity
                        </th>
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                          Nominal price / with VAT
                        </th>
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                          VAT
                        </th>
                        <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {getFilteredPurchases().map((hist: any, index: number) => (
                        <tr key={index} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">
                            {hist.description}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                            {hist.document_date}
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-muted-foreground">
                              {hist.document_type || 'Invoice'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{hist.supplier_name}</td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {hist.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            €{hist.unit_price?.toFixed(2)}/unit
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                            {hist.iva_pct !== undefined && hist.iva_pct !== null ? `${hist.iva_pct}%` : "10%"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-foreground font-mono">
                            €{hist.total_price?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {getFilteredPurchases().length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center py-12 text-sm text-muted-foreground"
                          >
                            No purchases match this document filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground/50">
                  <Package size={20} />
                </div>
                <h3 className="font-bold text-foreground text-sm">
                  {recipeProductIds.has(String(productDetail.id))
                    ? 'Linked to Costing Matrix'
                    : 'No recipes using this item'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {recipeProductIds.has(String(productDetail.id))
                    ? 'This catalog item is mapped to ingredients in your recipe dashboard.'
                    : 'Map this product to a recipe ingredient inside the recipes tab to track food margins.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PRODUCT CONFIGURATION SCREEN (Screenshot 4) */}
      {view === 'config' && productDetail && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#fafaf9]">
          {/* Back link */}
          <div className="mb-6">
            <button
              onClick={() => handleProductClick(productDetail.id)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-semibold transition-colors"
            >
              <ArrowLeft size={16} /> {productDetail.name}
            </button>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-6">{productDetail.name}</h1>

          {/* Config sidebar layout */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Left Nav items */}
            <div className="space-y-1">
              {[
                { id: 'general', label: 'General Information', icon: Info },
                { id: 'prices', label: 'Prices', icon: DollarSign },
                { id: 'formats', label: 'Formats', icon: Package },
                { id: 'consumption', label: 'Consumption', icon: Activity }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setConfigTab(t.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
                    configTab === t.id
                      ? 'bg-white shadow-xs text-foreground border border-border'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <t.icon size={15} /> {t.label}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground/60" />
                </button>
              ))}
            </div>

            {/* Right content panel (Prices screenshot) */}
            <div className="md:col-span-3 space-y-6">
              {configTab === 'prices' ? (
                <>
                  {/* % Tax Rate */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
                    <div>
                      <span className="text-sm font-bold text-foreground block">% Tax rate</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Set Tax Percentage (Configure the tax percentage applicable to your product)
                      </p>
                    </div>

                    <select
                      value={configTaxRate}
                      onChange={(e) => setConfigTaxRate(e.target.value)}
                      className="w-full bg-muted/60 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="0">0% (Exempt)</option>
                      <option value="0.04">4% (Super-reduced)</option>
                      <option value="0.1">10% (Reduced)</option>
                      <option value="0.21">21% (Standard)</option>
                    </select>

                    <Btn
                      onClick={handleSavePriceConfig}
                      disabled={saving}
                      className="w-full bg-[#a3e635] hover:opacity-90 text-black py-2.5 font-bold"
                    >
                      {saving && <Loader2 className="animate-spin" size={14} />} Save changes
                    </Btn>
                  </div>

                  {/* Reference Price */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-bold text-foreground block">
                          Reference price
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Define the base reference price for anomaly checks
                        </p>
                      </div>
                      <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-0.5 font-semibold">
                        Learn more ↗
                      </span>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="price-option"
                          checked={configPriceOption === 'custom'}
                          onChange={() => setConfigPriceOption('custom')}
                          className="w-4 h-4 text-primary focus:ring-primary/20 border-border"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">Custom amount</span>
                          {configPriceOption === 'custom' && (
                            <div className="relative mt-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={configCustomPrice}
                                onChange={(e) => setConfigCustomPrice(e.target.value)}
                                className="w-full bg-muted/60 border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                                €
                              </span>
                            </div>
                          )}
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input
                          type="radio"
                          name="price-option"
                          checked={configPriceOption === 'last'}
                          onChange={() => setConfigPriceOption('last')}
                          className="w-4 h-4 text-primary focus:ring-primary/20 border-border"
                        />
                        <span className="text-sm font-medium text-foreground">
                          Price of the last purchase
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input
                          type="radio"
                          name="price-option"
                          checked={configPriceOption === 'average'}
                          onChange={() => setConfigPriceOption('average')}
                          className="w-4 h-4 text-primary focus:ring-primary/20 border-border"
                        />
                        <span className="text-sm font-medium text-foreground">
                          Weighted Average price
                        </span>
                      </label>
                    </div>

                    <Btn
                      onClick={handleSavePriceConfig}
                      disabled={saving}
                      className="w-full bg-[#a3e635] hover:opacity-90 text-black py-2.5 font-bold mt-2"
                    >
                      {saving && <Loader2 className="animate-spin" size={14} />} Save changes
                    </Btn>
                  </div>

                  {/* Fixed Price */}
                  <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
                    <div>
                      <span className="text-sm font-bold text-foreground block">Fixed price</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Establish fixed price (to be used in new digitized documents without price)
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={configFixedPrice}
                        onChange={(e) => setConfigFixedPrice(e.target.value)}
                        className="w-full bg-muted/60 border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                        €
                      </span>
                    </div>

                    <Btn
                      onClick={handleSavePriceConfig}
                      disabled={saving}
                      className="w-full bg-[#a3e635] hover:opacity-90 text-black py-2.5 font-bold"
                    >
                      {saving && <Loader2 className="animate-spin" size={14} />} Save changes
                    </Btn>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-border rounded-xl p-8 text-center shadow-xs">
                  <Package className="text-muted-foreground/40 mx-auto mb-2" size={24} />
                  <p className="text-sm font-semibold text-foreground">
                    Formats & Consumption logs
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This sub-tab details and recipe conversion mapping is synced automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FILTER BY DRAWER (Screenshot 2) */}
      {filterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setFilterDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-slide-in-right p-6 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 flex-shrink-0">
              <span className="text-base font-bold text-foreground">Filter by</span>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Accordion Content Area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
              {/* Accordion 1: Date */}
              <div className="border-b border-border/80 pb-4">
                <button
                  onClick={() => setAccordionOpen({ ...accordionOpen, date: !accordionOpen.date })}
                  className="w-full flex items-center justify-between py-1 text-sm font-semibold text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-2">📅 Date</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform duration-250 ${
                      accordionOpen.date ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {accordionOpen.date && (
                  <div className="mt-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2.5 border border-border rounded-xl text-xs bg-muted/20 hover:bg-muted/30 focus:outline-none transition-all font-medium text-left',
                            !dateRange?.from && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="size-4 text-muted-foreground/60 shrink-0" />
                          <span>
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, 'LLL dd, y')} -{' '}
                                  {format(dateRange.to, 'LLL dd, y')}
                                </>
                              ) : (
                                format(dateRange.from, 'LLL dd, y')
                              )
                            ) : (
                              'Select date range'
                            )}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={1}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Accordion 2: Supplier */}
              <div className="border-b border-border/80 pb-4">
                <button
                  onClick={() =>
                    setAccordionOpen({ ...accordionOpen, supplier: !accordionOpen.supplier })
                  }
                  className="w-full flex items-center justify-between py-1 text-sm font-semibold text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-2">🚚 Supplier</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform duration-250 ${
                      accordionOpen.supplier ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {accordionOpen.supplier && (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                        size={14}
                      />
                      <input
                        type="text"
                        placeholder="Search your supplier"
                        value={supplierSearchQuery}
                        onChange={(e) => setSupplierSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-xs bg-muted/20 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={selectedSupplierIds.includes('all')}
                          onChange={() => toggleSupplierSelection('all')}
                          className="w-4.5 h-4.5 rounded border-border text-primary focus:ring-primary/10"
                        />
                        <span>All</span>
                      </label>

                      {getFilteredSuppliersList().map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer font-medium"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSupplierIds.includes(String(s.id))}
                            onChange={() => toggleSupplierSelection(String(s.id))}
                            className="w-4.5 h-4.5 rounded border-border text-primary focus:ring-primary/10"
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 3: Categories */}
              <div className="border-b border-border/80 pb-4">
                <button
                  onClick={() =>
                    setAccordionOpen({ ...accordionOpen, category: !accordionOpen.category })
                  }
                  className="w-full flex items-center justify-between py-1 text-sm font-semibold text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-2">🌈 Categories</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform duration-250 ${
                      accordionOpen.category ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {accordionOpen.category && (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                        size={14}
                      />
                      <input
                        type="text"
                        placeholder="Search by category"
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-xs bg-muted/20 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes('all')}
                          onChange={() => toggleCategorySelection('all')}
                          className="w-4.5 h-4.5 rounded border-border text-primary focus:ring-primary/10"
                        />
                        <span>All</span>
                      </label>

                      {getFilteredCategoriesList().map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between py-0.5 border-b border-border/10"
                        >
                          <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(String(c.id))}
                              onChange={() => toggleCategorySelection(String(c.id))}
                              className="w-4.5 h-4.5 rounded border-border text-primary focus:ring-primary/10"
                            />
                            <span style={{ backgroundColor: '#fefce8', color: '#854d0e', padding: '2px 8px', borderRadius: '6px', fontWeight: '600', fontSize: '10px' }}>
                              {c.name}
                            </span>
                          </label>
                          <ChevronRight size={12} className="text-muted-foreground/40" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 4: More Filters */}
              <div>
                <button
                  onClick={() => setAccordionOpen({ ...accordionOpen, more: !accordionOpen.more })}
                  className="w-full flex items-center justify-between py-1 text-sm font-semibold text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-2">🏷️ More filters</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform duration-250 ${
                      accordionOpen.more ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {accordionOpen.more && (
                  <div className="mt-3 space-y-4">
                    {/* Recipes chips */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground">Recipes</span>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setFilterRecipeMode(filterRecipeMode === 'with' ? 'all' : 'with')
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filterRecipeMode === 'with'
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-transparent text-foreground border-border hover:bg-muted font-semibold'
                          }`}
                        >
                          With recipes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFilterRecipeMode(filterRecipeMode === 'without' ? 'all' : 'without')
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filterRecipeMode === 'without'
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-transparent text-foreground border-border hover:bg-muted font-semibold'
                          }`}
                        >
                          Without recipes
                        </button>
                      </div>
                    </div>

                    {/* Others chips */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground">Others</span>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setFilterViewBookmarks(!filterViewBookmarks)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filterViewBookmarks
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-transparent text-foreground border-border hover:bg-muted font-semibold'
                          }`}
                        >
                          View bookmarks
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterWithPriceIncrease(!filterWithPriceIncrease)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filterWithPriceIncrease
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-transparent text-foreground border-border hover:bg-muted font-semibold'
                          }`}
                        >
                          With price increase
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterViewHidden(!filterViewHidden)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filterViewHidden
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-transparent text-foreground border-border hover:bg-muted font-semibold'
                          }`}
                        >
                          View hidden
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterNegativePrices(!filterNegativePrices)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filterNegativePrices
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-transparent text-foreground border-border hover:bg-muted font-semibold'
                          }`}
                        >
                          Negative prices
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-3 border-t border-border pt-4 bg-white flex-shrink-0">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex-1 py-3 text-sm font-semibold border border-border rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                Delete filters
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="flex-1 py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all flex items-center justify-center font-bold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MANUAL PRODUCT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCreateModalOpen(false)}
          />

          <div className="relative bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden z-10 font-sans">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-sm">
                  <Package size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground leading-tight">
                    Create product manually
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add standalone items directly to your catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex border-b border-border bg-muted/10 divide-x divide-border">
              <div
                className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                  createStep === 1 ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    createStep === 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted border border-border text-muted-foreground'
                  }`}
                >
                  1
                </span>
                Basic information
              </div>
              <div
                className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${
                  createStep === 2 ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    createStep === 2
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted border border-border text-muted-foreground'
                  }`}
                >
                  2
                </span>
                Purchases & Recipes
              </div>
            </div>

            <form onSubmit={handleCreateSave} className="p-6 space-y-4">
              {createStep === 1 ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Fresh organic lemons"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      required
                      className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Product code / SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Optional identifier"
                      value={createForm.product_code}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, product_code: e.target.value })
                      }
                      className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Supplier *
                    </label>
                    <select
                      value={createForm.supplier_id}
                      onChange={(e) => {
                        const suppId = e.target.value;
                        // Auto-populate category from supplier's category
                        const selectedSupplier = suppliers.find(s => String(s.id) === suppId);
                        const autoCategory = selectedSupplier?.category_id || createForm.category_id;
                        setCreateForm({ ...createForm, supplier_id: suppId, category_id: autoCategory || '' });
                      }}
                      required
                      className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm cursor-pointer"
                    >
                      <option value="">Search and select supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Category *
                    </label>
                    <select
                      value={createForm.category_id}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, category_id: e.target.value })
                      }
                      required
                      className="w-full bg-muted/60 border border-border hover:border-border/80 focus:border-primary/50 rounded-xl px-4 py-3 text-sm cursor-pointer"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="flex-1 py-3 text-sm font-semibold border border-border rounded-xl text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (createForm.name.trim() && createForm.supplier_id) setCreateStep(2);
                      }}
                      disabled={!createForm.name.trim() || !createForm.supplier_id}
                      className="flex-1 py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Price *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={createForm.price}
                        onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })}
                        required
                        className="w-full bg-muted/60 border border-border rounded-xl pl-4 pr-12 py-3 text-sm font-mono"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                        €
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Unit of measure *
                    </label>
                    <select
                      value={createForm.unit_of_measure}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, unit_of_measure: e.target.value })
                      }
                      required
                      className="w-full bg-muted/60 border border-border rounded-xl px-4 py-3 text-sm cursor-pointer"
                    >
                      <option value="ud">Unit (ud)</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="l">Litre (l)</option>
                      <option value="gr">Gram (gr)</option>
                      <option value="ml">Millilitre (ml)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      Shrinkage (unusable part) %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={createForm.shrinkage_pct}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, shrinkage_pct: e.target.value })
                      }
                      className="w-full bg-muted/60 border border-border rounded-xl px-4 py-3 text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                      VAT Tax Rate
                    </label>
                    <select
                      value={createForm.tax_rate}
                      onChange={(e) => setCreateForm({ ...createForm, tax_rate: e.target.value })}
                      className="w-full bg-muted/60 border border-border rounded-xl px-4 py-3 text-sm cursor-pointer"
                    >
                      <option value="0">0%</option>
                      <option value="0.04">4%</option>
                      <option value="0.1">10%</option>
                      <option value="0.21">21%</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCreateStep(1)}
                      className="flex-1 py-3 text-sm font-semibold border border-border rounded-xl text-muted-foreground hover:bg-muted"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 className="animate-spin" size={16} />} Save product
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MERGE MODAL */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border">
            <div className="flex justify-between items-center p-6 border-b border-border/50">
              <div>
                <h3 className="text-xl font-bold text-foreground">Merge Product</h3>
                <p className="text-sm text-muted-foreground mt-1">Merge <b>{productDetail?.name}</b> into another product.</p>
              </div>
              <button 
                onClick={() => setIsMergeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-2"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded-xl text-sm mb-4 border border-amber-200 dark:border-amber-900">
                <b>Warning:</b> This product will be hidden and all its purchase history will be transferred to the selected master product. This action cannot be undone.
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">
                  Select Master Product
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={mergeSearch}
                    onChange={(e) => setMergeSearch(e.target.value)}
                    className="w-full bg-muted/60 border border-border rounded-t-xl px-10 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border border-t-0 border-border rounded-b-xl bg-card">
                  {products
                    .filter((p) => p.id !== productDetail?.id && p.name.toLowerCase().includes(mergeSearch.toLowerCase()))
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setMergeTargetId(p.id)}
                        className={cn(
                          "px-4 py-3 text-sm cursor-pointer transition-colors border-b border-border/30 last:border-0",
                          mergeTargetId === p.id ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 font-semibold" : "hover:bg-muted"
                        )}
                      >
                        {p.name}
                      </div>
                  ))}
                  {products.filter((p) => p.id !== productDetail?.id && p.name.toLowerCase().includes(mergeSearch.toLowerCase())).length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No matching products found.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-muted/30 border-t border-border/50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!mergeTargetId || loading}
                onClick={handleMergeProduct}
                className="px-5 py-2.5 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Merge size={16} />}
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL MERGE MODAL */}
      {isGlobalMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-border">
            <div className="flex justify-between items-center p-6 border-b border-border/50">
              <div>
                <h3 className="text-xl font-bold text-foreground">Merge Products</h3>
                <p className="text-sm text-muted-foreground mt-1">Select a source product to merge into a master product.</p>
              </div>
              <button 
                onClick={() => setIsGlobalMergeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-2"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded-xl text-sm border border-amber-200 dark:border-amber-900">
                  <b>Warning:</b> The <u>Source Product</u> will be hidden and all its purchase history will be transferred to the <u>Master Product</u>. This action cannot be undone.
                </div>
                
                {globalMergeSourceId && globalMergeTargetId && (
                  <div className="text-center bg-muted/40 py-2.5 rounded-xl border border-border text-sm text-muted-foreground shadow-sm">
                    Merging <span className="font-semibold text-foreground mx-1">{products.find(p => p.id === globalMergeSourceId)?.name}</span> into <span className="font-semibold text-foreground mx-1">{products.find(p => p.id === globalMergeTargetId)?.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                {/* Master Product (Base) */}
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <GitMerge size={14} className="rotate-90" /> base: Master Product
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Search master..."
                      value={globalMergeTargetSearch}
                      onChange={(e) => setGlobalMergeTargetSearch(e.target.value)}
                      className="w-full bg-background border border-border rounded-t-xl px-9 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-t-0 border-border rounded-b-xl bg-card shadow-sm">
                    {products
                      .filter((p) => p.name.toLowerCase().includes(globalMergeTargetSearch.toLowerCase()) && p.id !== globalMergeSourceId)
                      .map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setGlobalMergeTargetId(p.id)}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer transition-colors border-b border-border/30 last:border-0",
                            globalMergeTargetId === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                          )}
                        >
                          {p.name}
                        </div>
                    ))}
                    {products.filter((p) => p.name.toLowerCase().includes(globalMergeTargetSearch.toLowerCase()) && p.id !== globalMergeSourceId).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No products found.
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div className="pt-8 text-muted-foreground flex-shrink-0">
                  <ArrowLeft size={16} />
                </div>

                {/* Source Product (Compare) */}
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    compare: Source Product
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Search source..."
                      value={globalMergeSourceSearch}
                      onChange={(e) => setGlobalMergeSourceSearch(e.target.value)}
                      className="w-full bg-background border border-border rounded-t-xl px-9 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-t-0 border-border rounded-b-xl bg-card shadow-sm">
                    {products
                      .filter((p) => p.name.toLowerCase().includes(globalMergeSourceSearch.toLowerCase()) && p.id !== globalMergeTargetId)
                      .map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setGlobalMergeSourceId(p.id)}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer transition-colors border-b border-border/30 last:border-0",
                            globalMergeSourceId === p.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                          )}
                        >
                          {p.name}
                        </div>
                    ))}
                    {products.filter((p) => p.name.toLowerCase().includes(globalMergeSourceSearch.toLowerCase()) && p.id !== globalMergeTargetId).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No products found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsGlobalMergeModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!globalMergeSourceId || !globalMergeTargetId || loading}
                onClick={handleGlobalMergeProduct}
                className="px-5 py-2.5 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Merge size={16} />}
                Merge Products
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          if (productDetail) {
            handleDeleteProduct(productDetail.id);
          }
        }}
        title="Delete Product"
        message={`Are you sure you want to delete ${productDetail?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />

      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Products"
        message={`Are you sure you want to delete the ${selectedIds.length} selected products? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
      />
    </div>
  );
}
