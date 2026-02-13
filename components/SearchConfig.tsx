import React, { useState } from 'react';
import { Play, Zap, Clock, Calendar, SlidersHorizontal, X } from 'lucide-react';
import { SearchConfigState } from '../lib/types';
import { PROJECT_CONFIG } from '../config/project';

interface SearchConfigProps {
  config: SearchConfigState;
  onChange: (updates: Partial<SearchConfigState>) => void;
  onSearch: () => void;
  isSearching: boolean;
  // Autopilot props
  autopilotEnabled: boolean;
  autopilotTime: string;
  autopilotQuantity: number;
  onAutopilotToggle: (enabled: boolean) => void;
  onAutopilotTimeChange: (time: string) => void;
  onAutopilotQuantityChange: (quantity: number) => void;
  autopilotRanToday: boolean;
}

export function SearchConfig({ config, onChange, onSearch, onStop, isSearching, autopilotEnabled, autopilotTime, autopilotQuantity, onAutopilotToggle, onAutopilotTimeChange, onAutopilotQuantityChange, autopilotRanToday }: SearchConfigProps & { onStop: () => void }) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);

  // Helper to handle manual number input clearly
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > 50) val = 50;
    onChange({ maxResults: val });
  };

  // Generate hours (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // Generate minutes (00, 15, 30, 45) for cleaner UI
  const minutes = ['00', '15', '30', '45'];

  const handleTimeSelect = (type: 'hour' | 'minute', value: string) => {
    const [h, m] = autopilotTime.split(':');
    if (type === 'hour') {
      onAutopilotTimeChange(`${value}:${m}`);
    } else {
      onAutopilotTimeChange(`${h}:${value}`);
    }
  };

  return (
    <div className="space-y-4">

      {/* Criteria Button Row */}
      <div className="flex justify-end relative">
        <button
          onClick={() => setShowCriteria(!showCriteria)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Criterio
        </button>

        {/* Criteria Popup */}
        {showCriteria && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCriteria(false)}
            />
            
            {/* Modal Dialog */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/20 px-8 py-6 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-2xl text-foreground">🎯 Criterios de Búsqueda</h4>
                    <p className="text-sm text-muted-foreground mt-2">Personaliza los parámetros exactos de tu búsqueda de leads</p>
                  </div>
                  <button
                    onClick={() => setShowCriteria(false)}
                    className="p-2 hover:bg-destructive/20 rounded-lg transition-all hover:text-destructive flex-shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="bg-card border border-border/50 flex-1 overflow-y-auto p-8 scrollbar-thin space-y-6">
              {/* ICP / Query */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-bold text-primary uppercase tracking-wider block mb-3">
                    🎯 Perfil Objetivo (ICP)
                  </label>
                  <textarea
                    value={config.query}
                    onChange={(e) => onChange({ query: e.target.value })}
                    rows={4}
                    className="w-full text-base bg-background border-2 border-input rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                    placeholder="Ej: Mujeres directivas, +40 años, experiencia en tech, buscando marca personal..."
                  />
                </div>
                <p className="text-sm text-muted-foreground">Describe detalladamente el perfil ideal de tu lead objetivo.</p>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-primary uppercase tracking-wider block">
                  📍 Ubicación
                </label>
                <input
                  type="text"
                  value={config.customLocation || PROJECT_CONFIG.targets.locations.join(', ')}
                  onChange={(e) => onChange({ customLocation: e.target.value })}
                  className="w-full text-base bg-background border-2 border-input rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  placeholder="Madrid, Barcelona, Valencia..."
                />
                <p className="text-sm text-muted-foreground">Ciudades o regiones donde deseas buscar (separadas por comas).</p>
              </div>

              {/* Target Roles */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-primary uppercase tracking-wider block">
                  👔 Cargos Objetivo
                </label>
                <input
                  type="text"
                  value={config.customRoles || ''}
                  onChange={(e) => onChange({ customRoles: e.target.value })}
                  className="w-full text-base bg-background border-2 border-input rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  placeholder="CEO, Fundadora, Directora, Autora, Speaker..."
                />
                <p className="text-sm text-muted-foreground">Posiciones o roles clave que buscas (separados por comas).</p>
              </div>

              {/* Search Mode */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-primary uppercase tracking-wider block">
                  ⚡ Modo de Búsqueda
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => onChange({ mode: 'fast' })}
                    className={`flex-1 text-sm font-bold py-3 px-4 rounded-lg border-2 transition-all ${
                      config.mode === 'fast'
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                        : 'border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-border'
                    }`}
                  >
                    ⚡ Rápido
                  </button>
                  <button
                    onClick={() => onChange({ mode: 'deep' })}
                    className={`flex-1 text-sm font-bold py-3 px-4 rounded-lg border-2 transition-all ${
                      config.mode === 'deep'
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                        : 'border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-border'
                    }`}
                  >
                    🔍 Profundo
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Rápido:</span> búsqueda estándar (recomendado)  
                  <br />
                  <span className="font-semibold">Profundo:</span> análisis completo con investigación (más lento)
                </p>
              </div>

              {/* Reset to defaults */}
              <button
                onClick={() => {
                  onChange({
                    query: PROJECT_CONFIG.targets.icp,
                    customLocation: undefined,
                    customRoles: undefined,
                    mode: 'fast'
                  });
                }}
                className="w-full text-sm font-bold text-primary-foreground bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 py-3 px-4 border-2 border-primary/50 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                ↺ Restaurar valores por defecto
              </button>
            </div>
            </div>
          </>
        )}
      </div>

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
        <div className={`absolute top-0 right-0 p-6 transition-opacity ${autopilotEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${autopilotEnabled ? 'bg-green-500 text-green-500' : 'bg-gray-300 text-gray-300'}`} />
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className={`p-2 rounded-lg transition-colors ${autopilotEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-secondary'}`}>
            <Clock className={`w-5 h-5 ${autopilotEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Piloto Automático</h3>
            <p className="text-sm text-muted-foreground">{autopilotEnabled ? (autopilotRanToday ? 'Ejecutado hoy ✅' : 'Activo diariamente') : 'Desactivado'}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6 relative">
          <div className="text-center w-full z-10">
            {/* Time Display Trigger */}
            <div
              className={`relative cursor-pointer transition-all ${autopilotEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'
                }`}
              onClick={() => { onAutopilotToggle(true); setShowTimePicker(!showTimePicker); }}
            >
              <div
                className="text-6xl font-bold tracking-tight mb-2 select-none hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  if (autopilotEnabled) setShowTimePicker(!showTimePicker);
                }}
              >
                {autopilotTime}
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-secondary/50 px-3 py-1 rounded-full inline-block group-hover:bg-secondary transition-colors">
                {showTimePicker ? 'Cerrar Selector' : 'Cambiar Hora'}
              </p>

              {/* Custom Dropdown Picker */}
              {showTimePicker && autopilotEnabled && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl p-4 flex gap-4 z-50 animate-in fade-in zoom-in-95 duration-200 min-w-[200px]">

                  {/* Hours Column */}
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted-foreground mb-2 block uppercase text-center">Hora</span>
                    <div className="h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-secondary pr-2">
                      {hours.map(h => (
                        <button
                          key={h}
                          onClick={() => handleTimeSelect('hour', h)}
                          className={`w-full py-1.5 rounded-md text-sm font-medium transition-colors ${autopilotTime.startsWith(h)
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-secondary'
                            }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-[1px] bg-border my-2" />

                  {/* Minutes Column */}
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted-foreground mb-2 block uppercase text-center">Min</span>
                    <div className="h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-secondary">
                      {minutes.map(m => (
                        <button
                          key={m}
                          onClick={() => handleTimeSelect('minute', m)}
                          className={`w-full py-1.5 rounded-md text-sm font-medium transition-colors ${autopilotTime.endsWith(m)
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-secondary'
                            }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Backdrop to close picker */}
          {showTimePicker && (
            <div
              className="fixed inset-0 z-0 bg-transparent"
              onClick={() => setShowTimePicker(false)}
            />
          )}
        </div>

        {/* Quantity Selector — mirrors the Manual Generator */}
        <div className={`mt-6 space-y-3 transition-opacity ${autopilotEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
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
              value={autopilotQuantity}
              onChange={(e) => onAutopilotQuantityChange(parseInt(e.target.value) || 10)}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-all"
              disabled={!autopilotEnabled}
            />

            <input
              type="number"
              min="1"
              max="50"
              value={autopilotQuantity}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 1;
                if (val < 1) val = 1;
                if (val > 50) val = 50;
                onAutopilotQuantityChange(val);
              }}
              onClick={(e) => e.currentTarget.select()}
              className="w-16 text-center font-bold text-lg bg-background border-2 border-input rounded-lg py-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-sm"
              disabled={!autopilotEnabled}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between pt-6 border-t border-border relative z-0">
          <span className="text-sm font-medium text-muted-foreground">Estado del Sistema</span>
          <button
            onClick={() => onAutopilotToggle(!autopilotEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${autopilotEnabled ? 'bg-green-500 shadow-[0_0_15px_-3px_rgba(34,197,94,0.6)]' : 'bg-secondary'
              }`}
          >
            <span
              className={`${autopilotEnabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform`}
            />
          </button>
        </div>
      </div>

    </div>
    </div>
  );
}
