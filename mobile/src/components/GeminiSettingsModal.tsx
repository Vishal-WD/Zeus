import React, { useState } from 'react';
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel
} from '../services/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sparkles, Key, Check, AlertCircle, X, Shield, Cpu, Volume2 } from 'lucide-react';

interface GeminiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function GeminiSettingsModal({
  isOpen,
  onClose,
  onSaved
}: GeminiSettingsModalProps) {
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [model, setModel] = useState(getStoredModel());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    setStoredApiKey(apiKey);
    setStoredModel(model);
    if (onSaved) onSaved();
    onClose();
  };

  const handleTestKey = async () => {
    if (!apiKey || apiKey.length < 10) {
      setTestResult({ success: false, message: 'Please enter a valid Google Gemini API Key.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const m = ai.getGenerativeModel({ model: model });
      const res = await m.generateContent('Say "Zeus OS India Grid Connected" in 5 words.');
      const text = res.response.text();
      setTestResult({
        success: true,
        message: `Connected successfully! Response: "${text.trim()}"`
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'API key verification failed. Check key & quota.'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl text-slate-100 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">
              Google Gemini In-Cabin Copilot Settings
            </h3>
            <p className="text-xs text-slate-400">
              Configure your Google AI Studio API key for live voice briefings across India.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-sm font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Keys are stored locally in your browser and never shared. Get one free at{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                aistudio.google.com
              </a>
              .
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              Gemini LLM Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-sm font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra-Fast In-Cabin Audio & Actions)</option>
              <option value="gemini-flash-latest">Gemini Flash Latest (Fast In-Cabin Realtime)</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Lightweight Low Latency)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Multi-Modal Reasoning)</option>
            </select>
          </div>

          {/* Key test output banner */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
                testResult.success
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testing}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Gemini Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
