'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Download,
  FileText,
  Layers,
  Utensils,
  Image as ImageIcon,
  ChevronRight,
  AlertCircle,
  X,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { Badge, Btn } from '../_components/ui';
import ConfirmModal from '../suppliers/_components/ConfirmModal';

// Interfaces matching backend Haddock-compatible schema
interface DishTag {
  id: string;
  name: string;
}

interface DishResponse {
  id: string;
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
  tag?: DishTag;
}

export default function RecipesListPage() {
  const router = useRouter();
  const apiClient = useAuthStore((state) => state.apiClient);

  const [activeTab, setActiveTab] = useState<'dishes' | 'preparations' | 'menus'>('dishes');
  const [dishes, setDishes] = useState<DishResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPOSWarning, setShowPOSWarning] = useState(true);

  // Modal states for creating new Recipe/Dish
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishBase, setNewDishBase] = useState('0.00');
  const [newDishTax, setNewDishTax] = useState('0.00');
  const [newDishIsPrep, setNewDishIsPrep] = useState(false);
  const [newDishUOM, setNewDishUOM] = useState('ud');
  const [newDishTagName, setNewDishTagName] = useState('');
  const [newDishTargetCost, setNewDishTargetCost] = useState('30.0');

  // Manage Types modal states
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [recipeTags, setRecipeTags] = useState<any[]>([]);
  const [newDishTypeInput, setNewDishTypeInput] = useState('');
  const [newPrepTypeInput, setNewPrepTypeInput] = useState('');

  // Confirmation states for tag deletion
  const [tagToDelete, setTagToDelete] = useState<any | null>(null);
  const [tagDeleteError, setTagDeleteError] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string } | null>(null);

  // Filter by Type States
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);


  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await apiClient.generateFromFile(file);
      await fetchDishes();
      setAlertConfig({ title: 'Success', message: 'Recipes successfully parsed and imported from Haddock PDF file!' });
    } catch (err) {
      console.error('Error generating recipes from file:', err);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to parse and import recipes from PDF. Make sure it is a valid Haddock PDF recipe export.'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDishes = async () => {
    setLoading(true);
    try {
      // preparations parameter: activeTab === 'preparations'
      const data = await apiClient.getDishes({
        preparations: activeTab === 'preparations'
      });
      setDishes(data);
    } catch (err) {
      console.error('Error fetching recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const tags = await apiClient.getRecipeTags();
      setRecipeTags(tags);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  useEffect(() => {
    setSelectedTagFilter('');
    if (activeTab !== 'menus') {
      fetchDishes();
    } else {
      setDishes([]);
      setLoading(false);
    }
  }, [activeTab, apiClient]);

  useEffect(() => {
    fetchTags();
  }, [apiClient]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseNum = parseFloat(newDishBase) || 0;
      const taxNum = parseFloat(newDishTax) || 0;
      const payload = {
        name: newDishName,
        isPreparation: newDishIsPrep,
        unitOfMeasure: newDishUOM,
        tagName: newDishTagName || undefined,
        base: baseNum,
        tax: taxNum,
        salePrice: baseNum + taxNum,
        targetCostPercentage: parseFloat(newDishTargetCost) || 30.0
      };

      const newRecipe = await apiClient.createRecipe(payload);

      // Reset form
      setNewDishName('');
      setNewDishBase('0.00');
      setNewDishTax('0.00');
      setNewDishIsPrep(false);
      setNewDishUOM('ud');
      setNewDishTagName('');
      setNewDishTargetCost('30.0');
      setIsCreateModalOpen(false);

      router.push(`/dashboard/recipes/${newRecipe.id}`);
    } catch (err) {
      console.error('Error creating dish:', err);
      setAlertConfig({ title: 'Error', message: 'Failed to create dish/preparation.' });
    }
  };

  // Filter recipes based on search query and tag filter
  const filteredDishes = dishes.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTagFilter || (d.tag?.name === selectedTagFilter);
    return matchesSearch && matchesTag;
  });

  // Group recipes by tag name (category)
  const groupedDishes = filteredDishes.reduce<Record<string, DishResponse[]>>((acc, dish) => {
    const key = dish.tag?.name || 'UNGROUPED';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(dish);
    return acc;
  }, {});

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const formatPercentage = (val: number) => {
    return `${Math.round(val * 100)}%`;
  };

  return (
    <div className="flex-1 bg-[#f8f9fa] min-h-screen p-6 md:p-8 font-sans">
      {/* Title Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bill of materials</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and audit recipes, preparations, and costing margins.
          </p>
        </div>
      </div>

      {/* Tabs matching Haddock UI */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-lg p-1 shadow-sm max-w-fit">
        <button
          onClick={() => setActiveTab('dishes')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'dishes'
              ? 'bg-[#151515] text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Utensils size={16} />
          Recipes and drinks
        </button>
        <button
          onClick={() => setActiveTab('preparations')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'preparations'
              ? 'bg-[#151515] text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Layers size={16} />
          Preparations
        </button>
        {/* TODO: Implement Menus cost modeling tab
        <button
          onClick={() => setActiveTab('menus')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'menus'
              ? 'bg-[#151515] text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} />
          Menus
        </button>
        */}
      </div>

      {/* Yellow warning banner */}
      {showPOSWarning && (
        <div className="bg-[#fff9e6] border border-[#ffe699] text-[#735a00] rounded-xl p-4 mb-6 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-[#d9a300] flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">No POS system connected</p>
              <p className="text-xs text-gray-600 mt-0.5">
                To link recipes to sales articles, first connect your POS system to load the article
                catalog.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors">
              Connect POS
            </button>
            <button
              onClick={() => setShowPOSWarning(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by dish name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f8f5c] transition-all"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* All Checkbox */}
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer mr-2">
            <input
              type="checkbox"
              checked={!selectedTagFilter}
              onChange={() => setSelectedTagFilter('')}
              className="rounded border-border text-primary focus:ring-primary cursor-pointer w-4 h-4"
            />
            All
          </label>

          {/* Filter by Type Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button 
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-1.5 bg-white hover:bg-muted/10 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[10px] shadow-sm transition-colors cursor-pointer"
            >
              {selectedTagFilter ? `Type: ${selectedTagFilter}` : 'Filter by type'}
              <ChevronDown size={15} className="text-muted-foreground" />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-border rounded-[10px] shadow-2xl z-40 p-3 text-left">
                <input
                  type="text"
                  placeholder="Search"
                  value={filterSearchQuery}
                  onChange={(e) => setFilterSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#fafaf8] border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary mb-2 text-foreground font-semibold placeholder:text-muted-foreground"
                />
                
                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                  {activeTab === 'preparations' ? 'Select a preparation type' : 'Select a dish type'}
                </h5>
                
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {recipeTags
                    .filter(t => t.isPreparation === (activeTab === 'preparations'))
                    .filter(t => t.name.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                    .map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagFilter(t.name);
                          setIsFilterDropdownOpen(false);
                          setFilterSearchQuery('');
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-[10px] transition-colors cursor-pointer capitalize ${
                          selectedTagFilter === t.name 
                            ? 'bg-primary text-white' 
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))
                  }
                  {recipeTags.filter(t => t.isPreparation === (activeTab === 'preparations')).length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic p-2">No categories defined.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* TODO: Implement recipe export download functionality
          <button className="flex items-center gap-1.5 bg-white hover:bg-muted/10 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[10px] shadow-sm transition-colors cursor-pointer">
            <Download size={15} className="text-muted-foreground" />
            Download
          </button>
          */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
            className="hidden"
          />
          <button
            onClick={() => setIsManageTypesOpen(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-muted/10 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[10px] shadow-sm transition-colors cursor-pointer"
          >
            Manage types
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-white hover:bg-muted/10 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[10px] shadow-sm transition-colors"
          >
            Generate from file
          </button>

          <Btn
            onClick={() => setIsCreateModalOpen(true)}
            variant="primary"
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            New bill of materials
          </Btn>
        </div>
      </div>

      {/* Main List Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-border rounded-[10px] shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground text-sm font-medium">
            Loading recipe costing database...
          </p>
        </div>
      ) : activeTab === 'menus' ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-border rounded-[10px] shadow-sm">
          <Utensils size={40} className="text-muted/40 mb-3" />
          <p className="text-foreground font-bold">Menus cost modeling coming soon</p>
          <p className="text-muted-foreground text-xs mt-1">
            Directly build and model set menus from your dish configurations.
          </p>
        </div>
      ) : Object.keys(groupedDishes).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-border rounded-[10px] shadow-sm">
          <FileText size={40} className="text-muted/40 mb-3" />
          <p className="text-foreground font-bold">No recipes found</p>
          <p className="text-muted-foreground text-xs mt-1">
            Create a new bill of materials manually or synchronize with POS.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedDishes).map(([tagGroup, groupDishes]) => (
            <div key={tagGroup} className="space-y-3">
              {/* Group Heading */}
              <h3 className="text-xs font-extrabold text-accent uppercase tracking-widest pl-1">
                {tagGroup}
              </h3>

              {/* Cards Grid */}
              <div className="space-y-3">
                {groupDishes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => router.push(`/dashboard/recipes/${r.id}`)}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white hover:bg-muted/10 border border-border rounded-[10px] p-4 shadow-sm cursor-pointer transition-all duration-150 group"
                  >
                    {/* Left details */}
                    <div className="flex items-center gap-4">
                      {/* Checkbox (decorative matching Haddock) */}
                      <input
                        type="checkbox"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer hidden md:block"
                      />

                      {/* Thumbnail Image placeholder */}
                      <div className="w-14 h-14 bg-background rounded-[10px] flex items-center justify-center text-muted-foreground group-hover:bg-muted transition-colors border border-border">
                        <ImageIcon size={22} />
                      </div>

                      {/* Name & details */}
                      <div>
                        <h4 className="text-base font-bold text-foreground group-hover:text-accent transition-colors capitalize">
                          {r.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-medium">
                            UoM: {r.unitOfMeasure}
                          </span>
                          {r.tag?.name && (
                            <span className="text-xs text-muted-foreground font-medium capitalize">
                              · {r.isPreparation ? 'Preparation type' : 'Dish type'}: {r.tag.name}
                            </span>
                          )}
                          {r.hasErrors && <Badge variant="error">Critical Margin Alert</Badge>}
                        </div>
                      </div>
                    </div>

                    {/* Right costings columns matching Haddock UI */}
                    <div className="grid grid-cols-5 gap-6 md:gap-12 mt-4 md:mt-0 w-full md:w-auto text-right font-mono">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">NRP</div>
                        <div className="text-sm font-bold text-gray-900 mt-1">
                          {formatCurrency(r.price)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">GRP</div>
                        <div className="text-sm font-bold text-gray-900 mt-1">
                          {formatCurrency(r.base)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">
                          Cost
                        </div>
                        <div className="text-sm font-bold text-[#b23a3a] mt-1">
                          {formatCurrency(r.cost)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">
                          Profit
                        </div>
                        <div className="text-sm font-bold text-gray-900 mt-1">
                          {formatCurrency(r.profit)}
                        </div>
                      </div>
                      <div className="pr-4">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">
                          Margin
                        </div>
                        <div
                          className={`text-sm font-black mt-1 ${r.hasErrors ? 'text-[#b23a3a]' : 'text-[#1f8f5c]'}`}
                        >
                          {formatPercentage(r.margin)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over/Modal Dialog for Creating Dish */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCreateModalOpen(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-2xl transition-all border border-gray-100">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">Create new bill of materials</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-50"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateDish} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Dish Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cerveza Motor Oil"
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Base Price (Pre-tax GRP)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newDishBase}
                      onChange={(e) => setNewDishBase(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Tax Amount (VAT)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newDishTax}
                      onChange={(e) => setNewDishTax(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Unit of Measure
                    </label>
                    <select
                      value={newDishUOM}
                      onChange={(e) => setNewDishUOM(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="ud">ud (units)</option>
                      <option value="kg">kg (kilograms)</option>
                      <option value="l">l (liters)</option>
                      <option value="ml">ml (milliliters)</option>
                      <option value="g">g (grams)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      {newDishIsPrep ? 'Preparation type' : 'Dish type'}
                    </label>
                    <select
                      value={newDishTagName}
                      onChange={(e) => setNewDishTagName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select type...</option>
                      {recipeTags
                        .filter((t) => t.isPreparation === newDishIsPrep)
                        .map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Target Cost %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={newDishTargetCost}
                      onChange={(e) => setNewDishTargetCost(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center h-full pt-6">
                    <label className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDishIsPrep}
                        onChange={(e) => setNewDishIsPrep(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      Is Preparation?
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border/30 pt-4 mt-6">
                  <Btn onClick={() => setIsCreateModalOpen(false)} variant="secondary" size="md">
                    Cancel
                  </Btn>
                  <Btn variant="primary" size="md">
                    Create
                  </Btn>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage Types Modal */}
      {isManageTypesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[10px] border border-border shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-foreground">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border/30">
              <h3 className="text-lg font-black">Manage types</h3>
              <button
                onClick={() => setIsManageTypesOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto">
              {/* Left Column: Dish types */}
              <div className="space-y-4 pr-0 md:pr-4 border-r-0 md:border-r border-border/30">
                <div>
                  <h4 className="text-sm font-bold mb-2">Add dish type</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Dish type"
                      value={newDishTypeInput}
                      onChange={(e) => setNewDishTypeInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-sm bg-[#fafaf8] border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary font-semibold placeholder:text-muted-foreground text-foreground"
                    />
                    <button
                      onClick={async () => {
                        if (!newDishTypeInput.trim()) return;
                        try {
                          await apiClient.createRecipeTag(newDishTypeInput, false);
                          setNewDishTypeInput('');
                          fetchTags();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-[10px] transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Types of existing dishes
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recipeTags
                      .filter((t) => !t.isPreparation)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center bg-[#fafaf8] border border-border/50 rounded-[10px] px-3.5 py-2 text-sm font-bold text-foreground"
                        >
                          <span>{t.name}</span>
                          <button
                            onClick={() => setTagToDelete(t)}
                            className="text-[#b23a3a] hover:bg-[#b23a3a]/10 p-1 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Prep types */}
              <div className="space-y-4 pl-0 md:pl-4">
                <div>
                  <h4 className="text-sm font-bold mb-2">Add preparation type</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Preparation type"
                      value={newPrepTypeInput}
                      onChange={(e) => setNewPrepTypeInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-sm bg-[#fafaf8] border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary font-semibold placeholder:text-muted-foreground text-foreground"
                    />
                    <button
                      onClick={async () => {
                        if (!newPrepTypeInput.trim()) return;
                        try {
                          await apiClient.createRecipeTag(newPrepTypeInput, true);
                          setNewPrepTypeInput('');
                          fetchTags();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-[10px] transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Types of existing preparations
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recipeTags
                      .filter((t) => t.isPreparation)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center bg-[#fafaf8] border border-border/50 rounded-[10px] px-3.5 py-2 text-sm font-bold text-foreground"
                        >
                          <span>{t.name}</span>
                          <button
                            onClick={() => setTagToDelete(t)}
                            className="text-[#b23a3a] hover:bg-[#b23a3a]/10 p-1 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-border/30 bg-[#fafaf8]">
              <button
                onClick={() => setIsManageTypesOpen(false)}
                className="px-5 py-2 text-xs font-bold text-foreground bg-white hover:bg-muted border border-border rounded-[10px] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deletion confirmation and error alerts */}
      <ConfirmModal
        isOpen={tagToDelete !== null}
        title="Delete Category"
        message={`Are you sure you want to permanently delete the category "${tagToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          if (!tagToDelete) return;
          try {
            await apiClient.deleteRecipeTag(tagToDelete.id);
            fetchTags();
          } catch (err: any) {
            console.error(err);
            setTagDeleteError(err.response?.data?.detail || 'Failed to delete category.');
          } finally {
            setTagToDelete(null);
          }
        }}
        onCancel={() => setTagToDelete(null)}
      />

      <ConfirmModal
        isOpen={tagDeleteError !== null}
        title="Delete Category Blocked"
        message={tagDeleteError || ''}
        confirmText="OK"
        onConfirm={() => setTagDeleteError(null)}
        onCancel={() => setTagDeleteError(null)}
      />

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
