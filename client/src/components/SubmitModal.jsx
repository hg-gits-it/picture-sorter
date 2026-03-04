import React, { useState, useRef, useEffect, useCallback } from 'react';
import { startSubmit } from '../api/photos.js';

export default function SubmitModal({ open, onClose }) {
  const [codename, setCodename] = useState('');
  const [state, setState] = useState('idle'); // idle | submitting | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState([]);
  const [resultMessage, setResultMessage] = useState('');
  const abortRef = useRef(null);
  const logEndRef = useRef(null);

  const addLog = useCallback((msg) => {
    setLog((prev) => [...prev, msg]);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // ESC to close (except during submission)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && state !== 'submitting') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, state, onClose]);

  // Cleanup on close
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  function handleSubmit() {
    if (!codename.trim()) return;

    setState('submitting');
    setLog([]);
    setProgress({ current: 0, total: 0 });
    setResultMessage('');

    const controller = new AbortController();
    abortRef.current = controller;

    startSubmit(codename.trim(), {
      signal: controller.signal,
      onMessage: (data) => {
        addLog(data.message);

        if (data.total) {
          setProgress({ current: data.current, total: data.total });
        }

        if (data.step === 'done') {
          setState('done');
          setResultMessage(data.message);
          abortRef.current = null;
        } else if (data.step === 'error') {
          setState('error');
          setResultMessage(data.message);
          abortRef.current = null;
        }
      },
      onError: () => {},
    }).catch((err) => {
      if (err.name === 'AbortError') return;
      setState('error');
      setResultMessage('Connection lost.');
      addLog('Connection lost.');
      abortRef.current = null;
    });
  }

  function handleClose() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState('idle');
    setLog([]);
    setProgress({ current: 0, total: 0 });
    setResultMessage('');
    onClose();
  }

  if (!open) return null;

  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div
      className="modal-overlay"
      onClick={state !== 'submitting' ? handleClose : undefined}
    >
      <div className="submit-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="submit-modal-title">Submit to Show</h2>

        {state === 'idle' && (
          <>
            <p className="submit-modal-desc">
              Submit your rated artworks (in ranked order) to the show.
            </p>
            <input
              className="submit-modal-input"
              type="text"
              placeholder="Enter your codename"
              value={codename}
              onChange={(e) => setCodename(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            <div className="submit-modal-buttons">
              <button className="submit-modal-cancel" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="submit-modal-submit"
                onClick={handleSubmit}
                disabled={!codename.trim()}
              >
                Submit
              </button>
            </div>
          </>
        )}

        {state === 'submitting' && (
          <>
            <div className="submit-progress-container">
              <div
                className="submit-progress-bar"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="submit-progress-text">
              {progress.total > 0
                ? `${progress.current} / ${progress.total} artworks`
                : 'Starting...'}
            </div>
            <div className="submit-log">
              {log.map((msg, i) => (
                <div key={i} className="submit-log-entry">
                  {msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </>
        )}

        {(state === 'done' || state === 'error') && (
          <>
            <div className={`submit-result-icon ${state}`}>
              {state === 'done' ? '\u2713' : '\u2717'}
            </div>
            <p className="submit-result-message">{resultMessage}</p>
            <div className="submit-log">
              {log.map((msg, i) => (
                <div key={i} className="submit-log-entry">
                  {msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            <div className="submit-modal-buttons">
              <button className="submit-modal-submit" onClick={handleClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
