import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ShowtimePage from './components/ShowtimePage.jsx';
import LoginPage from './components/LoginPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import './styles/app.css';

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  const isShowtime = window.location.pathname === '/showtime';

  if (isShowtime) {
    if (!user.isAdmin) {
      return <div className="access-denied">Admin access required for showtime mode.</div>;
    }
    return <ShowtimePage />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
