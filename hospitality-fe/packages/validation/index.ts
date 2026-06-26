import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const InviteUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['owner', 'gm', 'chef', 'accountant'], {
    errorMap: () => ({ message: 'Invalid role selection' })
  })
});

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  deliveryDays: z.string().min(1, 'Delivery days (e.g. Mon, Thu) are required'),
  minimumOrder: z.coerce.number().min(0, 'Minimum order must be greater than or equal to 0'),
  paymentTerms: z.string().min(1, 'Payment terms (e.g. 30 days) are required')
});

export const SuppliedProductSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier selection'),
  name: z.string().min(1, 'Product name is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit (e.g. KG, Liters) is required'),
  packSize: z.coerce.number().positive('Pack size must be a positive number'),
  currentCost: z.coerce.number().min(0, 'Current cost must be greater than or equal to 0'),
  taxRate: z.coerce.number().min(0, 'Tax rate % must be greater than or equal to 0'),
  location: z.string().min(1, 'Storage location is required')
});

export const RecipeIngredientSchema = z.object({
  suppliedProductId: z.string().uuid('Invalid product selection'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required')
});

export const RecipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required'),
  category: z.enum(['Cocktail', 'Prep Batch', 'Menu Item']),
  portionYield: z.coerce.number().positive('Portion yield must be a positive number'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be greater than or equal to 0'),
  ingredients: z.array(RecipeIngredientSchema).min(1, 'At least one ingredient is required')
});

export const StaffMemberSchema = z.object({
  name: z.string().min(1, 'Staff name is required'),
  role: z.enum(['chef', 'waiter', 'bartender', 'manager']),
  payType: z.enum(['hourly', 'fixed']),
  payRate: z.coerce.number().positive('Pay rate must be a positive number')
});

export const StaffShiftSchema = z.object({
  staffMemberId: z.string().uuid('Invalid staff member selection'),
  shiftStart: z.string().datetime('Invalid shift start datetime'),
  shiftEnd: z.string().datetime('Invalid shift end datetime')
}).refine((data) => new Date(data.shiftEnd) > new Date(data.shiftStart), {
  message: 'Shift end time must be after shift start time',
  path: ['shiftEnd']
});

export const WasteLogSchema = z.object({
  suppliedProductId: z.string().uuid('Invalid product selection'),
  quantity: z.coerce.number().positive('Wasted quantity must be greater than 0'),
  reason: z.string().min(1, 'Reason for waste is required')
});

export const PriceDisputeSchema = z.object({
  invoiceLineId: z.string().uuid('Invalid invoice line selection'),
  notes: z.string().optional()
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type InviteUserInput = z.infer<typeof InviteUserSchema>;
export type SupplierInput = z.infer<typeof SupplierSchema>;
export type SuppliedProductInput = z.infer<typeof SuppliedProductSchema>;
export type RecipeInput = z.infer<typeof RecipeSchema>;
export type StaffMemberInput = z.infer<typeof StaffMemberSchema>;
export type StaffShiftInput = z.infer<typeof StaffShiftSchema>;
export type WasteLogInput = z.infer<typeof WasteLogSchema>;
export type PriceDisputeInput = z.infer<typeof PriceDisputeSchema>;
