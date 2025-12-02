import { useState, useEffect } from 'react';
import { Settings, X, Type, Maximize2 } from 'lucide-react';

const FONT_SIZES = [
  { value: 'xs', label: 'Extra Small', scale: 0.85 },
  { value: 'sm', label: 'Small', scale: 0.925 },
  { value: 'md', label: 'Medium', scale: 1 },
  { value: 'lg', label: 'Large', scale: 1.1 },
  { value: 'xl', label: 'Extra Large', scale: 1.2 }
];

const DENSITY_LEVELS = [
  { value: 'compact', label: 'Compact', scale: 0.6 },
  { value: 'tight', label: 'Tight', scale: 0.8 },
  { value: 'normal', label: 'Normal', scale: 1 },
  { value: 'comfortable', label: 'Comfortable', scale: 1.25 },
  { value: 'spacious', label: 'Spacious', scale: 1.5 }
];

const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleFontSizeChange = (value) => {
    const newSettings = { ...localSettings, fontSize: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleDensityChange = (value) => {
    const newSettings = { ...localSettings, density: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleReset = () => {
    const defaultSettings = { fontSize: 'md', density: 'compact' };
    setLocalSettings(defaultSettings);
    onSettingsChange(defaultSettings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Settings size={14} className="text-slate-500" />
            Display Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
        
        <div className="p-3 space-y-4">
          {/* Font Size Setting */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase mb-2">
              <Type size={12} />
              Font Size
            </label>
            <div className="flex gap-1">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  onClick={() => handleFontSizeChange(size.value)}
                  className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded transition-all ${
                    localSettings.fontSize === size.value
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={size.label}
                >
                  {size.label.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] text-slate-500">
              Preview: <span style={{ fontSize: `${FONT_SIZES.find(s => s.value === localSettings.fontSize)?.scale || 1}em` }}>Sample Text 123</span>
            </div>
          </div>

          {/* Density/Padding Setting */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase mb-2">
              <Maximize2 size={12} />
              Spacing Density
            </label>
            <div className="flex gap-1">
              {DENSITY_LEVELS.map((density) => (
                <button
                  key={density.value}
                  onClick={() => handleDensityChange(density.value)}
                  className={`flex-1 px-1 py-1.5 text-[9px] font-bold rounded transition-all ${
                    localSettings.density === density.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={density.label}
                >
                  {density.label.slice(0, 4)}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
              <span>Less space</span>
              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(DENSITY_LEVELS.findIndex(d => d.value === localSettings.density) + 1) / DENSITY_LEVELS.length * 100}%` }}
                />
              </div>
              <span>More space</span>
            </div>
          </div>

          {/* Preview Box */}
          <div className="border border-slate-200 rounded p-2 bg-slate-50">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Preview</div>
            <div 
              className="bg-white border border-slate-200 rounded overflow-hidden"
              style={{ 
                fontSize: `${FONT_SIZES.find(s => s.value === localSettings.fontSize)?.scale || 1}em`,
              }}
            >
              <div 
                className="border-b border-slate-100 bg-slate-50 font-bold text-slate-700"
                style={{ 
                  padding: `${4 * (DENSITY_LEVELS.find(d => d.value === localSettings.density)?.scale || 1)}px ${8 * (DENSITY_LEVELS.find(d => d.value === localSettings.density)?.scale || 1)}px`
                }}
              >
                Table Header
              </div>
              <div 
                className="text-slate-600"
                style={{ 
                  padding: `${4 * (DENSITY_LEVELS.find(d => d.value === localSettings.density)?.scale || 1)}px ${8 * (DENSITY_LEVELS.find(d => d.value === localSettings.density)?.scale || 1)}px`
                }}
              >
                Row content preview
              </div>
              <div 
                className="text-slate-600 border-t border-slate-100"
                style={{ 
                  padding: `${4 * (DENSITY_LEVELS.find(d => d.value === localSettings.density)?.scale || 1)}px ${8 * (DENSITY_LEVELS.find(d => d.value === localSettings.density)?.scale || 1)}px`
                }}
              >
                Another row here
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-slate-200 flex justify-between">
          <button
            onClick={handleReset}
            className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700"
          >
            Reset to Default
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 text-white text-[10px] font-bold rounded hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export { FONT_SIZES, DENSITY_LEVELS };
export default SettingsModal;

