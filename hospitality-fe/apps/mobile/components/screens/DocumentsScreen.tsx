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
  User,
  Clock,
  Check
} from 'lucide-react-native';
import { documentsList } from '../../constants/mockData';
import { sharedStyles as styles } from '../../styles/shared';

export default function DocumentsScreen() {
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'completed' | 'flagged' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  
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

  // Calculate dynamic stats from mock list
  const statDigitizing = documentsList.filter(d => d.status === 'processing').length;
  const statReview = documentsList.filter(d => d.status === 'flagged').length;
  const statRejected = documentsList.filter(d => d.status === 'rejected').length;

  // Filter logic
  const filteredDocs = documentsList.filter(d => {
    // Top tab selection
    if (activeTab !== 'all' && d.status !== activeTab) return false;

    // Applied modal filters
    if (statusFilter !== 'All' && d.status !== statusFilter) return false;
    if (supplierFilter !== 'All' && !d.supplier.toLowerCase().includes(supplierFilter.toLowerCase())) return false;
    
    if (dateFilter !== 'All') {
      // Mock date logic (last 7 or 30 days matching year 2026 data)
      if (dateFilter === 'June 2026' && !d.date.includes('06/')) return false;
      if (dateFilter === 'May 2026' && !d.date.includes('05/')) return false;
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

  return (
    <View style={{ flex: 1, gap: 14 }}>
      
      {/* Premium Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Documents</Text>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#2f6bb0', fontFamily: 'Sora' }}>Learn more</Text>
          <ExternalLink size={12} color="#2f6bb0" />
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
          {/* Close Button */}
          <TouchableOpacity 
            onPress={() => setShowBanner(false)} 
            style={{ position: 'absolute', top: 12, right: 12, padding: 4 }}
          >
            <X size={16} color="#8c8c89" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 12, paddingRight: 20 }}>
            {/* WhatsApp Green Icon Wrapper */}
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
              
              <TouchableOpacity style={{
                borderWidth: 1,
                borderColor: '#e2e1dd',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                alignSelf: 'flex-start',
                marginTop: 6,
                backgroundColor: '#ffffff'
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#151515', fontFamily: 'Sora' }}>
                  Add phone numbers
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Metrics Summary Ribbon */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {/* Digitizing Card */}
        <TouchableOpacity 
          onPress={() => setActiveTab('processing')}
          style={[styles.card, { flex: 1, padding: 12, gap: 6, backgroundColor: activeTab === 'processing' ? '#f1f1ee' : '#ffffff' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#e6eef8', justifyContent: 'center', alignItems: 'center' }}>
              <Clock size={11} color="#2f6bb0" />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#8c8c89', fontFamily: 'Sora' }}>Digitizing</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{statDigitizing}</Text>
        </TouchableOpacity>

        {/* Review Required Card */}
        <TouchableOpacity 
          onPress={() => setActiveTab('flagged')}
          style={[styles.card, { flex: 1, padding: 12, gap: 6, backgroundColor: activeTab === 'flagged' ? '#f1f1ee' : '#ffffff' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fbf1dd', justifyContent: 'center', alignItems: 'center' }}>
              <AlertTriangle size={10} color="#b07a1a" />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#8c8c89', fontFamily: 'Sora' }}>Review req.</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{statReview}</Text>
        </TouchableOpacity>

        {/* Rejected Card */}
        <TouchableOpacity 
          onPress={() => setActiveTab('rejected')}
          style={[styles.card, { flex: 1, padding: 12, gap: 6, backgroundColor: activeTab === 'rejected' ? '#f1f1ee' : '#ffffff' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fceaea', justifyContent: 'center', alignItems: 'center' }}>
              <AlertCircle size={11} color="#b23a3a" />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#8c8c89', fontFamily: 'Sora' }}>Rejected</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>{statRejected}</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filter Row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#e2e1dd',
          borderRadius: 12,
          paddingHorizontal: 12,
        }}>
          <Search size={15} color="#8c8c89" style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search documents, suppliers..."
            placeholderTextColor="#a8a8a4"
            style={{
              flex: 1,
              paddingVertical: 10,
              fontSize: 13,
              color: '#151515',
              fontFamily: 'Sora',
            }}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={14} color="#8c8c89" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Trigger Button */}
        <TouchableOpacity 
          onPress={() => setFilterModalOpen(true)}
          style={{
            width: 44,
            height: 44,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: isFiltersActive ? '#151515' : '#e2e1dd',
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative'
          }}
        >
          <SlidersHorizontal size={16} color={isFiltersActive ? '#151515' : '#8c8c89'} />
          
          {/* Active Filter Dot Indicator */}
          {isFiltersActive && (
            <View style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#2f6bb0',
              borderWidth: 1.5,
              borderColor: '#fafaf8'
            }} />
          )}
        </TouchableOpacity>
      </View>

      {/* Pill Tab Filtration */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
        >
          {(['all', 'processing', 'completed', 'flagged', 'rejected'] as const).map((tab) => {
            const isActive = activeTab === tab;
            let label = 'All Docs';
            if (tab === 'processing') label = 'Processing';
            if (tab === 'completed') label = 'Completed';
            if (tab === 'flagged') label = 'Flagged';
            if (tab === 'rejected') label = 'Rejected';

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
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
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => {
          // Document styling based on type in design.md mapping
          const isInvoice = item.type === 'Invoice';
          const isDelivery = item.type === 'Delivery Note';
          
          let iconBg = '#f1f0ec';
          let iconColor = '#8c8c89';
          let IconComponent = Clock;

          if (isInvoice) {
            iconBg = '#e6f4ec'; // 10% opacity equivalent / accent-container
            iconColor = '#1f8f5c'; // accent
            IconComponent = Receipt;
          } else if (isDelivery) {
            iconBg = '#f5f4f1'; // surface-container-low
            iconColor = '#151515';
            IconComponent = Truck;
          }

          // Payment badges
          const badgeStyle = getPaymentStatusColors(item.paymentStatus);

          return (
            <View style={{
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
            }}>
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
                  {item.amount != null ? (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#151515', fontFamily: 'DM Mono' }}>
                      €{item.amount.toFixed(2)}
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
                    {/* Status Badges */}
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

                    {/* Payment status badge */}
                    {item.paymentStatus && (
                      <View style={{ backgroundColor: badgeStyle.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: badgeStyle.text, fontFamily: 'Sora' }}>
                          {item.paymentStatus}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Avatar and Menu */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  {item.userInitials ? (
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: item.userInitials === '@' ? '#e6eef8' : '#f1f0ec',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#e2e1dd'
                    }}>
                      <Text style={{ 
                        fontSize: 9, 
                        fontWeight: '700', 
                        color: item.userInitials === '@' ? '#2f6bb0' : '#151515',
                        fontFamily: 'Sora'
                      }}>
                        {item.userInitials}
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity style={{ padding: 4 }}>
                    <MoreVertical size={16} color="#8c8c89" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center', gap: 12, marginTop: 24 }}>
            <AlertCircle size={32} color="#8c8c89" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#151515', fontFamily: 'Sora', textAlign: 'center' }}>
              No documents matches your filters
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
      <Modal
        visible={filterModalOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(21, 21, 21, 0.4)',
          justifyContent: 'flex-end',
        }}>
          {/* Backdrop click handlers to dismiss */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setFilterModalOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          <View style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: 40,
            maxHeight: '85%',
          }}>
            {/* Sheet Handle */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: '#e2e1dd',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16,
            }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#151515', fontFamily: 'Sora' }}>Filter by</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)} style={{ padding: 4 }}>
                <X size={18} color="#151515" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Filter List */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <View style={{ gap: 8 }}>
                
                {/* 1. Document Date */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity 
                    onPress={() => toggleSection('date')}
                    style={sheetStyles.itemHeader}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Calendar size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Document date</Text>
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

                {/* 2. Upload Date */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity style={sheetStyles.itemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Calendar size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Upload date</Text>
                    </View>
                    <ChevronRight size={16} color="#8c8c89" />
                  </TouchableOpacity>
                </View>

                {/* 3. Supplier */}
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
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#2f6bb0', fontFamily: 'Sora', maxWidth: 100 }} numberOfLines={1}>{tempSupplierFilter}</Text>
                      )}
                      <ChevronRight size={16} color="#8c8c89" style={{ transform: [{ rotate: expandedSection === 'supplier' ? '90deg' : '0deg' }] }} />
                    </View>
                  </TouchableOpacity>

                  {expandedSection === 'supplier' && (
                    <View style={sheetStyles.expandedContent}>
                      {['All', 'Re Pla Tres S.L.', 'MAKRO', 'Holaluz', 'La Tienda'].map((opt) => (
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

                {/* 4. Categories */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity style={sheetStyles.itemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Folder size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Categories</Text>
                    </View>
                    <ChevronRight size={16} color="#8c8c89" />
                  </TouchableOpacity>
                </View>

                {/* 5. Status */}
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

                {/* 6. Due date */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity style={sheetStyles.itemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Calendar size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>Due date</Text>
                    </View>
                    <ChevronRight size={16} color="#8c8c89" />
                  </TouchableOpacity>
                </View>

                {/* 7. More filters */}
                <View style={sheetStyles.itemContainer}>
                  <TouchableOpacity style={sheetStyles.itemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <SlidersHorizontal size={18} color="#151515" />
                      <Text style={sheetStyles.itemTitle}>More filters</Text>
                    </View>
                    <ChevronRight size={16} color="#8c8c89" />
                  </TouchableOpacity>
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
                  Delete filters
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
