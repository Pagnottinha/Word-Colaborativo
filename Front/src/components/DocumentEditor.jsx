import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiArrowLeft, FiUsers, FiWifi, FiWifiOff, FiShare2, FiSettings } from 'react-icons/fi';
import { updateContent, updateTitle, setError } from '../store/slices/documentSlice';
import socketService from '../services/socketService';
import CursorOverlay from './CursorOverlay';
import ShareModal from './ShareModal';
import SettingsModal from './SettingsModal';

const DocumentEditor = ({ document: initialDocument, onBack }) => {
    const dispatch = useDispatch();
    const { content, title, error, currentDocument } = useSelector(state => state.document);
    const { isConnected, connectedUsers, cursors } = useSelector(state => state.collaboration);
    const currentUserId = useSelector(state => state.auth.user?.id?.toString());
    
    // Usar o documento do Redux se disponível, caso contrário usar o documento inicial
    const document = currentDocument || initialDocument;
    const isOwner = document && document.owner_id && document.owner_id.toString() === currentUserId;
    const textareaRef = useRef(null);
    const titleInputRef = useRef(null);    const [lastCursorPosition, setLastCursorPosition] = useState(-1); // Inicializar com -1 para permitir posição 0
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);

    //console.log("TESTE: ", document, useSelector(state => state.auth.user?.id));
    
    useEffect(() => {
        if (document) {
            socketService.joinDocument(document.id);
            
            // Enviar posição inicial do cursor após um pequeno atraso
            setTimeout(() => {
                if (textareaRef.current) {
                    handleCursorMove();
                }
            }, 1000);
        }

        return () => {
            if (document) {
                socketService.leaveDocument(document.id);
            }
        };
    }, [document?.id]); // Só executa quando o ID do documento muda
    // Changes are automatically saved via WebSocket in real-time
    // No need for manual auto-save intervals

    useEffect(() => {
        if (connectedUsers && connectedUsers.length > 0) {
            console.log('Connected Users Changed:', JSON.stringify(connectedUsers));
            console.log('Count:', connectedUsers.length);
            console.log('Filtered Count:', connectedUsers.filter(user => user && (user.username || user.id)).length);
        }
    }, [connectedUsers]);    const handleContentChange = (e) => {
        const newContent = e.target.value;
        const cursorPosition = e.target.selectionStart;

        console.log('📝 Content changed:', { newContent: newContent.substring(0, 50) + '...', length: newContent.length, document: !!document });

        dispatch(updateContent(newContent));
        setLastCursorPosition(cursorPosition);

        if (document && document.id) {
            console.log('📤 Sending text change for document:', document.id);
            socketService.sendTextChange(document.id, newContent, {
                type: 'content-change',
                position: cursorPosition,
                timestamp: Date.now(),
            });
        } else {
            console.error('❌ Cannot send text change - no document or document ID:', document);
        }
    };

    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        dispatch(updateTitle(newTitle));

        if (document) {
            socketService.sendTitleChange(document.id, newTitle);
        }
    };

    // Real-time sync status
    const getSyncStatus = () => {
        if (!isConnected) return { text: 'Desconectado', color: '#ff4444' };
        return { text: 'Sincronizado', color: '#00aa00' };
    };    const handleKeyDown = (e) => {
        // Handle any future keyboard shortcuts here
        // Changes are saved automatically via WebSocket
    };

    // Handlers para o SettingsModal
    const handleDocumentUpdated = (updatedDocument) => {
        // Atualizar o documento no estado local se necessário
        console.log('Documento atualizado:', updatedDocument);
    };

    const handleDocumentDeleted = () => {
        // Voltar para a lista de documentos
        onBack();
    };

    const handleCursorMove = () => {
        if (textareaRef.current && document) {
            // Verificar se o usuário tem permissão de escrita antes de enviar cursor
            const isOwner = document.owner_id && document.owner_id.toString() === currentUserId;
            const permissionType = isOwner 
                ? 'owner' 
                : document.permission_type;
            
            // Não enviar posição do cursor se estiver em modo somente leitura
            // Apenas bloquear se explicitamente for 'read' ou não tiver permissão de escrita
            const isReadOnly = !isOwner && (permissionType === 'read' || !permissionType || permissionType === undefined);
            
            if (isReadOnly) {
                return;
            }
            
            const position = textareaRef.current.selectionStart;
            const selectionStart = textareaRef.current.selectionStart;
            const selectionEnd = textareaRef.current.selectionEnd;
            
            const selection = {
                start: selectionStart,
                end: selectionEnd,
            };

            // Verificar se houve uma mudança real na posição do cursor ou na seleção
            const positionChanged = position !== lastCursorPosition;
            const hasSelection = selectionStart !== selectionEnd;
            
            // Apenas enviar se a posição ou a seleção realmente mudaram
            if (positionChanged || hasSelection) {                setLastCursorPosition(position);
                
                // Garantir que a posição é um número válido
                if (typeof position === 'number' && !isNaN(position) && isFinite(position)) {
                    socketService.sendCursorPosition(document.id, position, selection);
                } else {
                    console.error('Posição do cursor inválida:', position);
                }
            }
        }
    };

    // Função específica para capturar movimentos do cursor
    const handleCursorEvent = (e) => {
        if (throttledCursorMove.current) {
            throttledCursorMove.current();
        }
    };// Throttle cursor updates to avoid spamming
    const throttledCursorMove = useRef(null);    useEffect(() => {
        // Criar função throttled para evitar muitas chamadas em curto período
        throttledCursorMove.current = throttle(handleCursorMove, 150);
          // Listener para solicitações de posição de cursor
        const handleCursorPositionRequest = () => {
            if (textareaRef.current && document) {
                handleCursorMove();
            }
        };
        
        // Adicionar listener para evento personalizado
        window.addEventListener('requestCursorPosition', handleCursorPositionRequest);
        
        return () => {
            window.removeEventListener('requestCursorPosition', handleCursorPositionRequest);
        };
    }, [document]);
    
    // Atualizar cursor quando o conteúdo mudar (importante para manter sincronizado)
    useEffect(() => {
        if (textareaRef.current && document && throttledCursorMove.current) {
            // Pequeno atraso para garantir que o layout foi recalculado após mudança de conteúdo
            setTimeout(throttledCursorMove.current, 100);
        }    }, [content]);

    function throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
    if (!document) {
        return (
            <div className="editor-container">
                <div className="empty-editor">
                    <h3>Selecione um documento para editar</h3>
                </div>
            </div>
        );
    }    
    // Verificar permissões do usuário para o documento 
    useEffect(() => {
        if (document) {
            console.log('Document debug:', {
                documentId: document.id,
                ownerId: document.owner_id,
                currentUserId,
                isOwner,
                documentObject: document
            });
            
            // Determinar o tipo de permissão para este documento
            const permissionType = isOwner 
                ? 'owner' 
                : document.permission_type || (document.is_public ? 'read' : null);
                
            console.log('User has permission type:', permissionType);
            
            // Se o usuário não tem permissão, redirecionar para a lista
            if (!permissionType) {
                console.error('No permission to access this document');
                dispatch(setError('Você não tem permissão para acessar este documento'));
                setTimeout(() => {
                    onBack();
                }, 2000);
            }
            
            // Definir o textbox como somente leitura se o usuário não tiver permissão de escrita
            if (textareaRef.current) {
                const isReadOnly = permissionType === 'read' || !permissionType;
                textareaRef.current.readOnly = isReadOnly;
                
                if (isReadOnly) {
                    textareaRef.current.classList.add('read-only');
                } else {
                    textareaRef.current.classList.remove('read-only');
                }
            }
        }    }, [document, currentUserId, isOwner, dispatch, onBack]);

    // Debug dos cursors recebidos (versão reduzida)
    useEffect(() => {
        if (Object.keys(cursors).length > 0) {
            console.log(`DocumentEditor: ${Object.keys(cursors).length} cursors, currentUser: ${currentUserId}`);
        }
    }, [cursors, currentUserId]);    return (
        <div className="editor-container">
            <div className="editor-header">        
                <div className="editor-left">
                    <button className="btn-secondary" onClick={onBack}>
                        <FiArrowLeft size={16} />
                        Voltar
                    </button>
                    
                    <div className="document-title-section">
                        <input
                            ref={titleInputRef}
                            type="text"
                            className="document-title-input"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Título do documento"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                <div className={`editor-center ${!isOwner ? 'center-when-no-share' : ''}`}>
                    <div className="collaboration-info">
                        <FiUsers size={16} />
                        <div
                            className="users-count"
                            data-tooltip={connectedUsers && connectedUsers.length > 0
                                ? `Usuários online: ${connectedUsers.filter(user => user && (user.username || user.id)).map(user => user.username || user.id).join(', ')}`
                                : 'Nenhum usuário online'
                            }
                        >
                            <span className="users-number">
                                {connectedUsers ? connectedUsers.filter(user => user && (user.username || user.id)).length : 0}
                            </span>
                        </div>
                    </div>
                </div>                  <div className="editor-actions">
                    {isOwner && (
                        <>
                            <button
                                className="btn-secondary share-btn"
                                onClick={() => setShareModalOpen(true)}
                                title="Compartilhar documento"
                            >
                                <FiShare2 size={16} />
                                <span>Compartilhar</span>
                            </button>
                            
                            <button
                                className="btn-secondary settings-btn"
                                onClick={() => setSettingsModalOpen(true)}
                                title="Configurações do documento"
                            >
                                <FiSettings size={16} />
                                <span>Configurações</span>
                            </button>
                        </>
                    )}

                    <div className="permission-indicator" title={
                        isOwner ? "Você é o proprietário deste documento" :
                        document.permission_type === "write" ? "Você pode editar este documento" :
                        "Você só pode visualizar este documento"
                    }>
                        {isOwner ? "Proprietário" : 
                         document.permission_type === "write" ? "Pode editar" : 
                         "Somente leitura"}
                    </div>

                    <div className="sync-indicator">
                        <div
                            className="sync-dot"
                            style={{ backgroundColor: getSyncStatus().color }}
                        ></div>
                        {/* <span style={{ color: getSyncStatus().color }}>
                            {getSyncStatus().text}
                        </span> */}
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}
            <div className="editor-status">
                <span className="word-count">
                    {content.length} caracteres · {content.split(/\s+/).filter(word => word.length > 0).length} palavras
                </span>
            </div>            
            <div className="editor-content">
                <div className="textarea-container">                    
                    <textarea
                        ref={textareaRef}
                        className="document-textarea"
                        value={content}
                        onChange={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onMouseUp={handleCursorEvent}
                        onKeyUp={handleCursorEvent}
                        onSelect={handleCursorEvent}
                        onClick={handleCursorEvent}
                        onFocus={handleCursorEvent}
                        onInput={handleCursorEvent}
                        placeholder="Comece a escrever seu documento..."
                        spellCheck="true"
                    />

                    {/* Overlay de cursores colaborativos */}
                    <CursorOverlay cursors={cursors} textareaRef={textareaRef} />
                </div>
            </div>            {/* Modal de compartilhamento */}
            <ShareModal
                document={document}
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
            />

            {/* Modal de configurações */}
            <SettingsModal
                document={document}
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                onDocumentUpdated={handleDocumentUpdated}
                onDocumentDeleted={handleDocumentDeleted}
            />
        </div>
    );
};

export default DocumentEditor;
