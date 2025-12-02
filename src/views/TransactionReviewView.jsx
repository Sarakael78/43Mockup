import { useState, useMemo, useEffect, useRef } from 'react';
import { CheckCircle2, MessageCircle, Search, Eye, EyeOff, ChevronDown } from 'lucide-react';

/**
 * SearchableSelect Component
 * A custom combobox that allows typing to filter options or selecting from a dropdown.
 * Replaces standard <select> to meet the "Search-enabled" design requirement.
 */
const SearchableSelect = ({ value, onChange, options, isUncategorized }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Reset filter when value changes externally or dropdown closes
    if (!isOpen) setFilter('');
  }, [isOpen, value]);

  useEffect(() => {
    // Click outside handler to close dropdown
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`relative flex items-center w-full px-3 py-1.5 text-sm border rounded-full cursor-text transition-all ${
          isUncategorized
            ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-100'
            : 'border-gray-300 bg-white hover:border-blue-400'
        } ${isOpen ? 'ring-2 ring-blue-100 border-blue-500' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className={`w-full bg-transparent border-none outline-none text-sm ${
            isUncategorized ? 'placeholder-amber-700' : 'text-gray-900'
          }`}
          value={isOpen ? filter : (value || '')}
          onChange={(e) => {
            setFilter(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          placeholder={value || "Select Category..."}
          onFocus={() => setIsOpen(true)}
        />
        <ChevronDown size={14} className="ml-2 text-gray-400 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  value === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                  setFilter('');
                }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500 italic">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
};

// TransactionRow component - handles individual transaction display and interactions
const TransactionRow = ({
  transaction,
  categories,
  onCategoryChange,
  onVerify,
  isVerifying,
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
  const isVerified = transaction.status === 'proven';

  // Animation classes for verifying state
  const rowTransitionClass = `transition-all duration-500 ease-out ${
    isVerifying ? 'opacity-0 bg-green-50 translate-x-4' : 'opacity-100'
  }`;

  // Mobile card layout (< 768px)
  const MobileCard = () => (
    <div className={`md:hidden border-b border-gray-100 p-4 space-y-3 ${rowTransitionClass}`}>
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
        <div className="text-sm text-gray-500 mt-1 line-clamp-1">
          {transaction.desc}
        </div>
      </div>

      {/* Bottom: Category & Actions */}
      <div className="space-y-3">
        <SearchableSelect 
          value={transaction.cat}
          options={categories}
          isUncategorized={isUncategorized}
          onChange={(val) => onCategoryChange(transaction.id, val)}
        />

        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => onNoteToggle(transaction.id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-full transition-colors ${
              transaction.notes 
                ? 'text-blue-600 border-blue-200 bg-blue-50' 
                : 'text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <MessageCircle size={16} className={transaction.notes ? 'fill-blue-100' : ''} />
            {transaction.notes ? 'Edit Note' : 'Add Note'}
          </button>

          {!isVerified && !isVerifying ? (
            <button
              onClick={() => onVerify(transaction.id)}
              className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-green-600 hover:text-white transition-all duration-200 group"
            >
              <CheckCircle2 size={16} className="text-gray-400 group-hover:text-white" />
              Verify
            </button>
          ) : (
            <div className="flex items-center gap-2 px-6 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-full animate-in fade-in zoom-in duration-300">
              <CheckCircle2 size={16} />
              {isVerifying ? 'Verifying...' : 'Verified'}
            </div>
          )}
        </div>
      </div>

      {/* Notes input - collapsible */}
      {showNoteInput && (
        <div className="pt-3 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
          <textarea
            value={transaction.notes || ''}
            onChange={(e) => onNoteChange(transaction.id, e.target.value)}
            placeholder="Explain this transaction (optional)..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
            rows={3}
            onBlur={(e) => {
              if (e.target.value.trim() !== (transaction.notes || '').trim()) {
                onNoteChange(transaction.id, e.target.value.trim());
              }
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  );

  // Desktop table row layout (>= 768px)
  const DesktopRow = () => (
    <div className={`hidden md:block border-b border-gray-100 hover:bg-gray-50 group ${rowTransitionClass}`}>
      {/* Main row */}
      <div className="flex items-center px-4 py-4 text-sm">
        {/* Date */}
        <div className="w-20 text-gray-400 text-xs font-medium uppercase tracking-wide">
          {formatDate(transaction.date)}
        </div>

        {/* Transaction */}
        <div className="flex-1 min-w-0 px-4">
          <div className="font-medium text-gray-900 truncate text-base">
            {transaction.clean || transaction.desc}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {transaction.desc}
          </div>
        </div>

        {/* Amount */}
        <div className={`w-28 text-right font-mono font-medium text-sm px-4 ${
          transaction.amount >= 0 ? 'text-emerald-600' : 'text-gray-900'
        }`}>
          {formatAmount(transaction.amount)}
        </div>

        {/* Category */}
        <div className="w-64 px-4">
          <SearchableSelect 
            value={transaction.cat}
            options={categories}
            isUncategorized={isUncategorized}
            onChange={(val) => onCategoryChange(transaction.id, val)}
          />
        </div>

        {/* Notes */}
        <div className="w-16 flex justify-center">
          <button
            onClick={() => onNoteToggle(transaction.id)}
            className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${
              transaction.notes ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-gray-600'
            }`}
            title="Add Note"
          >
            <MessageCircle size={18} className={transaction.notes ? 'fill-blue-100' : ''} />
          </button>
        </div>

        {/* Action */}
        <div className="w-20 flex justify-center">
          {!isVerified && !isVerifying ? (
            <button
              onClick={() => onVerify(transaction.id)}
              className="w-8 h-8 rounded-full border-2 border-gray-200 hover:border-green-500 hover:bg-green-500 transition-all flex items-center justify-center group"
              title="Verify Transaction"
            >
              <CheckCircle2 size={16} className="text-gray-300 group-hover:text-white transition-colors" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
          )}
        </div>
      </div>

      {/* Notes input - collapsible */}
      {showNoteInput && (
        <div className="px-4 pb-4 pl-24 border-t border-gray-50 bg-gray-50/50 animate-in slide-in-from-top-1">
          <div className="relative mt-2">
            <textarea
              value={transaction.notes || ''}
              onChange={(e) => onNoteChange(transaction.id, e.target.value)}
              placeholder="Explain this transaction (optional)..."
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white shadow-sm"
              rows={2}
              onBlur={(e) => {
                if (e.target.value.trim() !== (transaction.notes || '').trim()) {
                  onNoteChange(transaction.id, e.target.value.trim());
                }
              }}
              autoFocus
            />
            <div className="absolute right-2 top-2 text-xs text-gray-400">
              Saved automatically
            </div>
          </div>
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
  const [verifyingIds, setVerifyingIds] = useState(new Set()); // Track items currently animating success

  // Calculate progress
  const progressStats = useMemo(() => {
    const total = transactions.length;
    const verified = transactions.filter(tx => tx.status === 'proven').length;
    // Prevent divide by zero
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 100;
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
        (tx.cat || '').toLowerCase().includes(term) ||
        (tx.amount || '').toString().includes(term)
      );
    }

    // Sort: Uncategorized first, then by Date (newest first)
    return filtered.sort((a, b) => {
      const aUncat = !a.cat || a.cat === 'Uncategorized';
      const bUncat = !b.cat || b.cat === 'Uncategorized';
      if (aUncat && !bUncat) return -1;
      if (!aUncat && bUncat) return 1;
      return new Date(b.date) - new Date(a.date);
    });
  }, [transactions, showPendingOnly, searchTerm]);

  const handleCategoryChange = (txId, category) => {
    onUpdateTransaction(txId, { cat: category });
  };

  const handleVerify = (txId) => {
    // 1. Start success animation
    setVerifyingIds(prev => new Set(prev).add(txId));

    // 2. Wait 500ms for animation to play, then update data
    setTimeout(() => {
      onUpdateTransaction(txId, { status: 'proven' });
      
      // Cleanup ID from verifying set (it will likely be removed from view by filter anyway)
      setVerifyingIds(prev => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }, 500);
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
    <div className="h-full flex flex-col bg-white">
      {/* Header Section */}
      <div className="p-6 pb-2 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction Review</h1>
            <p className="text-sm text-gray-500 mt-1">
              Validate and categorize your transactions below.
            </p>
          </div>
          
          {/* Progress Widget */}
          <div className="bg-gray-50 rounded-xl p-4 min-w-[300px] border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                {progressStats.pending > 0 
                  ? `${progressStats.pending} pending items`
                  : 'All caught up!'}
              </span>
              <span className={`text-sm font-bold ${progressStats.percentage === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                {progressStats.percentage}% Verified
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  progressStats.percentage === 100 ? 'bg-green-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progressStats.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row items-center gap-4 py-4">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by merchant, amount or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={() => setShowPendingOnly(!showPendingOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-lg transition-all ${
              showPendingOnly
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {showPendingOnly ? <Eye size={18} /> : <EyeOff size={18} />}
            {showPendingOnly ? 'Pending Items' : 'Show All'}
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-auto bg-white">
        {/* Table Header (Desktop) */}
        <div className="sticky top-0 z-10 hidden md:flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="w-20">Date</div>
          <div className="flex-1 px-4">Transaction</div>
          <div className="w-28 text-right px-4">Amount</div>
          <div className="w-64 px-4">Category</div>
          <div className="w-16 text-center">Note</div>
          <div className="w-20 text-center">Action</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(transaction => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                onCategoryChange={handleCategoryChange}
                onVerify={handleVerify}
                isVerifying={verifyingIds.has(transaction.id)}
                onNoteChange={handleNoteChange}
                onNoteToggle={handleNoteToggle}
                showNoteInput={noteInputsOpen.has(transaction.id)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-gray-300" />
              </div>
              <p className="text-lg font-medium text-gray-500">
                {showPendingOnly ? 'All caught up!' : 'No transactions found'}
              </p>
              <p className="text-sm">
                {showPendingOnly ? 'Great job, you have reviewed all pending items.' : 'Try adjusting your search terms.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionReviewView;
