import { useState } from 'react';
import { FiX, FiTrash2, FiGlobe, FiLock, FiAlertTriangle } from 'react-icons/fi';
import socketService from '../services/socketService';

const SettingsModal = ({ document, isOpen, onClose, onDocumentUpdated, onDocumentDeleted }) => {
    const [isPublic, setIsPublic] = useState(document?.is_public || false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen || !document) return null;    const handleVisibilityChange = async (newIsPublic) => {
        setIsLoading(true);
        try {
            // Usar WebSocket em vez de HTTP
            socketService.emit('toggle-document-visibility', {
                documentId: document.id,
                isPublic: newIsPublic
            });

            // Aguardar resposta do WebSocket
            const handleVisibilityUpdated = (data) => {
                if (data.documentId === document.id) {
                    setIsPublic(newIsPublic);
                    onDocumentUpdated({ ...document, is_public: newIsPublic });
                    setIsLoading(false);
                    
                    // Remover listener após uso
                    socketService.off('document-visibility-updated', handleVisibilityUpdated);
                }
            };

            const handleError = (error) => {
                console.error('Erro ao alterar visibilidade:', error);
                setIsLoading(false);
                
                // Remover listeners após erro
                socketService.off('document-visibility-updated', handleVisibilityUpdated);
                socketService.off('document-error', handleError);
            };

            // Adicionar listeners temporários
            socketService.on('document-visibility-updated', handleVisibilityUpdated);
            socketService.on('document-error', handleError);

        } catch (error) {
            console.error('Erro ao alterar visibilidade:', error);
            setIsLoading(false);
        }
    };    const handleDeleteDocument = async () => {
        setIsLoading(true);
        try {
            // Usar WebSocket em vez de HTTP
            socketService.emit('delete-document', {
                documentId: document.id
            });

            // Aguardar resposta do WebSocket
            const handleDocumentDeleted = (data) => {
                if (data.documentId === document.id) {
                    console.log('Documento deletado com sucesso');
                    onDocumentDeleted(document.id);
                    onClose();
                    setIsLoading(false);
                    
                    // Remover listener após uso
                    socketService.off('document-deleted', handleDocumentDeleted);
                }
            };

            const handleError = (error) => {
                console.error('Erro ao deletar documento:', error);
                setIsLoading(false);
                
                // Remover listeners após erro
                socketService.off('document-deleted', handleDocumentDeleted);
                socketService.off('document-error', handleError);
            };

            // Adicionar listeners temporários
            socketService.on('document-deleted', handleDocumentDeleted);
            socketService.on('document-error', handleError);

        } catch (error) {
            console.error('Erro ao deletar documento:', error);
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Configurações do Documento</h3>
                    <button className="modal-close" onClick={onClose}>
                        <FiX size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Seção de Visibilidade */}
                    <div className="settings-section">
                        <h4>Visibilidade do Documento</h4>
                        <p className="settings-description">
                            Controle quem pode visualizar este documento
                        </p>
                        
                        <div className="visibility-options">
                            <label className={`visibility-option ${!isPublic ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={!isPublic}
                                    onChange={() => handleVisibilityChange(false)}
                                    disabled={isLoading}
                                />
                                <div className="option-content">
                                    <FiLock size={20} />
                                    <div>
                                        <strong>Privado</strong>
                                        <p>Apenas você e pessoas com quem compartilhar podem ver</p>
                                    </div>
                                </div>
                            </label>

                            <label className={`visibility-option ${isPublic ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="visibility"
                                    checked={isPublic}
                                    onChange={() => handleVisibilityChange(true)}
                                    disabled={isLoading}
                                />
                                <div className="option-content">
                                    <FiGlobe size={20} />
                                    <div>
                                        <strong>Público</strong>
                                        <p>Qualquer pessoa pode visualizar este documento</p>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Seção de Ações Perigosas */}
                    <div className="settings-section danger-section">
                        <h4>Zona de Perigo</h4>
                        <p className="settings-description">
                            Ações irreversíveis que afetam permanentemente este documento
                        </p>
                        
                        {!showDeleteConfirm ? (
                            <button
                                className="btn-danger"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isLoading}
                            >
                                <FiTrash2 size={16} />
                                Deletar Documento
                            </button>
                        ) : (
                            <div className="delete-confirm">
                                <div className="confirm-message">
                                    <FiAlertTriangle size={20} />
                                    <div>
                                        <strong>Tem certeza que deseja deletar este documento?</strong>
                                        <p>Esta ação não pode ser desfeita. O documento será permanentemente removido.</p>
                                    </div>
                                </div>
                                <div className="confirm-actions">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={handleDeleteDocument}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Deletando...' : 'Confirmar Exclusão'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
