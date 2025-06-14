import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiArrowLeft, FiUsers, FiShare2, FiSettings } from 'react-icons/fi';
import { updateContent, updateTitle, setError } from '../store/slices/documentSlice';
import socketService from '../services/socketService';
import CursorOverlay from './CursorOverlay';
import ShareModal from './ShareModal';
import SettingsModal from './SettingsModal';

// Removemos a função de debounce para tornar as atualizações instantâneas
// Isso melhora a experiência do usuário em um editor colaborativo

const DocumentEditor = ({ document: initialDocument, onBack }) => {
    const dispatch = useDispatch();
    const { content, title, error, currentDocument } = useSelector(state => state.document);
    const { isConnected, connectedUsers, cursors } = useSelector(state => state.collaboration);
    const currentUserId = useSelector(state => state.auth.user?.id?.toString());

    // Usar o documento do Redux se disponível, caso contrário usar o documento inicial
    const document = currentDocument || initialDocument;
    const isOwner = document && document.owner_id && document.owner_id.toString() === currentUserId;

    // Referências para elementos DOM
    const textareaRef = useRef(null);
    const titleInputRef = useRef(null);

    // Estados para modais
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);

    // Estados para controle de colaboração
    const [lastCursorPosition, setLastCursorPosition] = useState(0);

    // Controle de edição local e preservação de cursor usando refs para evitar re-renders
    const localEditTimestampRef = useRef(Date.now());
    const isLocalEditRef = useRef(false);
    const lastContentRef = useRef('');
    const selectionStateRef = useRef({ start: 0, end: 0 });
    const pendingCursorUpdate = useRef(false);

    // Usamos a lista de usuários conectados filtrada para remover entradas inválidas
    const validConnectedUsers = useMemo(() => {
        const validUsers = connectedUsers?.filter(user => user && (user.username || user.id || user.userId)) || [];
        return validUsers.length > 0 ? validUsers : [{ id: 'current-user', username: 'Você' }];
    }, [connectedUsers]);

    //console.log("TESTE: ", document, useSelector(state => state.auth.user?.id));    // Função simplificada para enviar a posição do cursor para colaboração
    const updateCursorPosition = useCallback(() => {
        if (!textareaRef.current || !document) return;

        // Verificar permissões
        const canEdit = isOwner || document.permission_type === 'write';
        if (!canEdit) return;

        // Obter posição atual do cursor
        const position = textareaRef.current.selectionStart;
        const selection = {
            start: textareaRef.current.selectionStart,
            end: textareaRef.current.selectionEnd
        };

        // Armazenar localmente para preservação
        selectionStateRef.current = selection;

        // Verificar se a posição mudou realmente
        if (position !== lastCursorPosition || selection.start !== selection.end) {
            setLastCursorPosition(position);

            // Enviar apenas se for uma posição válida
            if (typeof position === 'number' && !isNaN(position) && isFinite(position)) {
                socketService.sendCursorPosition(document.id, position, selection);
            }
        }
    }, [document, isOwner, lastCursorPosition]);    // Função para lidar com movimento do cursor - melhorada para mais frequência
    const handleCursorMove = useCallback(() => {
        if (!textareaRef.current || !document) return;

        // Atualiza imediatamente a posição do cursor
        updateCursorPosition();
        pendingCursorUpdate.current = false;

        // Programa um segundo update para garantir que o cursor seja registrado
        // mesmo após render ou mudanças do React
        setTimeout(() => {
            if (textareaRef.current) {
                updateCursorPosition();
            }
        }, 50);
    }, [document, updateCursorPosition]);

    useEffect(() => {
        if (document) {
            socketService.joinDocument(document.id);

            // Enviar posição inicial do cursor após um pequeno atraso
            setTimeout(() => {
                if (textareaRef.current) {
                    handleCursorMove();
                }
            }, 1000);

            // Manter o cursor atualizado a cada 3 segundos para evitar que desapareça
            // Isso é crítico para manter os cursores visíveis mesmo quando não há atividade
            const cursorRefreshInterval = setInterval(() => {
                if (textareaRef.current && document) {
                    updateCursorPosition();
                }
            }, 3000);

            return () => {
                if (document) {
                    socketService.leaveDocument(document.id);
                }
                clearInterval(cursorRefreshInterval);
            };
        }

        return () => {
            if (document) {
                socketService.leaveDocument(document.id);
            }
        };
    }, [document, handleCursorMove, updateCursorPosition]);    // Só executa quando o ID do documento muda
    // Changes are automatically saved via WebSocket in real-time
    // No need for manual auto-save intervals

    // Sincronizar overlay com o scroll do textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Handle textarea scroll to update the cursor overlay
        const handleScroll = () => {
            // Force overlay update when scrolling
            if (pendingCursorUpdate.current === false) {
                pendingCursorUpdate.current = true;
                requestAnimationFrame(() => {
                    updateCursorPosition();
                    pendingCursorUpdate.current = false;
                });
            }
        };

        textarea.addEventListener('scroll', handleScroll);

        return () => {
            textarea.removeEventListener('scroll', handleScroll);
        };
    }, [updateCursorPosition]);

    // Limpar cursores obsoletos periodicamente
    useEffect(() => {
        if (!document) return;

        // Limpar cursores que não foram atualizados há mais de 30 segundos
        const cleanupInterval = setInterval(() => {
            dispatch({ type: 'collaboration/cleanupStaleCursors' });
        }, 10000); // A cada 10 segundos

        return () => clearInterval(cleanupInterval);
    }, [dispatch, document]);

    useEffect(() => {
        if (connectedUsers && connectedUsers.length > 0) {
            console.log('Connected Users Changed:', JSON.stringify(connectedUsers));
            console.log('Count:', connectedUsers.length);
            console.log('Filtered Count:', connectedUsers.filter(user => user && (user.username || user.id)).length);
        }
    }, [connectedUsers]);// Função para enviar alterações ao servidor instantaneamente
    const sendContentToServer = (docId, text, position) => {
        const timestamp = Date.now();
        socketService.sendTextChange(docId, text, {
            type: 'content-change',
            position,
            timestamp
        });

        // Mantemos um curto timeout para garantir que o estado isLocalEdit seja atualizado
        // após o processamento da alteração atual
        setTimeout(() => {
            isLocalEditRef.current = false;
        }, 50);
    };    // Gerenciador de mudanças de texto - otimizado para atualizações instantâneas
    const handleContentChange = (e) => {
        if (!document?.id) return;

        const newContent = e.target.value;
        const cursorPosition = e.target.selectionStart;

        // Registrar os detalhes da seleção atual
        const currentCursorPos = {
            start: cursorPosition,
            end: e.target.selectionEnd
        };

        // Salvamos a posição do cursor
        selectionStateRef.current = currentCursorPos;

        // Marcar que estamos em edição local e salvar timestamp e conteúdo atual
        isLocalEditRef.current = true;
        localEditTimestampRef.current = Date.now();
        lastContentRef.current = newContent;

        // Atualizar o estado Redux imediatamente
        dispatch(updateContent(newContent));

        // Enviar alterações para o servidor instantaneamente
        sendContentToServer(document.id, newContent, cursorPosition);
        // Garantir que o cursor permaneça na posição correta
        // É importante fazer isso após a atualização
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.setSelectionRange(currentCursorPos.start, currentCursorPos.end);

                // Enviar atualização de cursor após mudança de conteúdo
                // Isso é crucial para manter os cursores visíveis após mudanças
                updateCursorPosition();
            }
        });
    };

    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        dispatch(updateTitle(newTitle));

        if (document) {
            socketService.sendTitleChange(document.id, newTitle);
        }
    };    // Real-time sync status
    const getSyncStatus = () => {
        if (!isConnected) return { text: 'Desconectado', color: '#ff4444' };
        return { text: 'Sincronizado', color: '#00aa00' };
    };

    // Handlers para o SettingsModal
    const handleDocumentUpdated = (updatedDocument) => {
        // Atualizar o documento no estado local se necessário
        console.log('Documento atualizado:', updatedDocument);
    };

    const handleDocumentDeleted = () => {
        // Voltar para a lista de documentos
        onBack();
    };    // Real-time sync status// Configurar handlerspara capturar movimento do cursor
    useEffect(() => {
        const throttledCursorMove = throttle(handleCursorMove, 100);

        const handleCursorEvent = () => {
            if (pendingCursorUpdate.current) return;
            pendingCursorUpdate.current = true;
            throttledCursorMove();
        };

        // Listener para solicitações de posição de cursor
        const handleCursorPositionRequest = () => {
            if (textareaRef.current && document) {
                handleCursorMove();
            }
        };

        window.addEventListener('requestCursorPosition', handleCursorPositionRequest);

        return () => {
            window.removeEventListener('requestCursorPosition', handleCursorPositionRequest);
        };
    }, [document, handleCursorMove]);    // Gerenciamento do conteúdo do textarea otimizado para atualizações instantâneas
    useEffect(() => {
        if (!textareaRef.current || !content) return;

        // Se o conteúdo já está sincronizado, não fazer nada
        if (textareaRef.current.value === content) {
            return;
        }

        // Durante edição local, priorizar o conteúdo local para evitar sobrescritas
        // Isso é crucial para evitar que o texto digitado desapareça
        if (isLocalEditRef.current && content !== lastContentRef.current) {
            console.log('Evitando conflito: mantendo conteúdo local durante edição ativa');
            return;
        }

        // Salvar a posição atual do cursor e scroll
        const currentSelectionStart = textareaRef.current.selectionStart;
        const currentSelectionEnd = textareaRef.current.selectionEnd;
        const scrollTop = textareaRef.current.scrollTop;

        // Atualizar o textarea imediatamente
        textareaRef.current.value = content;

        // Restaurar a posição do cursor e scroll imediatamente
        // Isso é essencial para garantir que o cursor não pule para o final
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(currentSelectionStart, currentSelectionEnd);
        textareaRef.current.scrollTop = scrollTop;

        // Registrar a posição atual para referência futura
        selectionStateRef.current = {
            start: currentSelectionStart,
            end: currentSelectionEnd
        };
    }, [content]);

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
        }
    }, [document, currentUserId, isOwner, dispatch, onBack]);

    // Debug dos cursors recebidos (versão reduzida)
    useEffect(() => {
        if (Object.keys(cursors).length > 0) {
            console.log(`DocumentEditor: ${Object.keys(cursors).length} cursors, currentUser: ${currentUserId}`);
        }
    }, [cursors, currentUserId]);

    // Garantir sincronização completa entre textarea e conteúdo Redux
    useEffect(() => {
        // Executamos isso na montagem do componente e sempre que o documento mudar
        if (textareaRef.current && content) {
            // Salvar a posição atual do cursor
            const currentCursorPos = {
                start: textareaRef.current.selectionStart,
                end: textareaRef.current.selectionEnd
            };

            // Atualizar o textarea para garantir sincronização
            textareaRef.current.value = content;

            // Restaurar o cursor
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(currentCursorPos.start, currentCursorPos.end);
        }
    }, [document?.id]); // Executar apenas quando o documento mudar   

    // Listener para eventos de texto remotos - otimizado para atualizações instantâneas
    useEffect(() => {
        const handleRemoteTextChange = (e) => {
            const { content: remoteContent, timestamp } = e.detail;

            // Ignorar atualizações durante edição local para evitar conflitos
            if (isLocalEditRef.current) {
                console.log('Ignorando atualização remota durante edição local');
                return;
            }

            // Ignorar atualizações antigas
            if (timestamp && timestamp < localEditTimestampRef.current) {
                console.log('Ignorando atualização remota mais antiga:', timestamp, 'vs local:', localEditTimestampRef.current);
                return;
            }

            // Preservar a posição do cursor
            const currentCursorPos = {
                start: textareaRef.current ? textareaRef.current.selectionStart : 0,
                end: textareaRef.current ? textareaRef.current.selectionEnd : 0
            };

            selectionStateRef.current = currentCursorPos;

            // Aplicar a atualização remota imediatamente
            dispatch(updateContent(remoteContent));

            // Usar requestAnimationFrame para garantir que a restauração do cursor
            // aconteça no próximo ciclo de renderização, após o DOM ser atualizado            requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(currentCursorPos.start, currentCursorPos.end);

                // Após mudança de texto remoto, atualizar posição do cursor para 
                // garantir que o overlay permaneça sincronizado
                updateCursorPosition();

                // Atualizar novamente após um momento para garantir estabilidade
                setTimeout(() => {
                    if (textareaRef.current) {
                        updateCursorPosition();
                    }
                }, 200);
            }
        };

        window.addEventListener('remoteTextChange', handleRemoteTextChange);

        return () => {
            window.removeEventListener('remoteTextChange', handleRemoteTextChange);
        };
    }, [dispatch, updateCursorPosition]);

    // Melhorar a estabilidade do cursor após mudanças de conteúdo remotas
    useEffect(() => {
        const handleRemoteChange = (event) => {
            const { detail } = event;

            // Verificar se a mudança é remota e se o textarea existe
            if (detail && detail.content && textareaRef.current) {
                // Força a atualização do cursor local após uma pequena espera
                // para garantir que o React terminou de renderizar o novo conteúdo
                setTimeout(() => {
                    if (textareaRef.current) {
                        // Restaurar posição do cursor que foi salva antes da mudança
                        try {
                            textareaRef.current.setSelectionRange(
                                selectionStateRef.current.start,
                                selectionStateRef.current.end
                            );

                            // Forçar envio da posição atualizada
                            updateCursorPosition();
                        } catch (e) {
                            // Silenciosamente ignorar, o textarea pode não estar pronto ainda
                        }
                    }
                }, 50);
            }
        };

        window.addEventListener('remoteTextChange', handleRemoteChange);
        return () => {
            window.removeEventListener('remoteTextChange', handleRemoteChange);
        };
    }, [updateCursorPosition]);

    if (!document) {
        return (
            <div className="editor-container">
                <div className="empty-editor">
                    <h3>Selecione um documento para editar</h3>
                </div>
            </div>
        );
    }

    return (
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

                        />
                    </div>
                </div>

                <div className={`editor-center ${!isOwner ? 'center-when-no-share' : ''}`}>
                    <div className="collaboration-info">
                        <FiUsers size={16} />                        <div
                            className="users-count"
                            data-tooltip={validConnectedUsers.length > 0
                                ? `Usuários online: ${validConnectedUsers
                                    .filter(user => user.username || user.id || user.userId)
                                    .map(user => user.username || user.id || user.userId)
                                    .join(', ')}`
                                : 'Nenhum usuário online'
                            }
                        >
                            <span className="users-number">
                                {validConnectedUsers.length}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="editor-actions">
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
                <div className="textarea-container">                        <textarea
                    ref={textareaRef}
                    className="document-textarea"
                    // Usamos defaultValue para evitar problemas com componente controlado
                    defaultValue={content}
                    onChange={handleContentChange} onMouseUp={handleCursorMove}
                    onKeyUp={handleCursorMove}
                    onSelect={handleCursorMove}
                    onClick={handleCursorMove}
                    onFocus={handleCursorMove}
                    onScroll={(e) => {
                        // Quando o usuário rola, precisamos recalcular todas as posições de cursor
                        if (!pendingCursorUpdate.current) {
                            pendingCursorUpdate.current = true;
                            // Atualizar após o scroll terminar
                            requestAnimationFrame(handleCursorMove);
                        }
                    }}
                    onInput={(e) => {
                        // Evento adicional para garantir que qualquer input é capturado
                        // e que o cursor permanece na posição correta
                        if (selectionStateRef.current) {
                            setTimeout(() => {
                                if (textareaRef.current) {
                                    textareaRef.current.setSelectionRange(
                                        selectionStateRef.current.start,
                                        selectionStateRef.current.end
                                    );
                                }
                            }, 0);
                        }
                    }}
                    placeholder="Comece a escrever seu documento..."
                    spellCheck="true"
                    autoComplete="off"
                    autoCorrect="off"
                />

                    {/* Overlay de cursores colaborativos */}
                    {/* Mostrar overlay apenas se temos um textarea e cursores */}
                    {textareaRef.current && cursors && Object.keys(cursors).length > 0 && (
                        <CursorOverlay
                            cursors={cursors}
                            textareaRef={textareaRef}
                            key={`overlay-${document?.id}`}
                        />
                    )}
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
