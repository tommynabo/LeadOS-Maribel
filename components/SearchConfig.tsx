import React, { useState } from 'react';
import { Play, Zap, Clock, Calendar } from 'lucide-react';
import { SearchConfigState } from '../lib/types';
import { PROJECT_CONFIG } from '../config/project';

interface SearchConfigProps {
  config: SearchConfigState;
  onChange: (updates: Partial<SearchConfigState>) => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function SearchConfig({ config, onChange, onSearch, onStop, isSearching }: SearchConfigProps & { onStop: () => void }) {
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Helper to handle manual number input clearly
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > 50) val = 50;
    onChange({ maxResults: val });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Generador Manual */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between group hover:border-primary/20 transition-all">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Generador Manual</h3>
              <p className="text-sm text-muted-foreground">Creación bajo demanda</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cantidad de Leads
                </label>
                <div className="bg-secondary/50 rounded-md px-2 py-1">
                  <span className="text-xs font-mono text-muted-foreground">MAX: 50</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-secondary/20 p-2 rounded-xl border border-border/50">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={config.maxResults}
                  onChange={(e) => onChange({ maxResults: parseInt(e.target.value) || 10 })}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                  disabled={isSearching}
                />

                {/* Clickable Number Input */}
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.maxResults}
                  onChange={handleNumberChange}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-16 text-center font-bold text-lg bg-background border-2 border-input rounded-lg py-1 focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
                  disabled={isSearching}
                />
              </div>
            </div>

            <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Objetivo:</span> {PROJECT_CONFIG.targets.icp}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {isSearching ? (
            <button
              onClick={onStop}
              className="w-full h-[48px] flex items-center justify-center rounded-lg font-bold text-sm transition-all shadow-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 active:scale-[0.98]"
            >
              <div className="w-2 h-2 bg-red-500 rounded-sm animate-pulse mr-2" />
              DETENER GENERACIÓN
            </button>
          ) : (
            <button
              onClick={onSearch}
              className="w-full h-[48px] flex items-center justify-center rounded-lg font-bold text-sm transition-all shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              Generar Ahora
            </button>
          )}
        </div>
      </div>

      {/* Piloto Automático */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden group hover:border-green-500/20 transition-all">
        {/* Status Indicator */}
        <div className={`absolute top-0 right-0 p-6 transition-opacity ${schedulerEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${schedulerEnabled ? 'bg-green-500 text-green-500' : 'bg-gray-300 text-gray-300'}`} />
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className={`p-2 rounded-lg transition-colors ${schedulerEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-secondary'}`}>
            <Clock className={`w-5 h-5 ${schedulerEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Piloto Automático</h3>
            <p className="text-sm text-muted-foreground">Activo diariamente</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="text-center w-full">
            {/* Custom Time Display driven by the hidden input */}
            <div className="relative group/clock cursor-pointer">
              <div
                className={`text-6xl font-bold tracking-tight mb-2 transition-colors select-none ${schedulerEnabled ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                onClick={() => document.getElementById('time-picker')?.showPicker()}
              >
                {scheduleTime}
              </div>

              {/* Standard Time Input - Styled to look clean or hidden but accessible */}
              <input
                id="time-picker"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={!schedulerEnabled}
              />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-secondary/50 px-3 py-1 rounded-full inline-block group-hover/clock:bg-secondary transition-colors">
                Click para cambiar hora
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border">
          <span className="text-sm font-medium text-muted-foreground">Estado del Sistema</span>
          <button
            onClick={() => setSchedulerEnabled(!schedulerEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${schedulerEnabled ? 'bg-green-500 shadow-[0_0_15px_-3px_rgba(34,197,94,0.6)]' : 'bg-secondary'
              }`}
          >
            <span
              className={`${schedulerEnabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform`}
            />
          </button>
        </div>
      </div>

    </div>
  );
}
