import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Minus, Trash2 } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import type { InventoryItem } from '../../../types/dashboard';

interface Props {
  inventory: InventoryItem[];
  updateInventory: (id: string, quantity: number) => Promise<void>;
  addInventoryItem: (name: string, quantity: number, unit: string, lowStockThreshold: number, notes?: string) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
}

const InventoryList: React.FC<Props> = ({ inventory, updateInventory, addInventoryItem, deleteInventoryItem }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: '', unit: 'units', threshold: '1', notes: '' });

  const lowStockCount = inventory.filter(i => i.quantity <= i.lowStockThreshold).length;

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await addInventoryItem(form.name, Number(form.quantity) || 0, form.unit, Number(form.threshold) || 1, form.notes || undefined);
    setForm({ name: '', quantity: '', unit: 'units', threshold: '1', notes: '' });
    setAdding(false);
  };

  return (
    <PanelCard
      title="Inventory"
      icon={<Package className="w-4 h-4" />}
      badge={lowStockCount > 0 ? `${lowStockCount} low` : undefined}
      accent="amber"
      headerRight={
        <button
          onClick={() => setAdding(!adding)}
          className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      }
    >
      {/* Add Item Form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800/40"
          >
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Item name"
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="Quantity"
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="units">Units</option>
                  <option value="vials">Vials</option>
                  <option value="pills">Pills</option>
                  <option value="g">Grams</option>
                  <option value="mg">mg</option>
                  <option value="IU">IU</option>
                  <option value="tubes">Tubes</option>
                  <option value="bottles">Bottles</option>
                </select>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                  placeholder="Low stock at"
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={!form.name.trim()}
                  className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inventory Items */}
      <div className="divide-y divide-zinc-800/30">
        {inventory.map(item => {
          const isLow = item.quantity <= item.lowStockThreshold;
          const barPct = Math.min(100, item.lowStockThreshold > 0 ? (item.quantity / (item.lowStockThreshold * 3)) * 100 : 100);

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors ${isLow ? 'bg-amber-500/[0.03]' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isLow ? 'text-amber-400' : 'text-zinc-200'}`}>
                    {item.name}
                  </span>
                  <span className="text-[11px] text-zinc-600">{item.quantity} {item.unit}</span>
                  {isLow && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      LOW
                    </span>
                  )}
                </div>
                {/* Quantity bar */}
                <div className="mt-1 h-1 w-full max-w-[120px] bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isLow ? 'bg-amber-500' : 'bg-emerald-500/60'
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateInventory(item.id, Math.max(0, item.quantity - 1))}
                  className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => updateInventory(item.id, item.quantity + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteInventoryItem(item.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 transition-colors ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {inventory.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">No inventory items</div>
        )}
      </div>
    </PanelCard>
  );
};

export default InventoryList;
