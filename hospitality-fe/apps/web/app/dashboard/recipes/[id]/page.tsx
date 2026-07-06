'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Image as ImageIcon,
  X,
  Search,
  Check,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../../../store/auth';
import { Badge, Btn } from '../../_components/ui';
import ConfirmModal from '../../suppliers/_components/ConfirmModal';

interface SupplierShort {
  id: string;
  name: string;
}

interface RecipeIngredientResponse {
  ingredientID: string;
  ingredientLineID: string;
  ingredientType: string; // "product" or "preparation"
  name: string;
  quantity: number;
  displayUnit: string;
  shrinkage: number;
  shrinkageType: string;
  netQuantity: number;
  lastPrice: number;
  costPerDish: number;
  costStatus: string;
  isPreparation: boolean;
  referencePrice: number;
  productID?: string;
  childRecipeID?: string;
  suppliers: SupplierShort[];
}

interface BOMDetails {
  dishID: string;
  cost: number;
  costStatus: string;
  profit: number;
  margin: number;
  quantity: number;
  uom: string;
  items: RecipeIngredientResponse[];
  errors: string[];
}

interface DishDetailsResponse {
  id: string;
  dbId: number;
  name: string;
  base: number;
  tax: number;
  price: number;
  cost: number;
  profit: number;
  margin: number;
  hasErrors: boolean;
  isPreparation: boolean;
  unitOfMeasure: string;
  portions: number;
  usesInMenus: number;
  tag?: { id: string; name: string };
  notes?: string;
  imageUrl?: string;
  linkedArticles: RecipeIngredientResponse[];
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const apiClient = useAuthStore((state) => state.apiClient);
  const dishId = params.id as string;

  const [dish, setDish] = useState<DishDetailsResponse | null>(null);
  const [bom, setBom] = useState<BOMDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'ingredients' | 'notes'>('ingredients');

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTagName, setEditTagName] = useState('');
  const [editUOM, setEditUOM] = useState('ud');
  const [editPortions, setEditPortions] = useState(1);
  const [editBasePrice, setEditBasePrice] = useState('0.00'); // GRP
  const [editTaxAmount, setEditTaxAmount] = useState('0.00'); // IVA
  const [editSalePrice, setEditSalePrice] = useState('0.00'); // NRP
  const [editIvaRate, setEditIvaRate] = useState(10); // 10% default
  const [editExpectedMargin, setEditExpectedMargin] = useState('20');
  const [recipeNotes, setRecipeNotes] = useState('');
  const [isAllergensOpen, setIsAllergensOpen] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string } | null>(null);

  // Add Tag Popover State
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Existing tags catalog
  const [existingTags, setExistingTags] = useState<string[]>([]);

  // Add Ingredient Panel States (collapsible inline card, mockup 3)
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [ingType, setIngType] = useState<'product' | 'preparation'>('product');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [ingNetQuantity, setIngNetQuantity] = useState('1.00');
  const [ingShrinkage, setIngShrinkage] = useState('0.00');
  
  const [defaultProducts, setDefaultProducts] = useState<any[]>([]);
  const [defaultPreps, setDefaultPreps] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const step1Ref = useRef<HTMLDivElement>(null);
  const [searching, setSearching] = useState(false);

  // Calculate gross quantity & cost for inline panel
  const shrinkagePercent = parseFloat(ingShrinkage) || 0;
  const netQtyNum = parseFloat(ingNetQuantity) || 0;
  const calculatedGrossQty = shrinkagePercent > 0 
    ? netQtyNum / (1 - (shrinkagePercent / 100))
    : netQtyNum;
  
  const unitCost = selectedItem ? selectedItem.price : 0;
  const calculatedProductCost = calculatedGrossQty * unitCost;

  const fetchDishDetails = async () => {
    setLoading(true);
    try {
      const bomData = await apiClient.getBOM(dishId);
      setBom(bomData.bom);

      const dishesList = await apiClient.getRecipes() as any[];
      const matchedFull = dishesList.find((d: any) => d.id === dishId);
      
      if (matchedFull) {
        setDish({
          ...matchedFull,
          linkedArticles: bomData.bom.items
        });
        
        // Initialize edit states
        setEditName(matchedFull.name);
        setEditTagName(matchedFull.tag?.name || '');
        setEditUOM(matchedFull.unitOfMeasure || 'ud');
        setEditPortions(matchedFull.portions || 1);
        setEditBasePrice(matchedFull.base.toFixed(2));
        setEditTaxAmount(matchedFull.tax.toFixed(2));
        setEditSalePrice(matchedFull.price.toFixed(2));
        setRecipeNotes(matchedFull.notes || '');
        
        // Infer IVA rate
        if (matchedFull.base > 0) {
          const rate = Math.round((matchedFull.tax / matchedFull.base) * 100);
          setEditIvaRate(rate);
        } else {
          setEditIvaRate(10);
        }
        
        const initialMargin = matchedFull.margin > 0 ? (matchedFull.margin * 100).toFixed(0) : '20';
        setEditExpectedMargin(initialMargin);
      } else {
        // Fallback default details
        const extractedName = dishId.replace('dish~', '').replace(/_/g, ' ');
        const fallbackBase = bomData.bom.profit || 0.00;
        const fallback = {
          id: dishId,
          dbId: 1,
          name: extractedName,
          base: fallbackBase,
          tax: 0.00,
          price: fallbackBase,
          cost: bomData.bom.cost,
          profit: bomData.bom.profit,
          margin: bomData.bom.margin,
          hasErrors: bomData.bom.margin < 0.3,
          isPreparation: false,
          unitOfMeasure: bomData.bom.uom || 'ud',
          portions: 1,
          usesInMenus: 0,
          tag: { id: 'dtag~uncategorized', name: 'UNCATEGORIZED' },
          notes: '',
          linkedArticles: bomData.bom.items
        };
        setDish(fallback);
        
        setEditName(fallback.name);
        setEditTagName(fallback.tag.name);
        setEditUOM(fallback.unitOfMeasure);
        setEditPortions(fallback.portions);
        setEditBasePrice(fallback.base.toFixed(2));
        setEditTaxAmount(fallback.tax.toFixed(2));
        setEditSalePrice(fallback.price.toFixed(2));
        setEditIvaRate(10);
        setEditExpectedMargin('20');
        setRecipeNotes(fallback.notes || '');
      }
    } catch (err) {
      console.error('Error fetching dish details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    if (!dish) return;
    try {
      const tags = await apiClient.getRecipeTags();
      const filtered = tags
        .filter((t: any) => t.isPreparation === dish.isPreparation)
        .map((t: any) => t.name);
      setExistingTags(filtered);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  useEffect(() => {
    if (dishId) {
      fetchDishDetails();
    }
  }, [dishId, apiClient]);

  useEffect(() => {
    if (dish) {
      fetchTags();
    }
  }, [dish, apiClient]);

  // Load initial catalog for add-ingredient dropdown selection
  useEffect(() => {
    if (isAddingIngredient) {
      apiClient.searchSuppliedProducts("").then(setDefaultProducts).catch(console.error);
      apiClient.getDishes({ preparations: true }).then((data) => {
        setDefaultPreps(data.map((p: any) => ({
          id: p.id,
          dbId: p.dbId,
          name: p.name,
          sku: 'Preparation',
          price: p.cost,
          unit: p.unitOfMeasure,
          supplierName: 'Internal Prep'
        })));
      }).catch(console.error);
    }
  }, [isAddingIngredient, apiClient]);

  // Click outside listener for tags popover and ingredient dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(event.target as Node)) {
        setIsTagPopoverOpen(false);
      }
      if (step1Ref.current && !step1Ref.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search products or preparations when query changes
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        if (ingType === 'product') {
          const products = await apiClient.searchSuppliedProducts(searchQuery);
          setSearchResults(products);
        } else {
          const preps = await apiClient.getDishes({ preparations: true });
          const filtered = preps.filter((p: any) => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(filtered.map((p: any) => ({
            id: p.id,
            dbId: p.dbId,
            name: p.name,
            sku: 'Preparation',
            price: p.cost, 
            unit: p.unitOfMeasure,
            supplierName: 'Internal Prep'
          })));
        }
      } catch (err) {
        console.error('Error searching ingredients:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, ingType]);

  // Dynamic pricing calculations for edit form
  const handleBasePriceChange = (valStr: string) => {
    setEditBasePrice(valStr);
    const base = parseFloat(valStr) || 0;
    const tax = base * (editIvaRate / 100);
    setEditTaxAmount(tax.toFixed(2));
    setEditSalePrice((base + tax).toFixed(2));
  };

  const handleSalePriceChange = (valStr: string) => {
    setEditSalePrice(valStr);
    const sale = parseFloat(valStr) || 0;
    const base = sale / (1 + (editIvaRate / 100));
    setEditBasePrice(base.toFixed(2));
    setEditTaxAmount((sale - base).toFixed(2));
  };

  const handleIvaRateChange = (newRate: number) => {
    setEditIvaRate(newRate);
    const base = parseFloat(editBasePrice) || 0;
    const tax = base * (newRate / 100);
    setEditTaxAmount(tax.toFixed(2));
    setEditSalePrice((base + tax).toFixed(2));
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dish) return;
    try {
      const intId = dish.dbId;
      if (!intId) {
        setAlertConfig({ title: 'Error', message: 'Could not resolve the recipe integer ID.' });
        return;
      }

      const baseNum = parseFloat(editBasePrice) || 0;
      const taxNum = parseFloat(editTaxAmount) || 0;
      
      const payload = {
        name: editName,
        base: baseNum,
        tax: taxNum,
        unitOfMeasure: editUOM,
        tagName: editTagName || undefined,
        portions: editPortions,
        salePrice: baseNum + taxNum
      };

      await apiClient.updateRecipe(intId, payload);
      setIsEditing(false);
      fetchDishDetails();
    } catch (err) {
      console.error('Error updating recipe:', err);
      setAlertConfig({ title: 'Error', message: 'Failed to update dish details.' });
    }
  };

  const handleAddIngredient = async () => {
    if (!dish || !selectedItem) return;
    try {
      const intId = dish.dbId;
      if (!intId) {
        setAlertConfig({ title: 'Error', message: 'Could not resolve recipe ID.' });
        return;
      }

      let childId: number | null = null;
      let prodId: number | null = null;

      if (ingType === 'preparation') {
        childId = selectedItem.dbId || null;
      } else {
        prodId = selectedItem.id || null;
      }

      const payload = {
        productId: prodId,
        childRecipeId: childId,
        quantity: calculatedGrossQty
      };

      await apiClient.addIngredient(intId, payload);
      
      // Reset & collapse panel
      setSelectedItem(null);
      setSearchQuery('');
      setIngNetQuantity('1.00');
      setIngShrinkage('0.00');
      setIsAddingIngredient(false);
      fetchDishDetails();
    } catch (err) {
      console.error('Error adding ingredient:', err);
      setAlertConfig({ title: 'Error', message: 'Failed to add ingredient to recipe.' });
    }
  };

  const handleRemoveIngredient = async (ingredientLineID: string) => {
    try {
      const item = bom?.items.find(i => i.ingredientLineID === ingredientLineID);
      if (!item) return;
      
      const lineId = parseInt(ingredientLineID);
      await apiClient.removeIngredient(lineId);
      fetchDishDetails();
    } catch (err) {
      console.error('Error removing ingredient:', err);
      setAlertConfig({ title: 'Error', message: 'Failed to remove ingredient.' });
    }
  };

  const handleSelectTag = async (tagName: string) => {
    if (!dish) return;
    try {
      const intId = dish.dbId;
      if (!intId) return;

      const payload = {
        name: dish.name,
        base: dish.base,
        tax: dish.tax,
        unitOfMeasure: dish.unitOfMeasure,
        portions: dish.portions,
        tagName: tagName
      };

      await apiClient.updateRecipe(intId, payload);
      setIsTagPopoverOpen(false);
      fetchDishDetails();
    } catch (err) {
      console.error('Error updating tag:', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!dish) return;
    setSavingNotes(true);
    try {
      const intId = dish.dbId;
      if (!intId) return;

      const payload = {
        name: dish.name,
        base: dish.base,
        tax: dish.tax,
        unitOfMeasure: dish.unitOfMeasure,
        portions: dish.portions,
        notes: recipeNotes
      };

      await apiClient.updateRecipe(intId, payload);
      setAlertConfig({ title: 'Success', message: 'Notes saved successfully.' });
      fetchDishDetails();
    } catch (err) {
      console.error('Error saving notes:', err);
      setAlertConfig({ title: 'Error', message: 'Failed to save notes.' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dish) return;

    setUploadingImage(true);
    try {
      await apiClient.uploadRecipeImage(dish.dbId, file);
      setAlertConfig({ title: 'Success', message: 'Image uploaded successfully.' });
      fetchDishDetails();
    } catch (err) {
      console.error('Error uploading image:', err);
      setAlertConfig({ title: 'Error', message: 'Failed to upload image.' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateNewTag = () => {
    if (!tagSearchQuery.trim()) return;
    const newTag = tagSearchQuery.toUpperCase();
    if (!existingTags.includes(newTag)) {
      setExistingTags(prev => [newTag, ...prev]);
    }
    handleSelectTag(newTag);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const filteredTags = existingTags.filter(t => 
    t.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  if (loading || !dish) {
    return (
      <div className="flex-1 bg-[#fafaf8] min-h-screen flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground text-sm font-semibold">Loading recipe costing detail...</p>
      </div>
    );
  }

  // --- EDIT SCREEN MODE (Mockup 1) ---
  if (isEditing) {
    return (
      <div className="flex-1 bg-[#fafaf8] min-h-screen p-6 md:p-8 font-sans">
        
        {/* Back Link */}
        <button 
          onClick={() => setIsEditing(false)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm font-bold mb-4 transition-colors"
        >
          <ChevronLeft size={16} />
          Recipes
        </button>

        <h1 className="text-3xl font-black text-foreground mb-6">Dish</h1>

        {/* Edit Card */}
        <div className="max-w-2xl bg-white rounded-[10px] border border-border p-6 shadow-sm">
          <form onSubmit={handleUpdateDish} className="space-y-8">
            
            {/* Section 1: Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight border-b border-border/40 pb-2">
                Basic information
              </h3>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Dish name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  {dish.isPreparation ? 'Preparation type' : 'Dish type'} <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={editTagName}
                  onChange={(e) => setEditTagName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary transition-all font-bold tracking-wide uppercase text-foreground"
                >
                  <option value="">Select type...</option>
                  {existingTags.map(tagName => (
                    <option key={tagName} value={tagName}>{tagName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Quantity <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    readOnly
                    value="1"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#fafaf8] border border-border rounded-[10px] focus:outline-none font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Unit
                  </label>
                  <select
                    value={editUOM}
                    onChange={(e) => setEditUOM(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                  >
                    <option value="ud">unit</option>
                    <option value="kg">kg</option>
                    <option value="l">liter</option>
                    <option value="ml">ml</option>
                    <option value="g">gr</option>
                  </select>
                </div>
              </div>

              {/* Collapsible Allergens Accordion */}
              <div className="border border-border/60 rounded-[10px]">
                <button
                  type="button"
                  onClick={() => setIsAllergensOpen(!isAllergensOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-foreground hover:bg-muted/10 transition-colors"
                >
                  <span>&gt; Allergens (0)</span>
                </button>
                {isAllergensOpen && (
                  <div className="p-4 border-t border-border/40 text-xs text-muted-foreground bg-[#fafaf8]">
                    No allergens selected. Add allergens to this dish for POS sync.
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Sale Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight border-b border-border/40 pb-2">
                Sale details
              </h3>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Portions <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={editPortions}
                  onChange={(e) => setEditPortions(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Expected margin
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={editExpectedMargin}
                    onChange={(e) => setEditExpectedMargin(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary font-mono text-right pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                </div>
                {/* Recommendation Line */}
                {parseFloat(editExpectedMargin) > 0 && parseFloat(editExpectedMargin) < 100 && (
                  <div className="text-xs text-muted-foreground mt-1.5 font-medium">
                    GRP recommended according to margin: €{(dish.cost / (1 - parseFloat(editExpectedMargin) / 100)).toFixed(2)}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const recBase = (dish.cost / (1 - parseFloat(editExpectedMargin) / 100)).toFixed(2);
                        handleBasePriceChange(recBase);
                      }}
                      className="text-accent hover:underline font-bold ml-1 cursor-pointer"
                    >
                      Apply GRP
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Selling Price */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight border-b border-border/40 pb-2">
                Selling price
              </h3>

              <div className="grid grid-cols-5 gap-3 items-center">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-foreground mb-1.5">GRP</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editBasePrice}
                    onChange={(e) => handleBasePriceChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary font-mono text-right"
                  />
                </div>
                <div className="text-center font-bold text-muted-foreground pt-5">+</div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-foreground mb-1.5">VAT</label>
                  <input
                    type="text"
                    readOnly
                    value={`${editTaxAmount} €`}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#fafaf8] border border-border rounded-[10px] font-mono text-right text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3 items-center">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-foreground mb-1.5">NRP</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editSalePrice}
                    onChange={(e) => handleSalePriceChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary font-mono text-right font-bold"
                  />
                </div>
                <div className="text-center font-bold text-muted-foreground pt-5">=</div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-foreground mb-1.5">VAT</label>
                  <select
                    value={editIvaRate}
                    onChange={(e) => handleIvaRateChange(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary transition-all font-semibold"
                  >
                    <option value={0}>0%</option>
                    <option value={4}>4%</option>
                    <option value={10}>10%</option>
                    <option value={21}>21%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 border-t border-border/40 pt-6">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 text-sm font-bold text-foreground bg-white hover:bg-muted/10 border border-border rounded-[10px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#1f8f5c] hover:bg-[#1c7f52] rounded-[10px] transition-colors cursor-pointer shadow-sm"
              >
                <Check size={16} />
                Save
              </button>
            </div>

          </form>
        </div>

      </div>
    );
  }

  // --- READ-ONLY DETAIL SCREEN MODE (Mockup 2) ---
  return (
    <div className="flex-1 bg-[#fafaf8] min-h-screen p-6 md:p-8 font-sans">
      
      {/* Back button */}
      <button 
        onClick={() => router.push('/dashboard/recipes')}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm font-bold mb-4 transition-colors"
      >
        <ChevronLeft size={16} />
        Recipes
      </button>

      {/* Main Title */}
      <h1 className="text-3xl font-black text-foreground mb-6">{dish.isPreparation ? 'Preparation' : 'Dish'}</h1>

      {/* Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left Info Box */}
        <div className="lg:col-span-2 bg-white rounded-[10px] border border-border p-6 shadow-sm flex flex-col justify-between relative">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="bg-[#e6f4ec] text-[#1f8f5c] text-[10px] font-black uppercase px-2.5 py-1 rounded-[10px] tracking-wider border border-[#1f8f5c]/10">
                {dish.tag?.name || 'UNGROUPED'}
              </span>
              <span className="text-muted-foreground text-xs font-semibold">Creation date: 24/02/2026</span>
            </div>
            
            <h2 className="text-2xl font-black text-foreground mb-6 capitalize">{dish.name}</h2>
            
            <div className="space-y-4 border-t border-border/30 pt-4 text-sm font-semibold">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Allergens</span>
                <span className="text-foreground">-</span>
              </div>
              
              {/* Tags popover selector */}
              <div className="flex justify-between items-center py-1 relative">
                <span className="text-muted-foreground">{dish.isPreparation ? 'Preparation type' : 'Dish type'}</span>
                <div className="flex items-center gap-2">
                  {dish.tag?.name && (
                    <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-[10px] bg-accent/10 text-accent border border-accent/20">
                      {dish.tag.name}
                    </span>
                  )}
                  <button 
                    onClick={() => setIsTagPopoverOpen(!isTagPopoverOpen)}
                    className="text-foreground hover:bg-muted/30 text-xs font-bold border border-border px-3 py-1 rounded-[10px] bg-white transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {dish.tag?.name ? 'Edit' : '+ Add'}
                  </button>

                  {/* Add Tag Popover (Mockup 2) */}
                  {isTagPopoverOpen && (
                    <div 
                      ref={tagPopoverRef}
                      className="absolute right-0 top-8 z-50 w-64 bg-white border border-border rounded-[10px] shadow-xl p-3 space-y-3 mt-1"
                    >
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <input
                          type="text"
                          placeholder={`Select or create type`}
                          value={tagSearchQuery}
                          onChange={(e) => setTagSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-[10px] focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1 border-t border-border/20">
                        {filteredTags.length === 0 && tagSearchQuery.trim() && (
                          <button
                            onClick={handleCreateNewTag}
                            className="w-full text-left px-2 py-1.5 text-xs text-[#1f8f5c] hover:bg-muted/10 font-bold rounded-lg transition-colors flex items-center justify-between"
                          >
                            <span>Create "{tagSearchQuery.toUpperCase()}"</span>
                            <Plus size={12} />
                          </button>
                        )}
                        {filteredTags.map((tag) => (
                          <label
                            key={tag}
                            className="flex items-center gap-2.5 px-2 py-1 hover:bg-muted/10 rounded-lg cursor-pointer text-xs font-bold text-foreground"
                          >
                            <input
                              type="checkbox"
                              checked={dish.tag?.name === tag}
                              onChange={() => handleSelectTag(tag)}
                              className="rounded border-border text-[#1f8f5c] focus:ring-[#1f8f5c]/10"
                            />
                            <span className="bg-muted px-2 py-0.5 rounded-[10px] text-muted-foreground text-[10px] font-black uppercase tracking-wider">
                              {tag}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Quantity produced</span>
                <span className="text-foreground">1 unit</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Portions</span>
                <span className="text-foreground">1 portion</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">NRP (Net retail price incl. IVA)</span>
                <span className="text-foreground font-black font-mono">{formatCurrency(dish.price)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Expected margin</span>
                <span className="text-foreground">-</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 border-t border-border/30 pt-4 mt-6">
            <button className="flex-1 flex items-center justify-center gap-1.5 bg-[#f5f4f1] hover:opacity-90 border border-border text-foreground text-sm font-bold py-2.5 rounded-[10px] transition-colors cursor-pointer">
              <Download size={16} />
              Download as PDF
            </button>
            <button 
              onClick={() => setIsEditing(true)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-muted/10 border border-border text-foreground text-sm font-bold py-2.5 rounded-[10px] transition-colors cursor-pointer"
            >
              <Edit3 size={16} />
              Edit
            </button>
          </div>
        </div>

        {/* Right Cost Summary & Image Box */}
        <div className="flex flex-col gap-6">
          
          {/* Cost summary card */}
          <div className="bg-white rounded-[10px] border border-border p-6 shadow-sm">
            <h3 className="text-sm font-black text-foreground mb-4 tracking-tight">Summary per portion</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#fafaf8] p-3.5 rounded-[10px] border border-border/40">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">GRP</div>
                <div className="text-lg font-black text-foreground mt-1 font-mono">{formatCurrency(dish.base)}</div>
              </div>
              <div className="bg-[#fafaf8] p-3.5 rounded-[10px] border border-border/40">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">Cost</div>
                <div className="text-lg font-black text-[#b23a3a] mt-1 font-mono">{formatCurrency(dish.cost)}</div>
              </div>
              <div className="bg-[#fafaf8] p-3.5 rounded-[10px] border border-border/40">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">Profit</div>
                <div className="text-lg font-black text-foreground mt-1 font-mono">{formatCurrency(dish.profit)}</div>
              </div>
              <div className="bg-[#fafaf8] p-3.5 rounded-[10px] border border-border/40">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">Margin</div>
                <div className="text-lg font-black text-[#1f8f5c] mt-1 font-mono">
                  {Math.round(dish.margin * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Picture card */}
          <div className="bg-white rounded-[10px] border border-border p-6 shadow-sm flex flex-col items-center justify-center text-center flex-1 min-h-[160px] relative overflow-hidden group">
            {dish.imageUrl ? (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-50">
                <img 
                  src={dish.imageUrl} 
                  alt={dish.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-150 gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={uploadingImage}
                    className="px-3 py-1.5 text-[10px] font-bold bg-white text-foreground rounded-lg shadow cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    {uploadingImage ? 'Uploading...' : 'Change Image'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-[#fafaf8] rounded-[10px] flex items-center justify-center text-muted-foreground border border-dashed border-border mb-3">
                  <ImageIcon size={28} />
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={uploadingImage}
                  className="text-xs font-bold text-accent hover:underline cursor-pointer"
                >
                  {uploadingImage ? 'Uploading...' : '+ Add image'}
                </button>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
              accept="image/*"
            />
          </div>

        </div>
      </div>

      {/* Sub Tabs: Ingredients / Notes */}
      <div className="flex border-b border-border mb-6 bg-white rounded-[10px] p-1 shadow-sm max-w-fit">
        <button
          onClick={() => setActiveSubTab('ingredients')}
          className={`px-4 py-2 text-sm font-bold rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'ingredients'
              ? 'bg-[#151515] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
          }`}
        >
          Ingredients
        </button>
        <button
          onClick={() => setActiveSubTab('notes')}
          className={`px-4 py-2 text-sm font-bold rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'notes'
              ? 'bg-[#151515] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
          }`}
        >
          Notes
        </button>
      </div>

      {/* Ingredients List Table */}
      {activeSubTab === 'notes' ? (
        <div className="bg-white border border-border rounded-[10px] p-6 shadow-sm min-h-[220px] flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground mb-2">Recipe Preparation Notes</h3>
            <textarea
              value={recipeNotes}
              onChange={(e) => setRecipeNotes(e.target.value)}
              className="w-full min-h-[120px] p-3.5 text-sm bg-[#fafaf8] border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
              placeholder="Add chef instructions, prep steps, plating guides, or storage details..."
            />
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="px-5 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 disabled:bg-gray-200 disabled:text-gray-400 rounded-[10px] transition-colors cursor-pointer"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-[10px] shadow-sm overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Ingredients to produce 1 ud</h3>
                <button className="text-xs text-accent font-bold hover:underline mt-1 block cursor-pointer">
                  Calculate quantities
                </button>
              </div>
              <Btn 
                onClick={() => setIsAddingIngredient(!isAddingIngredient)} 
                variant="primary" 
                className="rounded-[10px]"
              >
                + Add ingredient
              </Btn>
            </div>

            {/* Collapsible Inline Add Ingredient Panel (Mockup 3) */}
            {isAddingIngredient && (
              <div className="bg-[#fafaf8] border border-border rounded-[10px] p-5 mb-6 space-y-5 shadow-inner">
                
                {/* Step 1: Search and Select */}
                <div ref={step1Ref} className="space-y-2 relative">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                    <span className="bg-primary text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">1</span>
                    Search and select a product/preparation
                  </h4>

                  <div className="flex gap-2">
                    <select
                      value={ingType}
                      onChange={(e) => { setIngType(e.target.value as any); setSelectedItem(null); setSearchQuery(''); setIsDropdownOpen(true); }}
                      className="px-3 py-2 text-xs border border-border rounded-[10px] bg-white focus:outline-none focus:ring-1 focus:ring-primary font-bold text-foreground"
                    >
                      <option value="product">Products</option>
                      <option value="preparation">Preparations</option>
                    </select>

                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <input
                        type="text"
                        placeholder={ingType === 'product' ? "Search and select a product" : "Search and select a preparation"}
                        value={searchQuery}
                        onFocus={() => setIsDropdownOpen(true)}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        className="w-full pl-9 pr-8 py-2 text-xs border border-border rounded-[10px] focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Search Results / Default Dropdown list */}
                  {!selectedItem && isDropdownOpen && (
                    <div className="absolute z-50 w-full max-h-48 overflow-y-auto border border-border rounded-[10px] bg-white divide-y divide-border/20 shadow-md mt-1 left-0">
                      {searching ? (
                        <div className="p-3 text-center text-xs text-muted-foreground font-semibold animate-pulse">
                          Searching database...
                        </div>
                      ) : (searchQuery.trim() ? searchResults : (ingType === 'product' ? defaultProducts : defaultPreps)).length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground font-semibold">
                          No matches found
                        </div>
                      ) : (
                        (searchQuery.trim() ? searchResults : (ingType === 'product' ? defaultProducts : defaultPreps)).map((item) => (
                          <div
                            key={item.id}
                            onClick={() => { 
                              setSelectedItem(item); 
                              setSearchQuery(''); 
                              setIsDropdownOpen(false); 
                            }}
                            className="p-3 hover:bg-muted/10 cursor-pointer flex justify-between items-center transition-colors group"
                          >
                            <div>
                              <div className="text-xs font-bold text-foreground group-hover:text-accent transition-colors capitalize">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{item.supplierName} · SKU: {item.sku}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-foreground font-mono">{formatCurrency(item.price)}</div>
                              <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Per {item.unit}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Selected Item Indicator */}
                  {selectedItem && (
                    <div className="bg-accent/5 border border-accent/20 rounded-[10px] p-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-accent capitalize">{selectedItem.name}</p>
                        <p className="text-[10px] text-accent/80 mt-0.5">
                          {selectedItem.supplierName} · {formatCurrency(selectedItem.price)}/{selectedItem.unit}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedItem(null)}
                        className="text-xs font-bold text-foreground hover:bg-muted bg-white px-2.5 py-1 rounded-[10px] border border-border transition-all cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Step 2: Introduce Quantities */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                    <span className="bg-primary text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">2</span>
                    Introduce the quantity for the recipe
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
                    
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                        Net quantity (recipe)
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          step="0.001"
                          value={ingNetQuantity}
                          onChange={(e) => setIngNetQuantity(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-border rounded-l-[10px] focus:outline-none focus:ring-1 focus:ring-primary font-mono text-right"
                        />
                        <span className="px-3 py-2 text-xs border-y border-r border-border bg-[#fafaf8] rounded-r-[10px] text-muted-foreground font-semibold">
                          {selectedItem?.unit || 'unit'}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                        Shrinkage to apply
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          step="0.1"
                          value={ingShrinkage}
                          onChange={(e) => setIngShrinkage(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-border rounded-l-[10px] focus:outline-none focus:ring-1 focus:ring-primary font-mono text-right"
                        />
                        <span className="px-2 py-2 text-xs border-y border-r border-border bg-[#fafaf8] rounded-r-[10px] text-muted-foreground font-bold">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="col-span-1 text-right font-mono pb-2">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Gross qty (calc)</div>
                      <span className="text-xs font-bold text-foreground">{calculatedGrossQty.toFixed(2)}</span>
                    </div>

                    <div className="col-span-1 text-right font-mono pb-2">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Product cost</div>
                      <span className="text-xs font-black text-foreground">{formatCurrency(calculatedProductCost)}</span>
                    </div>

                  </div>
                </div>

                {/* Inline Panel Actions */}
                <div className="flex justify-end gap-2.5 border-t border-border/20 pt-4 mt-2">
                  <button
                    onClick={() => { setIsAddingIngredient(false); setSelectedItem(null); }}
                    className="px-4 py-2 text-xs font-bold text-foreground bg-white hover:bg-muted/10 border border-border rounded-[10px] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddIngredient}
                    disabled={!selectedItem || netQtyNum <= 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 disabled:opacity-40 rounded-[10px] transition-colors cursor-pointer"
                  >
                    Add ingredient
                  </button>
                </div>

              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-[#fafaf8]">
                    <th className="py-3.5 px-4">Product / Preparation</th>
                    <th className="py-3.5 px-4 text-center">Gross quantity</th>
                    <th className="py-3.5 px-4 text-center">Shrinkage</th>
                    <th className="py-3.5 px-4 text-center">Net quantity</th>
                    <th className="py-3.5 px-4 text-center">Last purchase price</th>
                    <th className="py-3.5 px-4 text-right">Product cost</th>
                    <th className="py-3.5 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {dish.linkedArticles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs font-medium">
                        No ingredients added yet. Click "+ Add ingredient" to start costing this dish.
                      </td>
                    </tr>
                  ) : (
                    dish.linkedArticles.map((ing) => (
                      <tr key={ing.ingredientLineID} className="hover:bg-muted/5 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground capitalize text-xs">{ing.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {ing.suppliers?.[0]?.name || 'Supplier N/A'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-foreground font-mono">
                          {ing.quantity.toFixed(2)} {ing.displayUnit}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-muted-foreground font-mono">
                          -
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-foreground font-mono">
                          {ing.netQuantity.toFixed(2)} {ing.displayUnit}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="bg-[#e6f4ec] text-[#1f8f5c] text-[10px] font-bold px-2 py-0.5 rounded border border-[#1f8f5c]/5">
                            {formatCurrency(ing.lastPrice)}/{ing.displayUnit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-foreground font-mono text-xs">
                          {formatCurrency(ing.costPerDish)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button 
                            onClick={() => handleRemoveIngredient(ing.ingredientLineID)}
                            className="text-muted-foreground hover:text-[#b23a3a] p-1.5 rounded-lg hover:bg-muted/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Costing Total Footer */}
            <div className="flex justify-end border-t border-border/30 pt-5 mt-5 pr-4">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground font-bold uppercase">Total cost</div>
                <div className="text-xl font-black text-foreground mt-1 font-mono">{formatCurrency(dish.cost)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {alertConfig && (
        <ConfirmModal
          isOpen={alertConfig !== null}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText="OK"
          onConfirm={() => setAlertConfig(null)}
          onCancel={() => setAlertConfig(null)}
        />
      )}
    </div>
  );
}
