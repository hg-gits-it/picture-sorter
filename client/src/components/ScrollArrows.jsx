import React from 'react';
import '../styles/scroll-arrows.css';

export default function ScrollArrows({ downRef }) {
  return (
    <div className="scroll-arrows">
      <button
        className="scroll-arrows-btn"
        title="Scroll to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        &#x2191;
      </button>
      <button
        className="scroll-arrows-btn"
        title="Scroll to bottom"
        onClick={() => {
          if (downRef?.current) {
            downRef.current.scrollIntoView({ behavior: 'smooth' });
          } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }
        }}
      >
        &#x2193;
      </button>
    </div>
  );
}
