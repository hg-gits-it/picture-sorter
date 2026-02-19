import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ShowtimePage from './components/ShowtimePage.jsx';
import './styles/app.css';

const isShowtime = window.location.pathname === '/showtime';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isShowtime ? <ShowtimePage /> : <App />}
  </React.StrictMode>
);
