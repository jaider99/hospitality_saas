import { getApiClient } from '@/store/auth';
import { Supplier, SupplierCreate, SupplierUpdate } from './types';

export const getSuppliers = async (): Promise<Supplier[]> => {
  const apiClient = getApiClient();
  const response = await apiClient.get<Supplier[]>('/suppliers');
  return response.data;
};

export const createSupplier = async (data: SupplierCreate): Promise<Supplier> => {
  const apiClient = getApiClient();
  const response = await apiClient.post<Supplier>('/suppliers', data);
  return response.data;
};

export const updateSupplier = async (id: number, data: SupplierUpdate): Promise<Supplier> => {
  const apiClient = getApiClient();
  const response = await apiClient.put<Supplier>(`/suppliers/${id}`, data);
  return response.data;
};

export const deleteSupplier = async (id: number): Promise<void> => {
  const apiClient = getApiClient();
  await apiClient.delete(`/suppliers/${id}`);
};
