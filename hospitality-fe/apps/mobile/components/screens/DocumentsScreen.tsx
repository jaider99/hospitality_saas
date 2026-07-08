import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Animated,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import {
  Receipt,
  Truck,
  Search,
  SlidersHorizontal,
  Calendar,
  Folder,
  CheckSquare,
  X,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  ExternalLink,
  ChevronRight,
  User as UserIcon,
  Clock,
  Check,
  Plus
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../store/auth';
import { useLayoutStore } from '../../store/layout';
import { sharedStyles as styles } from '../../styles/shared';
import ConfirmAlert from '../ui/ConfirmAlert';

export default function DocumentsScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'completed' | 'flagged' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  
  // API States from Layout Store
  const {
    invoices,
    loadingInvoices: loading,
    refreshingInvoices: refreshing,
    fetchInvoices,
    uploadInvoiceFile,
    deleteInvoice
  } = useLayoutStore();

  // Deletion Confirm Modal
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  // Filter Bottom Sheet State
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempStatusFilter, setTempStatusFilter] = useState<'All' | 'completed' | 'processing' | 'flagged' | 'rejected'>('All');
  const [tempSupplierFilter, setTempSupplierFilter] = useState<string>('All');
  const [tempDateFilter, setTempDateFilter] = useState<string>('All');

  const [statusFilter, setStatusFilter] = useState<'All' | 'completed' | 'processing' | 'flagged' | 'rejected'>('All');
  const [supplierFilter, setSupplierFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');

  // Accordion toggle states in Bottom Sheet
  const [expandedSection, setExpandedSection] = useState<'status' | 'supplier' | 'date' | null>(null);

  // Animation for spinning refresh icon
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Poll for updates if any invoice is processing (extracting OCR)
  useEffect(() => {
    const hasProcessing = invoices.some((inv) => inv.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchInvoices(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [invoices]);

  const handleRefresh = () => {
    fetchInvoices(false);
  };

  const handleDeleteInvoice = async (id: number) => {
    try {
      await deleteInvoice(id);
      setAlertConfig({
        title: 'Success',
        message: 'Document deleted successfully',
        isSuccess: true
      });
    } catch (err) {
      console.error(err);
      setAlertConfig({
        title: 'Error',
        message: 'Could not delete document'
      });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleFileUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const fileAsset = res.assets[0];
      await uploadInvoiceFile(
        fileAsset.uri,
        fileAsset.name || 'invoice.pdf',
        fileAsset.mimeType || 'application/pdf'
      );
    } catch (err) {
      console.error("Upload failed", err);
      setAlertConfig({
        title: 'Upload Failed',
        message: 'An error occurred while uploading the file.'
      });
    }
  };

  // Get list of unique suppliers for filtering list
  const uniqueSuppliers = Array.from(new Set(invoices.map((d) => d.supplier).filter(Boolean)));

  // Calculate dynamic stats
  const statDigitizing = invoices.filter(d => d.status === 'processing').length;
  const statReview = invoices.filter(d => d.status === 'flagged').length;
  const statRejected = invoices.filter(d => d.status === 'rejected').length;

  // Filter logic
  const filteredDocs = invoices.filter(d => {
    // Top tab selection
    if (activeTab !== 'all' && d.status !== activeTab) return false;

    // Applied modal filters
    if (statusFilter !== 'All' && d.status !== statusFilter) return false;
    if (supplierFilter !== 'All' && d.supplier !== supplierFilter) return false;
    
    if (dateFilter !== 'All') {
      if (dateFilter === 'June 2026' && !d.date.includes('/06/')) return false;
      if (dateFilter === 'May 2026' && !d.date.includes('/05/')) return false;
    }

    // Search query matching supplier or document number
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        d.supplier.toLowerCase().includes(query) ||
        d.docNum.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const isFiltersActive = statusFilter !== 'All' || supplierFilter !== 'All' || dateFilter !== 'All';

  // Toggle bottom sheet sub-accordions
  const toggleSection = (section: 'status' | 'supplier' | 'date') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const applyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setSupplierFilter(tempSupplierFilter);
    setDateFilter(tempDateFilter);
    setFilterModalOpen(false);
  };

  const clearFilters = () => {
    setTempStatusFilter('All');
    setTempSupplierFilter('All');
    setTempDateFilter('All');
    setStatusFilter('All');
    setSupplierFilter('All');
    setDateFilter('All');
    setFilterModalOpen(false);
  };

  // Get status color coding based on design.md mapping
  const getPaymentStatusColors = (paymentStatus: string | null) => {
    if (paymentStatus === 'Paid') {
      return { bg: '#e6f4ec', text: '#1f8f5c' }; // success
    } else if (paymentStatus === 'Overdue') {
      return { bg: '#fbf1dd', text: '#b07a1a' }; // warning
    } else {
      return { bg: '#f1f0ec', text: '#8c8c89' }; // default/pending
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafaf8' }}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: 14 }}>
      
      {/* Premium Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Documents</Text>
        <TouchableOpacity 
          onPress={handleFileUpload}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#151515', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Plus size={14} color="#ffffff" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#ffffff', fontFamily: 'Sora' }}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* WhatsApp Digitization Banner (Dismissible) */}
      {showBanner && (
        <View style={{
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#e2e1dd',
          borderRadius: 14,
          padding: 16,
          position: 'relative',
          shadowColor: '#151515',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        }}>
          <TouchableOpacity 
            onPress={() => setShowBanner(false)} 
            style={{ position: 'absolute', top: 12, right: 12, padding: 4 }}
          >
            <X size={16} color="#8c8c89" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 12, paddingRight: 20 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#e6f4ec',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 2
            }}>
              <MessageSquare size={18} color="#1f8f5c" />
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>
                Digitalize expenses via WhatsApp
              </Text>
              <Text style={{ fontSize: 11, color: '#8c8c89', lineHeight: 15, fontFamily: 'Sora' }}>
                Send your invoices and receipts through WhatsApp to digitize them automatically
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Metrics Summary Ribbon */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <TouchableOpacity 
          onPress={() => setActiveTab(activeTab === 'processing' ? 'all' : 'processing')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'processing' ? '#e6f4ec' : '#ffffff',
            borderWidth: 1,
            borderColor: activeTab === 'processing' ? '#1f8f5c' : '#e2e1dd',
            borderRadius: 12,
            padding: 12,
            alignItems: 'center',
            gap: 2
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{statDigitizing}</Text>
          <Text style={{ fontSize: 9, fontWeight: '600', color: '#8c8c89', fontFamily: 'Sora' }}>Processing</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab(activeTab === 'flagged' ? 'all' : 'flagged')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'flagged' ? '#fbf1dd' : '#ffffff',
            borderWidth: 1,
            borderColor: activeTab === 'flagged' ? '#b07a1a' : '#e2e1dd',
            borderRadius: 12,
            padding: 12,
            alignItems: 'center',
            gap: 2
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{statReview}</Text>
          <Text style={{ fontSize: 9, fontWeight: '600', color: '#8c8c89', fontFamily: 'Sora' }}>Needs Review</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab(activeTab === 'rejected' ? 'all' : 'rejected')}
          style={{
            flex: 1,
            backgroundColor: activeTab === 'rejected' ? '#fceaea' : '#ffffff',
            borderWidth: 1,
            borderColor: activeTab === 'rejected' ? '#b23a3a' : '#e2e1dd',
            borderRadius: 12,
            padding: 12,
            alignItems: 'center',
            gap: 2
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{statRejected}</Text>
          <Text style={{ fontSize: 9, fontWeight: '600', color: '#8c8c89', fontFamily: 'Sora' }}>Rejected</Text>
        </TouchableOpacity>
      </View>

      {/* Filter and Search Bar */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#e2e1dd',
          borderRadius: 10,
          paddingHorizontal: 12,
          height: 38
        }}>
          <Search size={16} color="#8c8c89" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search supplier, doc number..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8c8c89"
            style={{ flex: 1, fontSize: 12, color: '#151515', fontFamily: 'Sora', height: '100%', padding: 0 }}
          />
        </View>

        <TouchableOpacity 
          onPress={() => setFilterModalOpen(true)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isFiltersActive ? '#151515' : '#e2e1dd',
            backgroundColor: isFiltersActive ? '#151515' : '#ffffff',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <SlidersHorizontal size={16} color={isFiltersActive ? '#ffffff' : '#151515'} />
        </TouchableOpacity>
      </View>

      {/* Quick Filters Horizontal Scrolling List */}
      <View style={{ height: 32 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {(['all', 'processing', 'completed', 'flagged', 'rejected'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'all' ? 'All' : tab === 'processing' ? 'Digitizing' : tab === 'flagged' ? 'Review Required' : tab === 'completed' ? 'Digitized' : tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: isActive ? '#151515' : '#ffffff',
                  borderWidth: 1,
                  borderColor: isActive ? '#151515' : '#e2e1dd',
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isActive ? '#ffffff' : '#8c8c89',
                  fontFamily: 'Sora'
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Document List Header (Count) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: '#8c8c89', fontFamily: 'Sora', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'} found
        </Text>
        {isFiltersActive && (
          <TouchableOpacity onPress={clearFilters}>
            <Text style={{ fontSize: 11, color: '#b23a3a', fontWeight: '600', fontFamily: 'Sora' }}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Document List Cards */}
      <FlatList
        data={filteredDocs}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => {
          const isInvoice = item.type === 'Invoice';
          const isDelivery = item.type === 'Delivery Note';
          
          let iconBg = '#f1f0ec';
          let iconColor = '#8c8c89';
          let IconComponent = Clock;

          if (isInvoice) {
            iconBg = '#e6f4ec';
            iconColor = '#1f8f5c';
            IconComponent = Receipt;
          } else if (isDelivery) {
            iconBg = '#f5f4f1';
            iconColor = '#151515';
            IconComponent = Truck;
          }

          const badgeStyle = getPaymentStatusColors(item.paymentStatus);

          return (
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/documents/[id]', params: { id: item.id } })}
              style={{
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e1dd',
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                shadowColor: '#151515',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.02,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              {/* Left Side: Icon & Details */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: iconBg,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {item.status === 'processing' ? (
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                      <RefreshCw size={17} color="#8c8c89" />
                    </Animated.View>
                  ) : (
                    <IconComponent size={18} color={iconColor} />
                  )}
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text 
                    numberOfLines={1} 
                    style={{ fontSize: 13, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}
                  >
                    {item.supplier}
                  </Text>
                  
                  <Text style={{ fontSize: 10, color: '#8c8c89', fontFamily: 'DM Mono' }}>
                    {item.docNum} · {item.date}
                  </Text>
                  
                  {/* Category / Type badge */}
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                    <View style={{ backgroundColor: '#f1f0ec', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, fontWeight: '600', color: '#8c8c89', fontFamily: 'Sora' }}>
                        {item.type}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Right Side: Extraction status, total and avatar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {item.status !== 'processing' ? (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>
                      €{Number(item.amount).toFixed(2)}
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <RefreshCw size={10} color="#8c8c89" />
                      </Animated.View>
                      <Text style={{ fontSize: 11, color: '#8c8c89', fontWeight: '500', fontFamily: 'Sora' }}>
                        Extracting...
                      </Text>
                    </View>
                  )}

                  {/* Badges Stack */}
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    {item.status === 'processing' && (
                      <View style={{ backgroundColor: '#f1f0ec', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#8c8c89', fontFamily: 'Sora' }}>Processing</Text>
                      </View>
                    )}
                    {item.status === 'completed' && (
                      <View style={{ backgroundColor: '#e6f4ec', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#1f8f5c', fontFamily: 'Sora' }}>Digitized</Text>
                      </View>
                    )}
                    {item.status === 'flagged' && (
                      <View style={{ backgroundColor: '#fbf1dd', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#b07a1a', fontFamily: 'Sora' }}>Review req.</Text>
                      </View>
                    )}
                    {item.status === 'rejected' && (
                      <View style={{ backgroundColor: '#fceaea', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#b23a3a', fontFamily: 'Sora' }}>Rejected</Text>
                      </View>
                    )}

                    {item.paymentStatus && item.status !== 'processing' && (
                      <View style={{ backgroundColor: badgeStyle.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: badgeStyle.text, fontFamily: 'Sora' }}>
                          {item.paymentStatus}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* More / Action Menu */}
                <TouchableOpacity 
                  onPress={() => setDeleteTargetId(item.id)}
                  style={{ padding: 6 }}
                >
                  <MoreVertical size={16} color="#8c8c89" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center', gap: 12, marginTop: 24 }}>
            <AlertCircle size={32} color="#8c8c89" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora', textAlign: 'center' }}>
              No documents match your filters
            </Text>
            <Text style={{ fontSize: 11, color: '#8c8c89', fontFamily: 'Sora', textAlign: 'center' }}>
              Try searching for something else or clearing filters.
            </Text>
            <TouchableOpacity 
              onPress={clearFilters}
              style={{
                backgroundColor: '#151515',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                marginTop: 6
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', fontFamily: 'Sora' }}>
                Reset Filters
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Filter Bottom Sheet Modal */}
      <Modal visible={filterModalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(21, 21, 21, 0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            maxHeight: '80%'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <X size={20} color="#151515" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16, paddingBottom: 24 }}>
                
                {/* Supplier Filter Accordion */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity 
                    onPress={() => toggleSection('supplier')}
                    style={sheetStyles.itemHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Truck size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Supplier</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {tempSupplierFilter !== 'All' && (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#2f6bb0', fontFamily: 'Sora' }}>{tempSupplierFilter}</Text>
                      )}
                      <ChevronRight size={16} color="#8c8c89" style={{ transform: [{ rotate: expandedSection === 'supplier' ? '90deg' : '0deg' }] }} />
                    </View>
                  </TouchableOpacity>

                  {expandedSection === 'supplier' && (
                    <View style={sheetStyles.expandedContent}>
                      {['All', ...uniqueSuppliers].map((opt) => (
                        <TouchableOpacity 
                          key={opt} 
                          onPress={() => setTempSupplierFilter(opt)}
                          style={sheetStyles.optionRow}
                        >
                          <Text style={{ fontSize: 13, color: tempSupplierFilter === opt ? '#151515' : '#8c8c89', fontWeight: tempSupplierFilter === opt ? '600' : '400', fontFamily: 'Sora' }}>
                            {opt === 'All' ? 'All Suppliers' : opt}
                          </Text>
                          {tempSupplierFilter === opt && <Check size={14} color="#1f8f5c" />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Status Filter Accordion */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity 
                    onPress={() => toggleSection('status')}
                    style={sheetStyles.itemHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <CheckSquare size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Status</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {tempStatusFilter !== 'All' && (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#2f6bb0', fontFamily: 'Sora', textTransform: 'capitalize' }}>{tempStatusFilter}</Text>
                      )}
                      <ChevronRight size={16} color="#8c8c89" style={{ transform: [{ rotate: expandedSection === 'status' ? '90deg' : '0deg' }] }} />
                    </View>
                  </TouchableOpacity>

                  {expandedSection === 'status' && (
                    <View style={sheetStyles.expandedContent}>
                      {(['All', 'processing', 'completed', 'flagged', 'rejected'] as const).map((opt) => (
                        <TouchableOpacity 
                          key={opt} 
                          onPress={() => setTempStatusFilter(opt)}
                          style={sheetStyles.optionRow}
                        >
                          <Text style={{ fontSize: 13, color: tempStatusFilter === opt ? '#151515' : '#8c8c89', fontWeight: tempStatusFilter === opt ? '600' : '400', fontFamily: 'Sora', textTransform: 'capitalize' }}>
                            {opt === 'All' ? 'All Statuses' : opt === 'processing' ? 'Digitizing' : opt === 'flagged' ? 'Review Required' : opt}
                          </Text>
                          {tempStatusFilter === opt && <Check size={14} color="#1f8f5c" />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Date Accordion */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity 
                    onPress={() => toggleSection('date')}
                    style={sheetStyles.itemHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Calendar size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Due Date Range</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {tempDateFilter !== 'All' && (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#2f6bb0', fontFamily: 'Sora' }}>{tempDateFilter}</Text>
                      )}
                      <ChevronRight size={16} color="#8c8c89" style={{ transform: [{ rotate: expandedSection === 'date' ? '90deg' : '0deg' }] }} />
                    </View>
                  </TouchableOpacity>

                  {expandedSection === 'date' && (
                    <View style={sheetStyles.expandedContent}>
                      {['All', 'June 2026', 'May 2026'].map((opt) => (
                        <TouchableOpacity 
                          key={opt} 
                          onPress={() => setTempDateFilter(opt)}
                          style={sheetStyles.optionRow}
                        >
                          <Text style={{ fontSize: 13, color: tempDateFilter === opt ? '#151515' : '#8c8c89', fontWeight: tempDateFilter === opt ? '600' : '400', fontFamily: 'Sora' }}>
                            {opt === 'All' ? 'All Dates' : opt}
                          </Text>
                          {tempDateFilter === opt && <Check size={14} color="#1f8f5c" />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

              </View>
            </ScrollView>

            {/* Bottom Actions Row */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                onPress={clearFilters}
                style={{
                  flex: 1,
                  backgroundColor: '#f5f4f1',
                  borderWidth: 1,
                  borderColor: '#e2e1dd',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#151515', fontSize: 13, fontWeight: '600', fontFamily: 'Sora' }}>
                  Clear
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={applyFilters}
                style={{
                  flex: 1,
                  backgroundColor: '#151515',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600', fontFamily: 'Sora' }}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Alert */}
      <ConfirmAlert
        visible={deleteTargetId !== null}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => deleteTargetId !== null && handleDeleteInvoice(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
        variant="danger"
      />

      {/* Success/Error Alerts */}
      <ConfirmAlert
        visible={alertConfig !== null}
        title={alertConfig?.title || 'Notice'}
        message={alertConfig?.message || ''}
        confirmText="OK"
        onConfirm={() => setAlertConfig(null)}
        variant={alertConfig?.isSuccess ? 'success' : 'danger'}
      />

    </View>
  );
}

const sheetStyles = StyleSheet.create({
  itemContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#edece8',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  itemTitle: {
    fontSize: 14,
    color: '#151515',
    fontWeight: '500',
    fontFamily: 'Sora',
  },
  expandedContent: {
    paddingBottom: 12,
    paddingLeft: 30,
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  }
});
