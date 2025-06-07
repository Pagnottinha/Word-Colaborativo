import React, { useState, useEffect } from 'react';
import { FiShare2, FiX, FiUserPlus, FiUsers, FiEdit3, FiEye, FiTrash2 } from 'react-icons/fi';
import socketService from '../services/socketService';

const ShareModal = ({ document, isOpen, onClose }) => {
  const [shareEmail, setShareEmail] = useState('');
  const [permissionType, setPermissionType] = useState('read');
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && document) {
      loadShares();
      // Escutar eventos de compartilhamento
      const handleDocumentShared = (data) => {
        setSuccess(data.message);
        setShareEmail('');
        setLoading(false);
        loadShares();
        setTimeout(() => setSuccess(''), 3000);
      };

      const handleDocumentUnshared = (data) => {
        setSuccess(data.message);
        setLoading(false);
        loadShares();
        setTimeout(() => setSuccess(''), 3000);
      };

      const handleDocumentShares = (data) => {
        setShares(data.shares);
        setLoading(false);
      };

      const handleDocumentError = (data) => {
        setError(data.error);
        setLoading(false);
        setTimeout(() => setError(''), 3000);
      };

      socketService.socket.on('document-shared', handleDocumentShared);
      socketService.socket.on('document-unshared', handleDocumentUnshared);
      socketService.socket.on('document-shares', handleDocumentShares);
      socketService.socket.on('document-error', handleDocumentError);

      return () => {
        socketService.socket.off('document-shared', handleDocumentShared);
        socketService.socket.off('document-unshared', handleDocumentUnshared);
        socketService.socket.off('document-shares', handleDocumentShares);
        socketService.socket.off('document-error', handleDocumentError);
      };
    }
  }, [isOpen, document]);

  const loadShares = () => {
    if (document) {
      setLoading(true);
      socketService.socket.emit('get-document-shares', { documentId: document.id });
    }
  };

  const handleShare = (e) => {
    e.preventDefault();
    const email = shareEmail.trim();

    if (!email) {
      setError('Digite um email');
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, digite um email válido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verificar se não estamos compartilhando com um usuário que já tem acesso
      const alreadyShared = shares.some(share =>
        share.email && share.email.toLowerCase() === email.toLowerCase()
      );

      if (alreadyShared) {
        setError(`O usuário "${email}" já tem acesso a este documento`);
        setLoading(false);
        return;
      }
      socketService.shareDocument(
        document.id,
        email,
        permissionType
      );

      // Não mostrar mensagem de sucesso aqui - aguardar resposta do servidor
    } catch (err) {
      setError('Erro ao compartilhar: ' + (err.message || 'Falha na conexão'));
      setLoading(false);
    }
  };

  const handleUnshare = (email) => {
    setLoading(true);

    try {
      // Não mostrar mensagem de sucesso aqui - aguardar resposta do servidor
      socketService.unshareDocument(document.id, email);
    } catch (err) {
      setError('Erro ao remover acesso: ' + (err.message || 'Falha na conexão'));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FiShare2 size={20} />
            <h3>Compartilhar Documento</h3>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="document-info">
            <h4>{document?.title}</h4>
            <p>Gerencie quem pode acessar e editar este documento</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <form onSubmit={handleShare} className="share-form">
            <div className="form-group">
              <label>Compartilhar com usuário:</label>
              <div className="share-input-group">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="Email do usuário"
                  className="share-input"
                />
                <select
                  value={permissionType}
                  onChange={(e) => setPermissionType(e.target.value)}
                  className="permission-select"
                >
                  <option value="read">Apenas leitura</option>
                  <option value="write">Pode editar</option>
                </select>
                <button
                  type="submit"
                  className="btn-primary share-btn"
                  disabled={loading}
                >
                  <FiUserPlus size={16} />
                  {loading ? 'Compartilhando...' : 'Compartilhar'}
                </button>
              </div>
            </div>
          </form>

          <div className="shares-list">
            <div className="shares-header">
              <FiUsers size={16} />
              <h4>Usuários com acesso ({shares.length})</h4>
            </div>

            {loading && shares.length === 0 ? (
              <div className="loading">Carregando...</div>
            ) : shares.length === 0 ? (
              <div className="no-shares">
                <p>Nenhum usuário foi adicionado ainda.</p>
              </div>
            ) : (
              <div className="shares-items">
                {shares.map((share, index) => (
                  <div key={index} className="share-item">
                    <div className="share-user">
                      <div className="user-avatar">
                        {(share.email || share.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <span className="username">{share.username}</span>
                        {share.email && <span className="user-email">{share.email}</span>}
                        <span className="share-date">
                          Adicionado em {new Date(share.granted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="share-permission">
                      <div className="permission-badge">
                        {share.permission_type === 'write' ? (
                          <>
                            <FiEdit3 size={14} />
                            Pode editar
                          </>
                        ) : (
                          <>
                            <FiEye size={14} />
                            Apenas leitura
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => handleUnshare(share.email || share.username)}
                        className="btn-danger-small"
                        title="Remover acesso"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
