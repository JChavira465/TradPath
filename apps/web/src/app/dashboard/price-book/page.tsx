"use client";

import { useRef, useState } from "react";
import { useCreatePriceBookItem, useDeletePriceBookItem, useImportPriceBookCsv, usePriceBook } from "@/hooks/use-price-book";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PriceBookPage() {
  const [search, setSearch] = useState("");
  const { data: items, isLoading } = usePriceBook(search || undefined);
  const createItem = useCreatePriceBookItem();
  const deleteItem = useDeletePriceBookItem();
  const importCsv = useImportPriceBookCsv();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("SERVICE");
  const [unitPrice, setUnitPrice] = useState("");
  const [unit, setUnit] = useState("each");
  const [importResult, setImportResult] = useState<{ imported: number; errors: any[] } | null>(null);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createItem.mutateAsync({ name, category, unitPrice: Number(unitPrice), unit });
    setName("");
    setUnitPrice("");
    setShowAdd(false);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const result = await importCsv.mutateAsync(file);
    setImportResult(result);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Price Book</h1>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importCsv.isPending}>
            {importCsv.isPending ? "Importing…" : "Import CSV"}
          </Button>
          <Button onClick={() => setShowAdd((v) => !v)}>New Item</Button>
        </div>
      </div>

      {importResult && (
        <div className="mb-4 rounded-md border bg-blue-50 p-3 text-sm">
          <p className="text-blue-700">Imported {importResult.imported} item(s).</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-red-600">
              {importResult.errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAdd && (
        <form onSubmit={onAdd} className="mb-4 grid grid-cols-5 gap-2 rounded-lg border bg-white p-4">
          <Input className="col-span-2" required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="LABOR">Labor</option>
            <option value="MATERIAL">Material</option>
            <option value="SERVICE">Service</option>
          </select>
          <Input required type="number" step="0.01" min="0" placeholder="Unit price" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          <Input placeholder="Unit (hour, each…)" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <div className="col-span-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createItem.isPending}>
              Add
            </Button>
          </div>
        </form>
      )}

      <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit Price</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Taxable</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items?.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-navy">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-gray-500">${item.unitPrice}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-gray-500">{item.taxable ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteItem.mutate(item.id)} className="text-xs text-gray-400 hover:text-red-600">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No price book items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
