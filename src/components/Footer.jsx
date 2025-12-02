import { Scale } from 'lucide-react';

const APP_VERSION = '1.0.0';
const APP_NAME = 'Rule 43 Workspace';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const currentDate = new Date().toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <footer className="h-5 bg-slate-800 text-slate-400 flex items-center justify-between px-3 text-[9px] shrink-0 border-t border-slate-700">
      <div className="flex items-center gap-2">
        <Scale size={10} className="text-amber-500" />
        <span className="font-semibold text-slate-300">{APP_NAME}</span>
        <span className="text-slate-500">v{APP_VERSION}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{currentDate}</span>
        <span className="text-slate-600">|</span>
        <span>© {currentYear} All Rights Reserved</span>
      </div>
    </footer>
  );
};

export default Footer;

