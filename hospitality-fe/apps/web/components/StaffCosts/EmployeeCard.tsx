import React from 'react';
import Link from 'next/link';

interface EmployeeCardProps {
  id: number;
  name: string;
  email?: string;
  role: string;
  active: boolean;
  onToggleActive: (id: number, active: boolean) => void;
}

export function EmployeeCard({ id, name, email, role, active, onToggleActive }: EmployeeCardProps) {
  // Determine badge colors based on role
  let badgeClasses = "bg-gray-100 text-gray-800";
  if (role.toLowerCase().includes('waiter') || role.toLowerCase().includes('waitress')) {
    badgeClasses = "bg-purple-100 text-purple-700";
  } else if (role.toLowerCase().includes('cleaning')) {
    badgeClasses = "bg-fuchsia-100 text-fuchsia-700";
  } else if (role.toLowerCase().includes('director') || role.toLowerCase().includes('manager')) {
    badgeClasses = "bg-blue-100 text-blue-700";
  }

  return (
    <div className="flex items-center justify-between p-4 bg-card border-b border-border hover:bg-muted/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badgeClasses} whitespace-nowrap w-max`}>
          {role}
        </span>
        <div className="flex flex-col">
          <span className="text-foreground font-semibold text-sm">{name}</span>
          <span className="text-muted-foreground text-xs">{email || 'No email provided'}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Toggle Switch */}
        <button 
          onClick={() => onToggleActive(id, !active)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className="sr-only">Toggle active</span>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${active ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
        {/* Chevron for navigation */}
        <Link href={`/dashboard/staff-costs/${id}`}>
          <div className="text-muted-foreground hover:text-primary cursor-pointer p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}
