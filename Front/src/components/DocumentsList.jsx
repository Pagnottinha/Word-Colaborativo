import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiPlus, FiFileText, FiEdit3, FiLock, FiGlobe, FiUsers, FiShare2, FiTrash2, FiMoreVertical } from 'react-icons/fi';
import socketService from '../services/socketService';
import { setLoading } from '../store/slices/documentsSlice';

const DocumentsList = ({ onDocumentSelect }) => {
  const dispatch = useDispatch();
  const { ownDocuments, sharedDocuments, publicDocuments, isLoading, error } = useSelector(state => state.documents); const [newDocTitle, setNewDocTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showNewDocForm, setShowNewDocForm] = useState(false); const [deleteConfirm, setDeleteConfirm] = useState(null); // ID do documento para confirmar deleção

  useEffect(() => {
    // Load documents when component mounts
    dispatch(setLoading(true));

    // Small delay to ensure WebSocket connection is established
    const loadTimer = setTimeout(() => {
      socketService.getDocuments();
    }, 100);

    return () => clearTimeout(loadTimer);
  }, [dispatch]);

  const handleCreateDocument = (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    socketService.createDocument(newDocTitle, '', isPublic);
    setNewDocTitle('');
    setIsPublic(false);
    setShowNewDocForm(false);
  }; 
  
  const handleDeleteDocument = (documentId) => {
    if (deleteConfirm === documentId) {
      // Confirmar deleção
      socketService.deleteDocument(documentId);
      setDeleteConfirm(null);
    } else {
      // Solicitar confirmação
      setDeleteConfirm(documentId);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'Data não disponível';
    }

    const date = new Date(dateString);

    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return 'Data inválida';
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="documents-list loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Carregando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="documents-list">
      <div className="documents-header">
        <h2>
          <FiFileText size={24} />
          Meus Documentos
        </h2>
        <button
          className="btn-primary"
          onClick={() => setShowNewDocForm(true)}
        >
          <FiPlus size={16} />
          Novo Documento
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      {showNewDocForm && (
        <div className="new-document-form">
          <form onSubmit={handleCreateDocument}>
            <input
              type="text"
              placeholder="Nome do documento"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              autoFocus
            />
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span className="checkbox-text">Documento público</span>
                <small className="checkbox-help">Documentos públicos podem ser visualizados por outros usuários</small>
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Criar
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowNewDocForm(false);
                  setNewDocTitle('');
                  setIsPublic(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="documents-grid">
        {/* Seção de Documentos Próprios */}
        {ownDocuments.length > 0 && (
          <div className="documents-section">
            <div className="section-header">
              <h3><FiEdit3 size={20} /> Meus Documentos</h3>
            </div>
            <div className="documents-cards">
              {ownDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="document-card own-document"
                >
                  <div className="document-header">
                    <div className="document-status">
                      {doc.is_public ? <FiGlobe size={16} title="Documento Público" /> : <FiLock size={16} title="Documento Privado" />}
                    </div>
                    <div className="document-actions">
                      {deleteConfirm === doc.id ? (
                        <>
                          <button
                            className="btn-danger-small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDocument(doc.id, doc.title);
                            }}
                            title="Confirmar deleção"
                          >
                            <FiTrash2 size={14} />
                          </button>
                          <button
                            className="btn-secondary-small"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelDelete();
                            }}
                            title="Cancelar"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-danger-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id, doc.title);
                          }}
                          title="Deletar documento"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="document-content"
                    onClick={() => {
                      console.log('Document card clicked:', doc);
                      onDocumentSelect(doc);
                    }}
                  >
                    <h3>{doc.title}</h3>
                    <p className="document-date">
                      Atualizado em {formatDate(doc.updated_at)}
                    </p>
                    <p className="document-date">
                      Criado em {formatDate(doc.created_at)}
                    </p>
                    {deleteConfirm === doc.id && (
                      <div className="delete-warning">
                        <small>Clique novamente para confirmar a deleção</small>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção de Documentos Compartilhados */}
        {sharedDocuments.length > 0 && (
          <div className="documents-section">
            <div className="section-header">
              <h3><FiShare2 size={20} /> Compartilhados Comigo</h3>
            </div>
            <div className="documents-cards">
              {sharedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="document-card shared-document"
                  onClick={() => {
                    console.log('Shared document card clicked:', doc);
                    onDocumentSelect(doc);
                  }}
                >
                  <div className="document-header">
                    <FiShare2 size={16} title={`Compartilhado - ${doc.permission_type === 'write' ? 'Pode editar' : 'Apenas leitura'}`} />
                    <span className="permission-indicator">
                      {doc.permission_type === 'write' ? 'Editar' : 'Leitura'}
                    </span>
                  </div>
                  <h3>{doc.title}</h3>
                  <p className="document-owner">Por: {doc.owner_username}</p>
                  <p className="document-date">
                    Compartilhado em {formatDate(doc.granted_at)}
                  </p>
                  <p className="document-date">
                    Atualizado em {formatDate(doc.updated_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção de Documentos Públicos */}
        {publicDocuments.length > 0 && (
          <div className="documents-section">
            <div className="section-header">
              <h3><FiUsers size={20} /> Documentos Públicos</h3>
            </div>
            <div className="documents-cards">
              {publicDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="document-card public-document"
                  onClick={() => {
                    console.log('Public document card clicked:', doc);
                    onDocumentSelect(doc);
                  }}
                >
                  <div className="document-header">
                    <FiGlobe size={16} title="Documento Público" />
                  </div>
                  <h3>{doc.title}</h3>
                  <p className="document-owner">Por: {doc.owner_username}</p>
                  <p className="document-date">
                    Atualizado em {formatDate(doc.updated_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Estado vazio */}
        {ownDocuments.length === 0 && sharedDocuments.length === 0 && publicDocuments.length === 0 && (
          <div className="empty-state">
            <FiFileText size={48} />
            <h3>Nenhum documento encontrado</h3>
            <p>Crie seu primeiro documento para começar</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsList;
