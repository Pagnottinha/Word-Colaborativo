import { useState, useEffect } from 'react';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import DocumentsList from './components/DocumentsList';
import DocumentEditor from './components/DocumentEditor';
import AuthModal from './components/AuthModal';
import { setCurrentDocument } from './store/slices/documentSlice';
import { logoutUser } from './store/slices/authSlice';
import socketService from './services/socketService';
import { FiLogOut, FiUser } from 'react-icons/fi';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'editor'
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const currentDocument = useSelector((state) => state.document.currentDocument);

  // React to current document changes
  useEffect(() => {
    if (currentDocument && currentView === 'list') {
      setSelectedDocument(currentDocument);
      setCurrentView('editor');
    }
  }, [currentDocument, currentView]);

  useEffect(() => {
    // Connect to WebSocket server
    socketService.connect(store);

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleDocumentSelect = (document) => {
    console.log('handleDocumentSelect called with:', document);
    setSelectedDocument(document);
    store.dispatch(setCurrentDocument(document));
    setCurrentView('editor');
  };

  const handleNewDocument = (document) => {
    console.log('handleNewDocument called with:', document);
    setSelectedDocument(document);
    store.dispatch(setCurrentDocument(document));
    setCurrentView('editor');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedDocument(null);
    store.dispatch(setCurrentDocument(null));
  };

  const handleLogout = () => {
    store.dispatch(logoutUser());
    setCurrentView('list');
    setSelectedDocument(null);
    store.dispatch(setCurrentDocument(null));
    socketService.disconnect();
    socketService.connect(store);
  };

  // Show auth modal if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [isAuthenticated]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>📝 Word Colaborativo</h1>
            <p>Editor de documentos em tempo real</p>
          </div>
          
          {isAuthenticated && (
            <div className="header-right">
              <div className="user-info">
                <FiUser size={16} />
                <span>{user?.username}</span>
              </div>
              <button 
                className="btn-secondary logout-btn"
                onClick={handleLogout}
                title="Sair"
              >
                <FiLogOut size={16} />
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {isAuthenticated ? (
          currentView === 'list' ? (
            <DocumentsList 
              onDocumentSelect={handleDocumentSelect}
              onNewDocument={handleNewDocument}
            />
          ) : (
            <DocumentEditor 
              document={selectedDocument}
              onBack={handleBackToList}
            />
          )
        ) : (
          <div className="auth-required">
            <div className="auth-required-content">
              <h2>Bem-vindo ao Word Colaborativo</h2>
              <p>Faça login para começar a criar e editar documentos em tempo real.</p>
              <button 
                className="btn-primary"
                onClick={() => setShowAuthModal(true)}
              >
                Fazer Login
              </button>
            </div>
          </div>
        )}
      </main>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
