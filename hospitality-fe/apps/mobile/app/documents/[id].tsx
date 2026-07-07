import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Modal,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Edit3,
  Check,
  X,
  Truck,
  FileText,
  AlertTriangle,
  Trash2,
  ChevronRight,
  TrendingDown,
  Eye,
  Percent
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmAlert from '../../components/ui/ConfirmAlert';

export default function DocumentDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { apiClient } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit Supplier Modal State
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierLegalName, setSupplierLegalName] = useState('');
  const [supplierVatId, setSupplierVatId] = useState('');

  // Edit General Info State
  const [editGeneralOpen, setEditGeneralOpen] = useState(false);
  const [docNum, setDocNum] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docType, setDocType] = useState('Invoice');

  // Edit Totals Info State
  const [editTotalsOpen, setEditTotalsOpen] = useState(false);
  const [baseAmount, setBaseAmount] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [discount, setDiscount] = useState(0);

  // Edit Line Item Modal State
  const [editLineOpen, setEditLineOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any | null>(null);
  const [lineDescription, setLineDescription] = useState('');
  const [lineQuantity, setLineQuantity] = useState('');
  const [lineUnitPrice, setLineUnitPrice] = useState('');

  // Deletion state
  const [lineToDelete, setLineToDelete] = useState<number | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; isSuccess?: boolean } | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getInvoiceDetails(Number(id));
      setInvoice(data);
      if (data) {
        setSupplierName(data.supplier_display_name || data.supplier?.name || '');
        setSupplierLegalName(data.supplier_legal_name || data.supplier?.legal_name || '');
        setSupplierVatId(data.supplier_tax_id || data.supplier?.vat_id || '');
        setDocNum(data.document_number || data.invoice_number || '');
        setDocDate(data.issue_date ? data.issue_date.split('T')[0] : '');
        setDocType(data.document_type || 'Invoice');
        setBaseAmount(data.base_amount || data.total_amount || 0);
        setVatAmount(data.iva_amount || 0);
        setDiscount(data.discount || 0);
      }
    } catch (err: any) {
      console.error(err);
      setError('Could not load document details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const handleSaveSupplier = async () => {
    try {
      await apiClient.updateInvoice(Number(id), {
        supplierName,
        supplier: {
          ...invoice.supplier,
          name: supplierName,
          legal_name: supplierLegalName,
          vat_id: supplierVatId
        }
      });
      setInvoice((prev: any) => ({
        ...prev,
        supplier_display_name: supplierName,
        supplier_legal_name: supplierLegalName,
        supplier_tax_id: supplierVatId,
      }));
      setEditSupplierOpen(false);
      setAlertConfig({ title: 'Success', message: 'Supplier info saved', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to save supplier info' });
    }
  };

  const handleSaveGeneral = async () => {
    try {
      await apiClient.updateInvoice(Number(id), {
        documentNumber: docNum,
        invoiceNumber: docNum,
        date: docDate,
        documentType: docType
      });
      setInvoice((prev: any) => ({
        ...prev,
        document_number: docNum,
        invoice_number: docNum,
        issue_date: docDate,
        document_type: docType
      }));
      setEditGeneralOpen(false);
      setAlertConfig({ title: 'Success', message: 'Document details saved', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to save document details' });
    }
  };

  const handleSaveTotals = async () => {
    const total = Number(baseAmount) + Number(vatAmount) - Number(discount);
    try {
      await apiClient.updateInvoice(Number(id), {
        baseAmount,
        ivaAmount: vatAmount,
        discount,
        totalAmount: total
      });
      setInvoice((prev: any) => ({
        ...prev,
        base_amount: baseAmount,
        iva_amount: vatAmount,
        discount,
        total_amount: total
      }));
      setEditTotalsOpen(false);
      setAlertConfig({ title: 'Success', message: 'Totals updated successfully', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to update totals' });
    }
  };

  const handleOpenEditLine = (line: any) => {
    setSelectedLine(line);
    setLineDescription(line.description || line.raw_item_name || '');
    setLineQuantity(String(line.quantity || 0));
    setLineUnitPrice(String(line.unit_price || 0));
    setEditLineOpen(true);
  };

  const handleSaveLine = async () => {
    if (!selectedLine || !invoice) return;
    const qty = Number(lineQuantity) || 0;
    const price = Number(lineUnitPrice) || 0;
    const updatedLines = invoice.lines.map((l: any) => {
      if (l.id === selectedLine.id) {
        return {
          ...l,
          description: lineDescription,
          quantity: qty,
          unit_price: price,
          total_price: qty * price
        };
      }
      return l;
    });

    try {
      await apiClient.updateInvoice(Number(id), {
        lines: updatedLines
      });
      setInvoice((prev: any) => ({
        ...prev,
        lines: updatedLines
      }));
      setEditLineOpen(false);
      setAlertConfig({ title: 'Success', message: 'Line item updated successfully', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Failed to update line item' });
    }
  };

  const handleDeleteLine = async (lineId: number) => {
    try {
      await apiClient.deleteInvoiceLine(Number(id), lineId);
      setInvoice((prev: any) => ({
        ...prev,
        lines: prev.lines.filter((l: any) => l.id !== lineId)
      }));
      setAlertConfig({ title: 'Success', message: 'Line item deleted', isSuccess: true });
    } catch (err) {
      console.error(err);
      setAlertConfig({ title: 'Error', message: 'Could not delete line item' });
    } finally {
      setLineToDelete(null);
    }
  };

  const handleMarkAsDigitized = async () => {
    if (!invoice) return;
    try {
      setInvoice((prev: any) => ({
        ...prev,
        needs_review: false,
        status: 'PROCESSED'
      }));
      await apiClient.updateInvoice(Number(id), {
        needs_review: false,
        status: 'PROCESSED'
      });
      setAlertConfig({ title: 'Success', message: 'Document marked as digitized successfully', isSuccess: true });
    } catch (e) {
      console.error(e);
      fetchDetails();
      setAlertConfig({ title: 'Error', message: 'Failed to update status.' });
    }
  };

  const handleViewDocument = () => {
    if (!invoice) return;
    const fileUrl = invoice.file_url || '';
    if (fileUrl) {
      Linking.openURL(fileUrl).catch((err) => {
        console.error("Failed to open URL:", err);
        setAlertConfig({ title: 'Error', message: 'Could not open document URL.' });
      });
    } else {
      setAlertConfig({ title: 'Notice', message: 'No document preview URL is available.' });
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1f8f5c" />
      </View>
    );
  }

  if (error || !invoice) {
    return (
      <View style={styles.centerContainer}>
        <AlertTriangle size={48} color="#b23a3a" />
        <Text style={styles.errorText}>{error || 'Document details not found'}</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  // Parse review reasons
  let reviewReasons: string[] = [];
  try {
    if (invoice.review_reasons) {
      reviewReasons = JSON.parse(invoice.review_reasons);
    }
  } catch (e) {
    if (invoice.review_reasons) {
      reviewReasons = [invoice.review_reasons];
    }
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#151515" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {invoice.supplier_display_name || 'Document Details'}
        </Text>
        {invoice.file_url && (
          <TouchableOpacity onPress={handleViewDocument} style={styles.previewBtn}>
            <Eye size={16} color="#ffffff" />
            <Text style={styles.previewBtnText}>Preview</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Duplicate Alert Banner */}
        {invoice.is_duplicate && (
          <View style={styles.duplicateBanner}>
            <AlertTriangle size={18} color="#b23a3a" style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitleRed}>Duplicate Detected</Text>
              <Text style={styles.bannerDescRed}>
                This document matches another invoice with the same document number from this supplier.
              </Text>
            </View>
          </View>
        )}

        {/* Needs Review Alert Banner */}
        {invoice.needs_review && (
          <View style={styles.reviewBanner}>
            <AlertTriangle size={18} color="#b07a1a" style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.bannerTitleGold}>Extraction Review Needed</Text>
              {reviewReasons.length > 0 ? (
                <View style={{ gap: 2 }}>
                  {reviewReasons.map((reason, idx) => (
                    <Text key={idx} style={styles.bannerDescGold}>• {reason}</Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.bannerDescGold}>
                  Gemini flagged this document because some fields require human validation.
                </Text>
              )}
              <TouchableOpacity onPress={handleMarkAsDigitized} style={styles.digitizeActionBtn}>
                <Text style={styles.digitizeActionBtnText}>Mark as Digitized</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Basic Metadata Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="#151515" />
              <Text style={styles.cardTitle}>Document Details</Text>
            </View>
            <TouchableOpacity onPress={() => setEditGeneralOpen(true)} style={styles.editIconBtn}>
              <Edit3 size={15} color="#8c8c89" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Document No.</Text>
            <Text style={styles.infoValue}>{invoice.document_number || invoice.invoice_number || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Issue Date</Text>
            <Text style={styles.infoValue}>
              {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-US') : '—'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{invoice.document_type || 'Invoice'}</Text>
          </View>
          {invoice.ocr_confidence !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>OCR Confidence</Text>
              <Text style={[styles.infoValue, { color: invoice.ocr_confidence >= 0.8 ? '#1f8f5c' : '#b07a1a' }]}>
                {(invoice.ocr_confidence * 100).toFixed(0)}%
              </Text>
            </View>
          )}
        </View>

        {/* Supplier Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Truck size={18} color="#151515" />
              <Text style={styles.cardTitle}>Supplier Info</Text>
            </View>
            <TouchableOpacity onPress={() => setEditSupplierOpen(true)} style={styles.editIconBtn}>
              <Edit3 size={15} color="#8c8c89" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Supplier Name</Text>
            <Text style={styles.infoValue}>{invoice.supplier_display_name || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Legal Name</Text>
            <Text style={styles.infoValue}>{invoice.supplier_legal_name || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>VAT / Tax ID</Text>
            <Text style={styles.infoValue}>{invoice.supplier_tax_id || '—'}</Text>
          </View>
        </View>

        {/* Extracted Products List */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Extracted Products ({invoice.lines?.length || 0})</Text>
          {invoice.lines && invoice.lines.length > 0 ? (
            invoice.lines.map((line: any, idx: number) => (
              <TouchableOpacity key={line.id || idx} onPress={() => handleOpenEditLine(line)} style={styles.lineItem}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.lineItemName}>{line.description || line.raw_item_name}</Text>
                  <Text style={styles.lineItemSub}>
                    Qty: {line.quantity} · Price: €{Number(line.unit_price).toFixed(2)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', gap: 6, flexDirection: 'row' }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.lineItemPrice}>€{Number(line.total_price).toFixed(2)}</Text>
                    <Text style={{ fontSize: 9, color: '#8c8c89', fontFamily: 'Sora' }}>Tap to Edit</Text>
                  </View>
                  <TouchableOpacity onPress={() => setLineToDelete(line.id)} style={{ padding: 6 }}>
                    <Trash2 size={14} color="#b23a3a" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noLinesText}>No line items extracted from this document.</Text>
          )}
        </View>

        {/* Tax Breakdown */}
        {invoice.tax_brackets && invoice.tax_brackets.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Percent size={17} color="#151515" />
                <Text style={styles.cardTitle}>Tax Breakdown</Text>
              </View>
            </View>
            {invoice.tax_brackets.map((tax: any, idx: number) => (
              <View key={tax.id || idx} style={styles.taxRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.taxRateText}>{tax.rate_pct}% VAT Rate</Text>
                  <Text style={styles.taxBaseText}>Base: €{Number(tax.base).toFixed(2)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={styles.taxIvaText}>VAT Amt: €{Number(tax.iva_amount).toFixed(2)}</Text>
                  <Text style={styles.taxTotalText}>Total: €{Number(tax.row_total).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Totals Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Totals Summary</Text>
            <TouchableOpacity onPress={() => setEditTotalsOpen(true)} style={styles.editIconBtn}>
              <Edit3 size={15} color="#8c8c89" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Base Amount</Text>
            <Text style={styles.infoValue}>€{Number(invoice.base_amount || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>VAT Amount</Text>
            <Text style={styles.infoValue}>€{Number(invoice.iva_amount || 0).toFixed(2)}</Text>
          </View>
          {invoice.discount > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Discount</Text>
              <Text style={[styles.infoValue, { color: '#b23a3a' }]}>-€{Number(invoice.discount).toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#edece8', paddingTop: 10, marginTop: 6 }]}>
            <Text style={[styles.infoLabel, { fontWeight: '700', color: '#151515' }]}>Grand Total</Text>
            <Text style={[styles.infoValue, { fontWeight: '700', color: '#1f8f5c', fontSize: 16 }]}>
              €{Number(invoice.total_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Edit Supplier Modal */}
      <Modal visible={editSupplierOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Edit Supplier Info</Text>
            <TouchableOpacity onPress={() => setEditSupplierOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Supplier Name" value={supplierName} onChangeText={setSupplierName} />
            <Input label="Legal Name" value={supplierLegalName} onChangeText={setSupplierLegalName} />
            <Input label="VAT / Tax ID" value={supplierVatId} onChangeText={setSupplierVatId} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setEditSupplierOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save" onPress={handleSaveSupplier} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit General Info Modal */}
      <Modal visible={editGeneralOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Edit Document Details</Text>
            <TouchableOpacity onPress={() => setEditGeneralOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Document No." value={docNum} onChangeText={setDocNum} />
            <Input label="Issue Date (YYYY-MM-DD)" value={docDate} onChangeText={setDocDate} />
            <Input label="Document Type" value={docType} onChangeText={setDocType} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setEditGeneralOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save" onPress={handleSaveGeneral} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Totals Modal */}
      <Modal visible={editTotalsOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Edit Totals Summary</Text>
            <TouchableOpacity onPress={() => setEditTotalsOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Base Amount" value={String(baseAmount)} onChangeText={(val: string) => setBaseAmount(Number(val) || 0)} keyboardType="decimal-pad" />
            <Input label="VAT Amount" value={String(vatAmount)} onChangeText={(val: string) => setVatAmount(Number(val) || 0)} keyboardType="decimal-pad" />
            <Input label="Discount" value={String(discount)} onChangeText={(val: string) => setDiscount(Number(val) || 0)} keyboardType="decimal-pad" />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setEditTotalsOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save" onPress={handleSaveTotals} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Line Item Modal */}
      <Modal visible={editLineOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Edit Line Item</Text>
            <TouchableOpacity onPress={() => setEditLineOpen(false)}>
              <X size={20} color="#151515" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Input label="Description / Raw Item Name" value={lineDescription} onChangeText={setLineDescription} />
            <Input label="Quantity" value={lineQuantity} onChangeText={setLineQuantity} keyboardType="decimal-pad" />
            <Input label="Unit Price (€)" value={lineUnitPrice} onChangeText={setLineUnitPrice} keyboardType="decimal-pad" />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setEditLineOpen(false)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Save" onPress={handleSaveLine} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Confirm Deletion Alert */}
      <ConfirmAlert
        visible={lineToDelete !== null}
        title="Delete Item"
        message="Are you sure you want to delete this line item?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => lineToDelete !== null && handleDeleteLine(lineToDelete)}
        onCancel={() => setLineToDelete(null)}
        variant="danger"
      />

      {/* Alerts popup */}
      <ConfirmAlert
        visible={alertConfig !== null}
        title={alertConfig?.title || ''}
        message={alertConfig?.message || ''}
        confirmText="OK"
        onConfirm={() => setAlertConfig(null)}
        variant={alertConfig?.isSuccess ? 'success' : 'danger'}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
    paddingTop: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fafaf8',
  },
  errorText: {
    fontSize: 14,
    color: '#8c8c89',
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: 'Sora',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e1dd',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
    flex: 1,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  previewBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Sora',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 80,
  },
  duplicateBanner: {
    backgroundColor: '#fceaea',
    borderWidth: 1,
    borderColor: '#ffb4ab',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
  },
  bannerTitleRed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7a2828',
    fontFamily: 'Sora',
    marginBottom: 2,
  },
  bannerDescRed: {
    fontSize: 11,
    color: '#7a2828',
    opacity: 0.9,
    fontFamily: 'Sora',
    lineHeight: 15,
  },
  reviewBanner: {
    backgroundColor: '#fbf1dd',
    borderWidth: 1,
    borderColor: '#f0d9a6',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
  },
  bannerTitleGold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7a5b1a',
    fontFamily: 'Sora',
    marginBottom: 4,
  },
  bannerDescGold: {
    fontSize: 11,
    color: '#7a5b1a',
    opacity: 0.95,
    fontFamily: 'Sora',
    lineHeight: 15,
  },
  digitizeActionBtn: {
    backgroundColor: '#b07a1a',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  digitizeActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Sora',
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e1dd',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  editIconBtn: {
    padding: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
    alignItems: 'center',
  },
  lineItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'Sora',
  },
  lineItemSub: {
    fontSize: 10,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  lineItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'DM Mono',
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
    alignItems: 'center',
  },
  taxRateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  taxBaseText: {
    fontSize: 10,
    color: '#8c8c89',
    fontFamily: 'Sora',
  },
  taxIvaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#151515',
    fontFamily: 'DM Mono',
  },
  taxTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f8f5c',
    fontFamily: 'DM Mono',
  },
  noLinesText: {
    fontSize: 11,
    color: '#8c8c89',
    fontFamily: 'Sora',
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fafaf8',
    paddingTop: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e1dd',
    backgroundColor: '#ffffff',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151515',
    fontFamily: 'Sora',
  },
  modalBody: {
    padding: 20,
    gap: 12,
  },
});
