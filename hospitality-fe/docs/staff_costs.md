# Haddock Staff Costs Feature Analysis

This document provides a detailed analysis of the **Staff Costs (payrolls and other labor costs)** feature in the Haddock application, based on the network requests, payload structures, and localized translations extracted from the HAR file `web.haddock.app.har`.

---

## 1. Feature Overview

Haddock's **Staff Costs** (`Gastos de Personal` or `Nóminas`) is a module designed for managing, analyzing, and storing employee payrolls and other related personnel expenses (such as overtime or off-payroll costs). It supports:
- **Two Upload Modes**: 
  1. *By Employee (Recommended)*: Granular control with breakdown per employee, allowing payslip file attachments.
  2. *Without Employee Breakdown*: Fast, high-level upload of the monthly grand total without associating individual workers.
- **Dynamic Employee Directory**: Keeping track of active/inactive workers, contact info, emails, and roles.
- **Flexible Payroll Formats**: Categorization of costs by *Accrued (Devengado)*, *Company Cost*, or *Liquid Salary (Net + SS + IRPF)* depending on the payroll export style (e.g., A3 format or official formats).
- **Time/Month-based Summaries**: Monthly rolls showing total employee amounts, payroll counts, other labor costs, and overall totals.
- **Duplication Actions**: Easily copying payrolls from a previous period to a new month to save time.

---

## 2. Core API Specifications

The following endpoints were captured and analyzed from the network activity in the HAR file.

### 2.1 Month Summaries
* **Endpoint**: `GET /api/payrolls-summary`
* **Query Parameters**:
  - `propertyID` (string): The ID of the restaurant/property (e.g., `prop~fW5oBwLCTuKM3pG0Qupr7A`).
* **Purpose**: Fetches the list of monthly summaries to render the master payroll table.
* **Response Payload (JSON)**:
  ```json
  {
    "data": [
      {
        "date": "2023-08-01",
        "employeesAmount": 1,
        "salaryCount": 1,
        "otherCount": 5,
        "totalAmount": 33021.509999999995
      },
      {
        "date": "2023-07-01",
        "employeesAmount": 0,
        "salaryCount": 5,
        "otherCount": 0,
        "totalAmount": 28332.56
      }
    ]
  }
  ```
* **Field Explanation**:
  - `date`: The first day of the summarized month (representing the monthly period).
  - `employeesAmount`: Count of unique employees who have payroll data in that month.
  - `salaryCount`: Count of official payroll/salary entries.
  - `otherCount`: Count of other labor costs (e.g., overtime, bonuses).
  - `totalAmount`: Sum of all salaries and other labor costs for that period.

---

### 2.2 Employee Directory
* **Endpoint**: `GET /api/payrolls/employees`
* **Query Parameters**:
  - `propertyID` (string): The property ID.
* **Purpose**: Retrieves all staff member profiles, including roles, contact information, status, and payroll assignment flags.
* **Response Payload (JSON)**:
  ```json
  {
    "employees": [
      {
        "id": "pemp~XL6Nc8w9Sd6X_YViCAVrKg",
        "name": "Alejandro Bello Simanca Jaider",
        "email": "Jaider503@gmail.com",
        "positionName": "Camarero/a",
        "active": true,
        "propertyID": "prop~fW5oBwLCTuKM3pG0Qupr7A",
        "positionID": "epos~3EfMz7kZRuyOLybD1Z-_Pg",
        "phone": "651318570",
        "hasPayrolls": false
      },
      {
        "id": "pemp~d5UvbJU5RIifPN51uB2n0A",
        "name": "Marco Tagliabue",
        "positionName": "Director",
        "active": true,
        "propertyID": "prop~fW5oBwLCTuKM3pG0Qupr7A",
        "positionID": "epos~djuES0baSkuQiIplzdCLNw",
        "hasPayrolls": true
      }
    ]
  }
  ```
* **Field Explanation**:
  - `id`: Unique employee ID (prefixed with `pemp~`).
  - `positionName`: Human-readable role (e.g., *Camarero/a*, *Limpieza*, *Director*).
  - `active`: Boolean indicating if the employee is currently active (inactive employees won't appear in the payroll upload workflow).
  - `hasPayrolls`: Flags if the employee has existing payroll records attached.

---

### 2.3 Roles / Positions
* **Endpoint**: `GET /api/payrolls/employee-positions`
* **Query Parameters**:
  - `propertyID` (string): The property ID.
* **Purpose**: Lists all registered positions/roles defined for this property.
* **Response Payload (JSON)**:
  ```json
  {
    "positions": [
      {
        "id": "epos~djuES0baSkuQiIplzdCLNw",
        "name": "Director"
      },
      {
        "id": "epos~3EfMz7kZRuyOLybD1Z-_Pg",
        "name": "Camarero/a"
      },
      {
        "id": "epos~FsDj13nfQJiTQD0Ozrn5gw",
        "name": "Limpieza"
      }
    ]
  }
  ```

---

## 3. UI Functionality & Features (from Translation Bundles)

By analyzing `payrolls.json` and `staff-payrolls.json` translations, we mapped out Haddock's user flows and domain terminology:

### 3.1 Payroll Data Entry Methods
Haddock supports multiple ways of declaring salary costs:
1. **Accrued (Devengado)**: Basic earned salary.
2. **Accrued + Company Contribution (Devengado + aportación empresa)**: Accrued salary plus employer-paid social security/taxes. Recommended when uploading official formats.
3. **Company Cost (Coste empresa)**: Direct cost to the company. Recommended for A3 format payroll files.
4. **Liquid Salary (Líquido a percibir)**: The net take-home salary. The form prompts the user to add employee-paid social security and income taxes (IRPF) to reconstruct the cost.

### 3.2 Key Data Fields (per record)
- **Employee**: Associate with a `pemp~` employee or mark as "Without employee" / "Without employee breakdown".
- **Concept / Descriptor**: Text description (e.g., "Payroll August 2023").
- **Type**: Either `salary` (Payroll) or `other` (Other labor costs/expenses).
- **Period**: Month/Year selector.
- **Amount**: The currency cost value.
- **File / Payslip Attachment**: Supports uploading PDF files (max 2MB) containing the payslip.
- **Notes / Observations**: A text field for internal details.

### 3.3 Batch Operations
- **Bulk Duplication**: Allows copying all payroll records of a selected month into another month.
  - *Translation text*: *"This will copy the payrolls of {{period}} into the month you select."*
- **Single Row Duplication**: Fast duplicate for a single staff cost entry.

---

## 4. Architectural Gap & Recommendations

Our current hospitality app implements a shift-based, hourly-rate labor tracking system:
- **Our Current System**: Logs active clock-in/clock-out events, calculates hourly wages dynamically, and runs a daily audit ratio checking active payroll against estimated sales.
- **Haddock's System**: A month-level financial accounting tool for staff costs (processing payslips, official tax and social security breakdowns, monthly payroll summaries).

### Recommended Implementation Steps for Hospitality SaaS:
To bridge the gap and add Haddock-style Monthly Staff Costs:
1. **Database Schema Enhancements**:
   - Create a `StaffEmployee` model (linked to user/staff, storing email, phone, status active/inactive, position).
   - Create a `StaffPosition` model for customizable roles.
   - Create a `MonthlyPayroll` model storing `employee_id` (optional), `type` (payroll/other), `amount`, `period` (date), `notes`, and a file attachment URL.
2. **Add API Endpoints**:
   - `GET /api/v1/payrolls/summary` (aggregated by month)
   - `GET /api/v1/payrolls/employees` (list with filters for active status)
   - `GET /api/v1/payrolls/employee-positions` (CRUD for positions)
   - `POST /api/v1/payrolls` (upload payroll / attach PDF payslip)
   - `POST /api/v1/payrolls/duplicate` (bulk copy months)
3. **Frontend Dashboard View**:
   - Add a "Payrolls & Costs" tab next to the "Shifts & Labor" page to view monthly aggregates, download attached payslips, and add off-payroll/overtime expenses.
