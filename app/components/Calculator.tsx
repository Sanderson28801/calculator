'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { evaluateExpression } from '@/lib/calculator';
import { getRecentCalculations, saveCalculation, CalcRecord } from '@/lib/supabase';

export default function Calculator() {
  const [expression, setExpression] = useState<string>('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState<boolean>(false);

  const [history, setHistory] = useState<CalcRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Fetch recent calculations from Supabase
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setDbError(null);
    const { data, error: fetchErr } = await getRecentCalculations(10);
    if (fetchErr) {
      setDbError('Could not load history: ' + fetchErr.message);
    } else if (data) {
      setHistory(data);
    }
    setIsLoadingHistory(false);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      const { data, error: fetchErr } = await getRecentCalculations(10);
      if (!ignore) {
        if (fetchErr) {
          setDbError('Could not load history: ' + fetchErr.message);
        } else if (data) {
          setHistory(data);
        }
        setIsLoadingHistory(false);
      }
    }
    fetchInitial();
    return () => {
      ignore = true;
    };
  }, []);

  // Input handling
  const handleInput = useCallback((val: string) => {
    setError(null);

    setExpression((prev) => {
      // If we just pressed "=", typing an operator continues with the previous result
      if (justEvaluated && lastResult !== null) {
        setJustEvaluated(false);
        if (['+', '-', '×', '÷', '*', '/'].includes(val)) {
          return `${lastResult} ${val} `;
        } else {
          return val;
        }
      }

      setJustEvaluated(false);

      // Add nice spacing around binary operators for readability
      if (['+', '-', '×', '÷'].includes(val)) {
        // Avoid duplicate consecutive operators (e.g. replacing the last operator if pressed consecutively)
        const trimmed = prev.trimEnd();
        const lastChar = trimmed.slice(-1);
        if (['+', '-', '×', '÷', '*', '/'].includes(lastChar)) {
          // If previous was an operator and we press another, replace it unless unary minus is allowed
          if (val === '-' && lastChar !== '-') {
            return `${prev} -`;
          }
          return `${trimmed.slice(0, -1)} ${val} `;
        }
        return `${prev.length === 0 ? '' : prev} ${val} `;
      }

      return prev + val;
    });
  }, [justEvaluated, lastResult]);

  // Clear input
  const handleClear = useCallback(() => {
    setExpression('');
    setError(null);
    setJustEvaluated(false);
    setLastResult(null);
  }, []);

  // Backspace
  const handleBackspace = useCallback(() => {
    setError(null);
    if (justEvaluated) {
      setJustEvaluated(false);
    }
    setExpression((prev) => {
      if (prev.length === 0) return '';
      // If trailing whitespace, remove whitespace + operator
      const trimmed = prev.trimEnd();
      if (trimmed.length < prev.length) {
        return trimmed.slice(0, -1).trimEnd();
      }
      return prev.slice(0, -1);
    });
  }, [justEvaluated]);

  // Evaluate expression
  const handleEvaluate = useCallback(async () => {
    if (!expression.trim()) return;

    setError(null);
    try {
      const cleanExpr = expression.replace(/×/g, '*').replace(/÷/g, '/');
      const calculated = evaluateExpression(cleanExpr);

      setLastResult(calculated);
      setJustEvaluated(true);

      // Save to Supabase
      setIsSaving(true);
      const { data: savedRecord, error: saveErr } = await saveCalculation(expression.trim(), calculated);
      setIsSaving(false);

      if (saveErr) {
        setDbError('Calculation evaluated, but failed to save to Supabase: ' + saveErr.message);
      } else if (savedRecord) {
        // Optimistically update history list with newest first, maintaining max 10
        setHistory((prev) => [savedRecord, ...prev.filter((r) => r.id !== savedRecord.id)].slice(0, 10));
      }
    } catch (err) {
      // Show error on screen and skip saving to Supabase
      const message = err instanceof Error ? err.message : 'Invalid Expression';
      setError(message);
    }
  }, [expression]);

  // Recall result or expression from history
  const handleRecall = useCallback((val: string) => {
    setExpression(val);
    setError(null);
    setJustEvaluated(false);
    setLastResult(val);
  }, []);

  // Keyboard navigation
  const inputHandlerRef = useRef({ handleInput, handleClear, handleBackspace, handleEvaluate });
  useEffect(() => {
    inputHandlerRef.current = { handleInput, handleClear, handleBackspace, handleEvaluate };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is focused inside an input/textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const { handleInput, handleClear, handleBackspace, handleEvaluate } = inputHandlerRef.current;

      if (e.key >= '0' && e.key <= '9') {
        handleInput(e.key);
      } else if (e.key === '.') {
        handleInput('.');
      } else if (e.key === '+') {
        e.preventDefault();
        handleInput('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleInput('-');
      } else if (e.key === '*') {
        e.preventDefault();
        handleInput('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleInput('÷');
      } else if (e.key === '(' || e.key === ')') {
        handleInput(e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEvaluate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6">
      {/* Calculator Body */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm text-slate-100">
        {/* Header Indicator */}
        <div className="flex items-center justify-between pb-3 text-xs text-slate-400 font-mono tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            READY
          </span>
          <span className="text-[11px] uppercase tracking-widest text-slate-400">Standard / PEMDAS</span>
        </div>

        {/* Display Screen */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 mb-5 flex flex-col justify-end min-h-[108px] text-right overflow-hidden shadow-inner">
          {/* Formula Line */}
          <div className="text-sm font-mono text-slate-400 truncate h-5">
            {justEvaluated ? `${expression} =` : expression || '\u00A0'}
          </div>

          {/* Main Value or Error Line */}
          <div className="mt-1">
            {error ? (
              <div className="text-rose-400 font-mono text-xl sm:text-2xl font-semibold tracking-tight truncate flex items-center justify-end gap-2 animate-shake">
                <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
                  ERROR
                </span>
                {error}
              </div>
            ) : (
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-white truncate">
                {justEvaluated && lastResult !== null
                  ? lastResult
                  : expression.split(' ').pop() || '0'}
              </div>
            )}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {/* Row 1: Clear, Backspace, Parens */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 font-semibold text-lg transition border border-amber-500/30 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Clear all"
            title="Clear (Esc or C)"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-medium text-lg transition border border-slate-700/60 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Backspace"
            title="Backspace"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={() => handleInput('(')}
            className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-medium text-lg transition border border-slate-700/60 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Left parenthesis"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => handleInput(')')}
            className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-medium text-lg transition border border-slate-700/60 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Right parenthesis"
          >
            )
          </button>

          {/* Row 2: 7, 8, 9, ÷ */}
          <button
            type="button"
            onClick={() => handleInput('7')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleInput('8')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleInput('9')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleInput('÷')}
            className="h-14 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 active:scale-95 text-indigo-300 font-semibold text-2xl transition border border-indigo-500/40 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Divide"
          >
            ÷
          </button>

          {/* Row 3: 4, 5, 6, × */}
          <button
            type="button"
            onClick={() => handleInput('4')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleInput('5')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleInput('6')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleInput('×')}
            className="h-14 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 active:scale-95 text-indigo-300 font-semibold text-2xl transition border border-indigo-500/40 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Multiply"
          >
            ×
          </button>

          {/* Row 4: 1, 2, 3, - */}
          <button
            type="button"
            onClick={() => handleInput('1')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleInput('2')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleInput('3')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleInput('-')}
            className="h-14 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 active:scale-95 text-indigo-300 font-semibold text-2xl transition border border-indigo-500/40 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Minus"
          >
            -
          </button>

          {/* Row 5: 0, ., =, + */}
          <button
            type="button"
            onClick={() => handleInput('0')}
            className="h-14 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleInput('.')}
            className="h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-medium text-xl transition border border-slate-700/50 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Decimal point"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={isSaving}
            className="h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-2xl transition border border-emerald-400/30 flex items-center justify-center cursor-pointer shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            aria-label="Equals"
            title="Calculate (Enter or =)"
          >
            {isSaving ? '…' : '='}
          </button>
          <button
            type="button"
            onClick={() => handleInput('+')}
            className="h-14 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 active:scale-95 text-indigo-300 font-semibold text-2xl transition border border-indigo-500/40 flex items-center justify-center cursor-pointer shadow-sm"
            aria-label="Plus"
          >
            +
          </button>
        </div>

        {/* Keyboard Helper Note */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Keyboard ready: type numbers, operators, <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 text-[11px]">Enter</kbd> to solve, <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 text-[11px]">Esc</kbd> to clear.
        </div>
      </div>

      {/* Supabase Error Alert if Any */}
      {dbError && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
          <span>{dbError}</span>
          <button
            type="button"
            onClick={() => setDbError(null)}
            className="text-amber-400 hover:text-amber-200 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* History Section: Last 10 Calculations */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-sm text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-200">Recent Calculations</h2>
            <span className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
              Last 10
            </span>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Refresh history"
          >
            <span className={isLoadingHistory ? 'animate-spin inline-block' : ''}>↻</span>
            {isLoadingHistory ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <p className="text-xs text-slate-400 pt-2 pb-3">
          Click any calculation below to recall its result into the calculator.
        </p>

        {/* History List */}
        <div className="flex flex-col gap-2">
          {isLoadingHistory && history.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <span className="animate-spin text-xl">⏳</span>
              <span>Loading calculations from Supabase...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No calculations saved yet. Evaluate an expression to save it here!
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleRecall(item.result)}
                className="group w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-indigo-950/30 border border-slate-800/80 hover:border-indigo-500/40 transition text-left cursor-pointer"
                title={`Click to recall result "${item.result}"`}
              >
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-mono text-sm text-slate-400 group-hover:text-slate-300 truncate">
                    {item.expression} =
                  </span>
                  <span className="font-mono text-base font-bold text-indigo-300 group-hover:text-indigo-200">
                    {item.result}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="text-xs opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity">
                    ↵
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
