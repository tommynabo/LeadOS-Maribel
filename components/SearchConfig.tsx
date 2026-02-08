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

export function SearchConfig({ config, onChange, onSearch, isSearching }: SearchConfigProps) {
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Generador Manual */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Generador Manual</h3>
              <p className="text-sm text-muted-foreground">Creación bajo demanda</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cantidad de Leads
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={config.maxResults}
                  onChange={(e) => onChange({ maxResults: parseInt(e.target.value) || 10 })}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  disabled={isSearching}
                />
                <span className="min-w-[3rem] text-center font-mono font-medium bg-secondary py-1 rounded-md">
                  {config.maxResults}
                </span>
              </div>
            </div>

            <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Objetivo:</span> {PROJECT_CONFIG.targets.icp}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onSearch}
          disabled={isSearching}
          className={`mt-6 w-full h-[48px] flex items-center justify-center rounded-lg font-bold text-sm transition-all shadow-lg shadow-primary/20 ${isSearching
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]'
            }`}
        >
          {isSearching ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Generando...</span>
            </div>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2 fill-current" />
              Generar Ahora
            </>
          )}
        </button>
      </div>

      {/* Piloto Automático */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden">
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
          <div className="text-center">
            <div className="text-5xl font-bold tracking-tighter mb-2 font-mono">
              {scheduleTime}
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hora de Ejecución</p>
          </div>

          <div className="w-full max-w-[200px]">
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full text-center bg-secondary/50 border border-input rounded-lg py-2 text-sm focus:ring-1 focus:ring-primary"
              disabled={!schedulerEnabled}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border">
          <span className="text-sm font-medium">Estado del Sistema</span>
          <button
            onClick={() => setSchedulerEnabled(!schedulerEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${schedulerEnabled ? 'bg-green-500' : 'bg-secondary'
              }`}
          >
            <span
              className={`${schedulerEnabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
      </div>

    </div>
  );
}
