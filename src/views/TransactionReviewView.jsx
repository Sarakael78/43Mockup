import { useState, useMemo } from 'react';
import { CheckCircle2, MessageCircle, Search, Eye, EyeOff } from 'lucide-react';

// TransactionRow component - handles individual transaction display and interactions
const TransactionRow = ({
  transaction,
  categories,
  onCategoryChange,
  onVerify,
  onNoteChange,
  onNoteToggle,
  showNoteInput
}) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const formatAmount = (amount) => {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return amount >= 0 ? `+${formatted}` : formatted;
  };

  const isUncategorized = !transaction.cat || transaction.cat === 'Uncategorized';
  const isVerified = transaction.status === 'proven'; // Map "proven" to verified status

  // Mobile card layout (< 768px)
  const MobileCard = () => (
    <div className="md:hidden border-b border-gray-100 p-4 space-y-3">
      {/* Top: Date & Amount */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">{formatDate(transaction.date)}</span>
        <span className={`text-lg font-mono font-medium ${
          transaction.amount >= 0 ? 'text-emerald-600' : 'text-gray-900'
        }`}>
          {formatAmount(transaction.amount)}
        </span>
      </div>

      {/* Middle: Description */}
      <div>
        <div className="font-medium text-gray-900">
          {transaction.clean || transaction.desc}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {transaction.desc}
        </div>
      </div>

      {/* Bottom: Category & Actions */}
      <div className="space-y-3">
        <select
          value={transaction.cat || ''}
          onChange={(e) => onCategoryChange(transaction.id, e.target.value)}
          className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            isUncategorized
              ? 'border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-400'
              : 'border-gray-300 bg-white text-gray-900'
          }`}
        >
          {isUncategorized && <option value="">Uncategorized</option>}
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <div className="flex items-center justify-between">
          <button
            onClick={() => onNoteToggle(transaction.id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
              transaction.notes ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <MessageCircle size={16} />
            {transaction.notes ? 'Edit Note' : 'Add Note'}
          </button>

          {!isVerified ? (
            <button
              onClick={() => onVerify(transaction.id)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 size={16} />
              Verify
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-md">
              <CheckCircle2 size={16} />
              Verified
            </div>
          )}
        </div>
      </div>

      {/* Notes input - collapsible */}
      {showNoteInput && (
        <div className="pt-3 border-t border-gray-100">
          <textarea
            value={transaction.notes || ''}
            onChange={(e) => onNoteChange(transaction.id, e.target.value)}
            placeholder="Explain this transaction (optional)..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            onBlur={(e) => {
              // Auto-save on blur (focus out)
              if (e.target.value.trim() !== (transaction.notes || '').trim()) {
                onNoteChange(transaction.id, e.target.value.trim());
              }
            }}
          />
        </div>
      )}
    </div>
  );

  // Desktop table row layout (>= 768px)
  const DesktopRow = () => (
    <div className="hidden md:block border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Main row */}
      <div className="flex items-center px-4 py-3 text-sm">
        {/* Date */}
        <div className="w-16 text-gray-500 text-xs">
          {formatDate(transaction.date)}
        </div>

        {/* Transaction */}
        <div className="flex-1 min-w-0 px-4">
          <div className="font-medium text-gray-900 truncate">
            {transaction.clean || transaction.desc}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {transaction.desc}
          </div>
        </div>

        {/* Amount */}
        <div className={`w-24 text-right font-mono font-medium ${
          transaction.amount >= 0 ? 'text-emerald-600' : 'text-gray-900'
        }`}>
          {formatAmount(transaction.amount)}
        </div>

        {/* Category */}
        <div className="w-48 px-4">
          <select
            value={transaction.cat || ''}
            onChange={(e) => onCategoryChange(transaction.id, e.target.value)}
            className={`w-full px-3 py-1 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              isUncategorized
                ? 'border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-400'
                : 'border-gray-300 bg-white text-gray-900'
            }`}
          >
            {isUncategorized && <option value="">Uncategorized</option>}
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="w-12 flex justify-center">
          <button
            onClick={() => onNoteToggle(transaction.id)}
            className={`p-1 rounded-full hover:bg-gray-100 transition-colors ${
              transaction.notes ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            <MessageCircle size={16} />
          </button>
        </div>

        {/* Action */}
        <div className="w-16 flex justify-center">
          {!isVerified ? (
            <button
              onClick={() => onVerify(transaction.id)}
              className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center group"
            >
              <CheckCircle2 size={14} className="text-gray-400 group-hover:text-green-500" />
            </button>
          ) : (
            <CheckCircle2 size={16} className="text-green-500" />
          )}
        </div>
      </div>

      {/* Notes input - collapsible */}
      {showNoteInput && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-25">
          <textarea
            value={transaction.notes || ''}
            onChange={(e) => onNoteChange(transaction.id, e.target.value)}
            placeholder="Explain this transaction (optional)..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            onBlur={(e) => {
              // Auto-save on blur (focus out)
              if (e.target.value.trim() !== (transaction.notes || '').trim()) {
                onNoteChange(transaction.id, e.target.value.trim());
              }
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      <MobileCard />
      <DesktopRow />
    </>
  );
};

const TransactionReviewView = ({ transactions, categories = [], onUpdateTransaction }) => {
  const [showPendingOnly, setShowPendingOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteInputsOpen, setNoteInputsOpen] = useState(new Set());

  // Calculate progress
  const progressStats = useMemo(() => {
    const total = transactions.length;
    const verified = transactions.filter(tx => tx.status === 'proven').length;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    const pending = total - verified;

    return { total, verified, pending, percentage };
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by pending status if enabled
    if (showPendingOnly) {
      filtered = filtered.filter(tx => tx.status !== 'proven');
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tx =>
        (tx.clean || tx.desc || '').toLowerCase().includes(term) ||
        (tx.cat || '').toLowerCase().includes(term)
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, showPendingOnly, searchTerm]);

  const handleCategoryChange = (txId, category) => {
    onUpdateTransaction(txId, { cat: category });
  };

  const handleVerify = (txId) => {
    onUpdateTransaction(txId, { status: 'proven' });
    // Trigger success animation (could be enhanced with CSS transitions)
  };

  const handleNoteChange = (txId, notes) => {
    onUpdateTransaction(txId, { notes: notes || undefined });
  };

  const handleNoteToggle = (txId) => {
    setNoteInputsOpen(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  return (
    <div className="p-4 h-full overflow-auto bg-white">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Transaction Review</h1>

        {/* Progress Widget */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {progressStats.pending} pending transactions require your attention
            </span>
            <span className="text-lg font-bold text-gray-900">
              {progressStats.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressStats.percentage}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowPendingOnly(!showPendingOnly)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
              showPendingOnly
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {showPendingOnly ? <Eye size={16} /> : <EyeOff size={16} />}
            Show Pending Only
          </button>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="w-16">Date</div>
          <div className="flex-1 px-4">Transaction</div>
          <div className="w-24 text-right">Amount</div>
          <div className="w-48 px-4">Category</div>
          <div className="w-12 text-center">Notes</div>
          <div className="w-16 text-center">Action</div>
        </div>

        {/* Transaction Rows */}
        <div className="divide-y divide-gray-100">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(transaction => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                onCategoryChange={handleCategoryChange}
                onVerify={handleVerify}
                onNoteChange={handleNoteChange}
                onNoteToggle={handleNoteToggle}
                showNoteInput={noteInputsOpen.has(transaction.id)}
              />
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              {showPendingOnly ? 'No pending transactions to review.' : 'No transactions found.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionReviewView;
