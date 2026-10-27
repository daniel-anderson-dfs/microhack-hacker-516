import axios from 'axios';
import { useQuery } from 'react-query';
import { api } from '../../../api/config';
import { useTheme } from '../../../context/ThemeContext';

interface Supplier {
  supplierId: number;
  name: string;
}

interface Props {
  search: string;
  supplierId: string;
  onSearchChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onClear: () => void;
}

export default function ProductFilters({
  search, supplierId, onSearchChange, onSupplierChange, onClear,
}: Props) {
  const { darkMode } = useTheme();
  const { data: suppliers, isLoading, isError, refetch } = useQuery(
    ['suppliers', api.baseURL],
    async ({ signal }) => {
      const { data } = await axios.get<Supplier[]>(`${api.baseURL}${api.endpoints.suppliers}`, { signal });
      return data;
    },
    { staleTime: 60_000 },
  );
  const control = `w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:outline-none ${
    darkMode ? 'bg-gray-800 text-light border-gray-700' : 'bg-white text-gray-800 border-gray-300'
  }`;

  return (
    <section aria-label="Product search and filters"
      className={`border-l-4 border-primary pl-4 ${darkMode ? 'text-light' : 'text-gray-800'}`}>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-4 items-end">
        <div>
          <label htmlFor="product-search" className="block text-sm font-semibold mb-2">Search products</label>
          <input id="product-search" type="search" value={search} maxLength={200}
            placeholder="Name, SKU or description"
            onChange={(event) => onSearchChange(event.target.value)} className={control} />
        </div>
        <div>
          <label htmlFor="product-supplier" className="block text-sm font-semibold mb-2">Supplier</label>
          <select id="product-supplier" value={supplierId} disabled={isLoading || isError}
            onChange={(event) => onSupplierChange(event.target.value)} className={control}>
            <option value="">{isLoading ? 'Loading suppliers...' : 'All suppliers'}</option>
            {suppliers?.map((supplier) => (
              <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.name}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onClear} disabled={!search && !supplierId}
          className="px-4 py-2 rounded-lg border border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
          Clear filters
        </button>
      </div>
      {isError && (
        <p role="alert" className="mt-2 text-sm">
          Suppliers could not be loaded. You can still search products.{' '}
          <button type="button" onClick={() => { void refetch(); }}
            className="underline focus-visible:ring-2 focus-visible:ring-primary">Retry suppliers</button>
        </p>
      )}
    </section>
  );
}
