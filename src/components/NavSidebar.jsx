import { PieChart, TableProperties, FileStack, Plus } from 'lucide-react';

const NavSidebar = ({ view, setView, onAddEvidence }) => (
  <nav className="w-10 bg-slate-900 flex flex-col items-center py-1.5 space-y-2 shrink-0 z-20 shadow-xl relative">
    <div className="w-7 h-7 bg-amber-500 rounded flex items-center justify-center text-white font-bold text-[8px] shadow-md shadow-amber-900/50">
      R43
    </div>
    <div className="flex flex-col space-y-1 w-full items-center">
      <button onClick={() => setView('dashboard')} className={`w-7 h-7 rounded flex items-center justify-center transition-all ${view === 'dashboard' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Dashboard">
        <PieChart size={14} />
      </button>
      <button onClick={() => setView('workbench')} className={`w-7 h-7 rounded flex items-center justify-center transition-all ${view === 'workbench' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Reconciliation Workbench">
        <TableProperties size={14} />
      </button>
      <button onClick={() => setView('evidence')} className={`w-7 h-7 rounded flex items-center justify-center transition-all ${view === 'evidence' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Evidence Locker">
        <FileStack size={14} />
      </button>
    </div>
    <div className="mt-auto flex flex-col space-y-1.5 items-center">
      <button
        onClick={onAddEvidence}
        className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-500 transition-all hover:scale-105"
        title="Add Evidence"
      >
        <Plus size={14} />
      </button>
      <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[7px] text-white font-bold">
        SC
      </div>
    </div>
  </nav>
);

export default NavSidebar;

