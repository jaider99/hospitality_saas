'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, ChevronRight, User, X } from 'lucide-react';
import { getApiClient } from '../../../store/auth';
import { EmployeeCard } from '../../../components/StaffCosts/EmployeeCard';

export default function StaffCostsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'employees' | 'payrolls'>('employees');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployeeData, setNewEmployeeData] = useState({ 
    name: '', email: '', position_id: null as number | null, government_id: '', weekly_hours: '', phone: '', notes: '', active: true 
  });

  // Default property ID for now (usually you'd get this from context/session)
  const propertyId = 1;

  useEffect(() => {
    fetchEmployees();
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const client = getApiClient();
      const data = await client.getStaffPositions(propertyId);
      setPositions(data);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.getStaffEmployees(propertyId);
      // We also need position names for badges, but since we didn't populate relationships deeply yet,
      // we'll mock the role or fetch positions if necessary. For now we use a default role.
      // In a real app we would join position data on the backend.
      setEmployees(data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const client = getApiClient();
      await client.updateStaffEmployee(propertyId, id, { active: currentStatus });
      fetchEmployees();
    } catch (error) {
      console.error('Failed to update employee status:', error);
    }
  };

  const handleAddEmployee = async () => {
    try {
      const client = getApiClient();
      await client.createStaffEmployee(propertyId, {
        ...newEmployeeData,
        weekly_hours: newEmployeeData.weekly_hours ? parseFloat(newEmployeeData.weekly_hours) : undefined
      });
      setIsAddModalOpen(false);
      setNewEmployeeData({ name: '', email: '', position_id: null, government_id: '', weekly_hours: '', phone: '', notes: '', active: true });
      fetchEmployees();
    } catch (error) {
      console.error('Failed to add employee:', error);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    (emp.email && emp.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-auto bg-background min-h-screen">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Staff costs</h1>
              <a href="#" className="text-sm text-accent hover:underline flex items-center font-medium">
                Learn more <ChevronRight size={14} className="ml-1" />
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-6 border-b border-border mb-6">
          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'employees' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('payrolls')}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'payrolls' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Payrolls and other costs
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="text"
                  placeholder="Search by employee name, email or role"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-foreground transition-all shadow-sm"
                />
              </div>
              <button 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-md shadow-sm transition-colors"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus size={18} />
                Add new empl.
              </button>
            </div>

            {/* Employee List */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">My employees</h2>
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading employees...</div>
              ) : (
                <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No employees found.</div>
                  ) : (
                    filteredEmployees.map(emp => (
                      <EmployeeCard
                        key={emp.id}
                        id={emp.id}
                        name={emp.name}
                        email={emp.email}
                        role={emp.position?.name || 'Waiter/Waitress'}
                        active={emp.active}
                        onToggleActive={handleToggleActive}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'payrolls' && (
          <div className="bg-card p-8 rounded-lg shadow-sm border border-border text-center text-muted-foreground">
            Payroll functionality is available on the employee details page.
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Add employee</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Employee name</label>
                <input 
                  type="text" 
                  placeholder="Employee name. Eg: Captain Haddock"
                  value={newEmployeeData.name}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, name: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select 
                  value={newEmployeeData.position_id || ''}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, position_id: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                >
                  <option value="" disabled>Select or create a role</option>
                  {positions.map(pos => (
                    <option key={pos.id} value={pos.id}>{pos.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email address</label>
                <input 
                  type="email" 
                  placeholder="Enter the email address. Eg: captain@haddock.app"
                  value={newEmployeeData.email}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, email: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Government ID</label>
                <input 
                  type="text" 
                  placeholder="Eg: 12345678X"
                  value={newEmployeeData.government_id}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, government_id: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Weekly hours</label>
                <input 
                  type="number" 
                  value={newEmployeeData.weekly_hours}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, weekly_hours: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                <input 
                  type="text" 
                  placeholder="Eg: 612 345 678"
                  value={newEmployeeData.phone}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, phone: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes and observations</label>
                <textarea 
                  placeholder="Write notes or observations related to the employee"
                  value={newEmployeeData.notes}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, notes: e.target.value})}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/30">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2 bg-muted border border-border rounded-md text-foreground font-medium text-sm hover:bg-muted/80"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddEmployee}
                disabled={!newEmployeeData.name || !newEmployeeData.position_id}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
