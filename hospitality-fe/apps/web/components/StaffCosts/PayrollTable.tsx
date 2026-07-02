import React from 'react';

interface PayrollRecord {
  id: number;
  period: string; // e.g. '2023-08'
  company_cost: number;
  net_amount?: number;
  notes?: string;
  attachment_url?: string;
}

interface PayrollTableProps {
  records: PayrollRecord[];
  onEdit: (record: PayrollRecord) => void;
  onDelete: (record: PayrollRecord) => void;
}

export function PayrollTable({ records, onEdit, onDelete }: PayrollTableProps) {
  // Sort records descending by period
  const sortedRecords = [...records].sort((a, b) => b.period.localeCompare(a.period));

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <table className="min-w-full text-left text-sm text-foreground">
        <thead className="bg-muted/50 text-foreground font-semibold border-b border-border">
          <tr>
            <th className="px-6 py-3">Month</th>
            <th className="px-6 py-3 text-right">Company cost</th>
            <th className="px-6 py-3 text-right">Net amount</th>
            <th className="px-6 py-3 text-center">Attachment</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedRecords.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                No payroll records found.
              </td>
            </tr>
          ) : (
            sortedRecords.map((record) => (
              <tr key={record.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">
                  {/* Format YYYY-MM to readable month (e.g., August 2023) */}
                  {new Date(`${record.period}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </td>
                <td className="px-6 py-4 text-right">€{record.company_cost.toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  {record.net_amount ? `€${record.net_amount.toFixed(2)}` : '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  {record.attachment_url ? (
                    <a href={`/api/v1/files/${record.attachment_url}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      View PDF
                    </a>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => onEdit(record)} className="text-muted-foreground hover:text-accent">
                    Edit
                  </button>
                  <button onClick={() => onDelete(record)} className="text-red-500 hover:text-red-600 transition-colors">
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
