import { PieChart, TableProperties, FileStack, Plus } from 'lucide-react';

const NavSidebar = ({ view, setView, onAddEvidence }) => (
  <nav className="w-14 bg-slate-900 flex flex-col items-center py-4 space-y-6 shrink-0 z-20 shadow-xl relative">
    <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shadow-lg shadow-amber-900/50">
      R43
    </div>
    <div className="flex flex-col space-y-4 w-full items-center">
      <button onClick={() => setView('dashboard')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${view === 'dashboard' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Dashboard">
        <PieChart size={18} />
      </button>
      <button onClick={() => setView('workbench')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${view === 'workbench' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Reconciliation Workbench">
        <TableProperties size={18} />
      </button>
      <button onClick={() => setView('evidence')} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${view === 'evidence' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Evidence Locker">
        <FileStack size={18} />
      </button>
    </div>
    <div className="mt-auto flex flex-col space-y-4 items-center">
      <button
        onClick={onAddEvidence}
        className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all hover:scale-110"
        title="Add Evidence"
      >
        <Plus size={18} />
      </button>
      <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-[9px] text-white font-bold">
        SC
      </div>
    </div>
  </nav>
);

export default NavSidebar;

