'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Phone, Briefcase, Clock, FileText, X, Upload } from 'lucide-react';
import { getApiClient } from '../../../../store/auth';
import { PayrollTable } from '../../../../components/StaffCosts/PayrollTable';

export default function EmployeeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = Number(params.employeeId);
  const propertyId = 1;

  const [employee, setEmployee] = useState<any>(null);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Employee State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editEmployeeData, setEditEmployeeData] = useState<any>({});

  // Add Payroll State
  const [isAddPayrollModalOpen, setIsAddPayrollModalOpen] = useState(false);
  const [newPayrollData, setNewPayrollData] = useState({
    period: '',
    company_cost: '',
    net_amount: '',
    notes: ''
  });
  const [payrollFile, setPayrollFile] = useState<File | null>(null);

  // Edit Payroll State
  const [isEditPayrollModalOpen, setIsEditPayrollModalOpen] = useState(false);
  const [editPayrollData, setEditPayrollData] = useState<any>({});

  useEffect(() => {
    if (employeeId) {
      fetchPositions();
      fetchEmployeeData();
      fetchPayrolls();
    }
  }, [employeeId]);

  const fetchPositions = async () => {
    try {
      const client = getApiClient();
      const data = await client.getStaffPositions(propertyId);
      setPositions(data);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const client = getApiClient();
      const emps = await client.getStaffEmployees(propertyId);
      const emp = emps.find(e => e.id === employeeId);
      setEmployee(emp || null);
    } catch (error) {
      console.error('Failed to fetch employee:', error);
    }
  };

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      // We made period optional in the backend, so we can fetch all and filter by employee
      const allPayrolls = await client.getMonthlyPayrolls(propertyId);
      const employeePayrolls = allPayrolls.filter(p => p.employee_id === employeeId);
      setPayrolls(employeePayrolls);
    } catch (error) {
      console.error('Failed to fetch payrolls:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = () => {
    setEditEmployeeData({
      name: employee?.name || '',
      email: employee?.email || '',
      position_id: employee?.position_id || null,
      government_id: employee?.government_id || '',
      weekly_hours: employee?.weekly_hours?.toString() || '',
      phone: employee?.phone || '',
      notes: employee?.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditEmployee = async () => {
    try {
      const client = getApiClient();
      await client.updateStaffEmployee(propertyId, employeeId, {
        ...editEmployeeData,
        weekly_hours: editEmployeeData.weekly_hours ? parseFloat(editEmployeeData.weekly_hours) : undefined
      });
      setIsEditModalOpen(false);
      fetchEmployeeData();
    } catch (error) {
      console.error('Failed to update employee:', error);
    }
  };

  const handleAddPayroll = async () => {
    try {
      const client = getApiClient();
      const formData = new FormData();
      formData.append('period', newPayrollData.period);
      formData.append('configuration', 'company_cost');
      formData.append('company_cost', newPayrollData.company_cost);
      if (newPayrollData.net_amount) formData.append('net_amount', newPayrollData.net_amount);
      if (newPayrollData.notes) formData.append('notes', newPayrollData.notes);
      formData.append('employee_id', employeeId.toString());
      if (payrollFile) {
        formData.append('file', payrollFile);
      }
      
      await client.createMonthlyPayroll(propertyId, formData);
      setIsAddPayrollModalOpen(false);
      setNewPayrollData({ period: '', company_cost: '', net_amount: '', notes: '' });
      setPayrollFile(null);
      fetchPayrolls();
    } catch (error) {
      console.error('Failed to add payroll:', error);
    }
  };

  const openEditPayrollModal = (record: any) => {
    setEditPayrollData({
      id: record.id,
      period: record.period,
      company_cost: record.company_cost?.toString() || '',
      net_amount: record.net_amount?.toString() || '',
      notes: record.notes || ''
    });
    setIsEditPayrollModalOpen(true);
  };

  const handleEditPayroll = async () => {
    try {
      const client = getApiClient();
      await client.updateMonthlyPayroll(propertyId, editPayrollData.id, {
        period: editPayrollData.period,
        company_cost: parseFloat(editPayrollData.company_cost),
        net_amount: editPayrollData.net_amount ? parseFloat(editPayrollData.net_amount) : undefined,
        notes: editPayrollData.notes
      });
      setIsEditPayrollModalOpen(false);
      fetchPayrolls();
    } catch (error) {
      console.error('Failed to update payroll:', error);
    }
  };

  const handleDeletePayroll = async (record: any) => {
    if (window.confirm(`Are you sure you want to delete the payroll for ${record.period}?`)) {
      try {
        const client = getApiClient();
        await client.deleteMonthlyPayroll(propertyId, record.id);
        fetchPayrolls();
      } catch (error) {
        console.error('Failed to delete payroll:', error);
      }
    }
  };

  if (!employee && !loading) {
    return <div className="p-8 text-center text-muted-foreground">Employee not found.</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-background min-h-screen">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        
        {/* Navigation Breadcrumb */}
        <button 
          onClick={() => router.push('/dashboard/staff-costs')}
          className="flex items-center text-muted-foreground hover:text-primary mb-6 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to employees
        </button>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Header / Info Box */}
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-2xl font-bold">
                  {employee?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{employee?.name}</h1>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-muted text-muted-foreground">
                    {employee?.position?.name || 'Waiter/Waitress'}
                  </span>
                </div>
              </div>
              <button 
                className="px-4 py-2 border border-border text-foreground rounded-md font-medium text-sm hover:bg-muted transition-colors"
                onClick={openEditModal}
              >
                Edit info
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex items-start gap-3">
                <Mail className="text-muted-foreground mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium text-foreground">{employee?.email || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex items-start gap-3">
                <Phone className="text-muted-foreground mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone number</p>
                  <p className="text-sm font-medium text-foreground">{employee?.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex items-start gap-3">
                <FileText className="text-muted-foreground mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ID / Passport</p>
                  <p className="text-sm font-medium text-foreground">{employee?.government_id || 'N/A'}</p>
                </div>
              </div>
              <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex items-start gap-3">
                <Clock className="text-muted-foreground mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Weekly hours</p>
                  <p className="text-sm font-medium text-foreground">{employee?.weekly_hours || 0} h</p>
                </div>
              </div>
            </div>

            {/* Payroll Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-foreground">Payrolls and other costs</h2>
                <button 
                  onClick={() => setIsAddPayrollModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-md shadow-sm transition-colors"
                >
                  Add new payroll / cost
                </button>
              </div>
              <PayrollTable 
                records={payrolls} 
                onEdit={openEditPayrollModal} 
                onDelete={handleDeletePayroll}
              />
            </div>
          </>
        )}
      </div>

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Edit employee</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Employee name</label>
                <input 
                  type="text" 
                  value={editEmployeeData.name}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, name: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select 
                  value={editEmployeeData.position_id || ''}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, position_id: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                >
                  <option value="" disabled>Select a role</option>
                  {positions.map(pos => (
                    <option key={pos.id} value={pos.id}>{pos.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email address</label>
                <input 
                  type="email" 
                  value={editEmployeeData.email}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, email: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Government ID</label>
                <input 
                  type="text" 
                  value={editEmployeeData.government_id}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, government_id: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Weekly hours</label>
                <input 
                  type="number" 
                  value={editEmployeeData.weekly_hours}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, weekly_hours: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input 
                  type="text" 
                  value={editEmployeeData.phone}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, phone: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes and observations</label>
                <textarea 
                  value={editEmployeeData.notes}
                  onChange={(e) => setEditEmployeeData({...editEmployeeData, notes: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/30">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2 bg-muted border border-border rounded-md text-foreground font-medium text-sm hover:bg-muted/80"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditEmployee}
                disabled={!editEmployeeData.name || !editEmployeeData.position_id}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payroll Modal */}
      {isAddPayrollModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Add new payroll / cost</h2>
              <button onClick={() => setIsAddPayrollModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Period (Month) <span className="text-red-500">*</span></label>
                <input 
                  type="month" 
                  value={newPayrollData.period}
                  onChange={(e) => setNewPayrollData({...newPayrollData, period: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company Cost <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={newPayrollData.company_cost}
                    onChange={(e) => setNewPayrollData({...newPayrollData, company_cost: e.target.value})}
                    className="w-full pl-7 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Net Amount (Optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={newPayrollData.net_amount}
                    onChange={(e) => setNewPayrollData({...newPayrollData, net_amount: e.target.value})}
                    className="w-full pl-7 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Payslip PDF (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-md cursor-pointer hover:bg-muted/80 transition-colors text-sm font-medium text-foreground">
                    <Upload size={16} />
                    Select file
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={(e) => setPayrollFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                    />
                  </label>
                  <span className="text-sm text-muted-foreground truncate">
                    {payrollFile ? payrollFile.name : 'No file selected'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes (Optional)</label>
                <textarea 
                  value={newPayrollData.notes}
                  onChange={(e) => setNewPayrollData({...newPayrollData, notes: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                  placeholder="Any remarks..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/30">
              <button 
                onClick={() => setIsAddPayrollModalOpen(false)}
                className="px-5 py-2 bg-muted border border-border rounded-md text-foreground font-medium text-sm hover:bg-muted/80"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddPayroll}
                disabled={!newPayrollData.period || !newPayrollData.company_cost}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Add Payroll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payroll Modal */}
      {isEditPayrollModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Edit payroll / cost</h2>
              <button onClick={() => setIsEditPayrollModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Period (Month) <span className="text-red-500">*</span></label>
                <input 
                  type="month" 
                  value={editPayrollData.period}
                  onChange={(e) => setEditPayrollData({...editPayrollData, period: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company Cost <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editPayrollData.company_cost}
                    onChange={(e) => setEditPayrollData({...editPayrollData, company_cost: e.target.value})}
                    className="w-full pl-7 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Net Amount (Optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editPayrollData.net_amount}
                    onChange={(e) => setEditPayrollData({...editPayrollData, net_amount: e.target.value})}
                    className="w-full pl-7 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes (Optional)</label>
                <textarea 
                  value={editPayrollData.notes}
                  onChange={(e) => setEditPayrollData({...editPayrollData, notes: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                  placeholder="Any remarks..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/30">
              <button 
                onClick={() => setIsEditPayrollModalOpen(false)}
                className="px-5 py-2 bg-muted border border-border rounded-md text-foreground font-medium text-sm hover:bg-muted/80"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditPayroll}
                disabled={!editPayrollData.period || !editPayrollData.company_cost}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
