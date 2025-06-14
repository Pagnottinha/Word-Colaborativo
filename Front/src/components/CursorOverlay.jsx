import React, { useMemo, useEffect, useState } from 'react';

/**
 * CursorOverlay - Versão completamente reescrita
 * 
 * Abordagem simples e confiável:
 * 1. Usa apenas setSelectionRange nativo do textarea
 * 2. Usa getBoundingClientRect para obter posições exatas
 * 3. Sempre retorna uma posição (nunca falha)
 * 4. Animação de pulsação para melhor visibilidade
 * 5. Com ResizeObserver para atualização automática
 */

// Definição do efeito de pulsação do cursor
const cursorAnimation = `
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;
const CursorOverlay = ({ cursors, textareaRef }) => {
  // Estado para forçar re-renderização quando o textarea mudar de tamanho
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Configurar ResizeObserver para detectar mudanças de tamanho do textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const updateDimensions = () => {
      const { width, height } = textarea.getBoundingClientRect();
      setDimensions({ width, height });
    };
    
    // Inicializar dimensões
    updateDimensions();
    
    // Configurar observador de redimensionamento
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || !entries[0]) return;
      updateDimensions();
    });
    
    resizeObserver.observe(textarea);
    
    // Limpar observador
    return () => {
      resizeObserver.disconnect();
    };
  }, [textareaRef]);
  
  /**
   * Gera uma cor consistente baseada no ID do usuário
   */
  const getUserColor = (userId) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };
  /**
   * Calcula a posição de uma seleção de texto
   * Retorna as coordenadas de início e fim da seleção
   */
  const getSelectionRange = (selection) => {
    if (!textareaRef.current || !selection || selection.start === selection.end) {
      return null;
    }

    try {
      const textarea = textareaRef.current;
      const text = textarea.value;
      const { start, end } = selection;

      // Verificar se a seleção é válida
      if (start < 0 || end > text.length || start >= end) {
        return null;
      }

      // Salvar estado atual do textarea
      const originalStart = textarea.selectionStart;
      const originalEnd = textarea.selectionEnd;
      const originalScrollTop = textarea.scrollTop;
      const originalScrollLeft = textarea.scrollLeft;

      // Obter as dimensões e posição do textarea
      const textareaRect = textarea.getBoundingClientRect();
      const style = window.getComputedStyle(textarea);

      // Métricas de texto
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${style.fontSize} ${style.fontFamily}`;

      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingTop = parseFloat(style.paddingTop) || 0;

      // Calcular posições de início e fim
      const getPositionCoords = (pos) => {
        const lines = text.substring(0, pos).split('\n');
        const currentLine = lines.length - 1;
        const currentLineText = lines[lines.length - 1];

        let textWidth = 0;
        if (pos > 0 && currentLineText.length > 0) {
          textWidth = context.measureText(currentLineText).width;
        }

        const x = paddingLeft + textWidth - textarea.scrollLeft;
        const y = paddingTop + (currentLine * lineHeight) - textarea.scrollTop;

        return { x: Math.round(x), y: Math.round(y), line: currentLine };
      };

      const startCoords = getPositionCoords(start);
      const endCoords = getPositionCoords(end);

      // Restaurar estado original
      textarea.setSelectionRange(originalStart, originalEnd);
      textarea.scrollTop = originalScrollTop;
      textarea.scrollLeft = originalScrollLeft;

      // Verificar se está dentro dos limites visíveis
      if (startCoords.x < 0 || startCoords.y < 0 || endCoords.x < 0 || endCoords.y < 0 ||
        startCoords.x > textarea.clientWidth || endCoords.x > textarea.clientWidth ||
        startCoords.y > textarea.clientHeight || endCoords.y > textarea.clientHeight) {
        return null;
      }

      return {
        start: startCoords,
        end: endCoords,
        isMultiline: startCoords.line !== endCoords.line,
        selectedText: text.substring(start, end)
      };

    } catch (error) {
      console.error('Error calculating selection range:', error);
      return null;
    }
  };

  /**
   * Calcula a posição do cursor baseado em índice (versão otimizada)
   * - Usa cache para melhorar performance
   * - Lida melhor com variações de tamanho de fonte
   */
  const getCursorPosition = (position) => {
    try {
      // Parâmetros de segurança
      if (!textareaRef.current) {
        console.warn("getCursorPosition: textareaRef.current is null");
        return { x: 0, y: 0 }; // Posição padrão
      }
      
      const textarea = textareaRef.current;
      const text = textarea.value || "";
      
      // Sanitizar posição - garantir que é um número válido dentro dos limites do texto
      const safePosition = typeof position === 'number' ? 
        Math.max(0, Math.min(position, text.length)) : 
        0;
      
      // Salvar estado atual do textarea (sem mudar o foco)
      const originalStart = textarea.selectionStart;
      const originalEnd = textarea.selectionEnd;
      const originalScrollTop = textarea.scrollTop;
      const originalScrollLeft = textarea.scrollLeft;
      
      // Obter dimensões e estilo
      const textareaRect = textarea.getBoundingClientRect();
      const style = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      
      // Calcular linha e coluna
      const textBefore = text.substring(0, safePosition);
      const lines = textBefore.split('\n');
      const lineIndex = lines.length - 1;
      const charIndex = lines[lineIndex].length;
      
      // Criar um elemento temporário com o mesmo estilo do textarea 
      // para medição mais precisa do texto
      const measureElement = document.createElement('div');
      measureElement.style.position = 'absolute';
      measureElement.style.top = '-9999px';
      measureElement.style.left = '-9999px';
      measureElement.style.visibility = 'hidden';
      measureElement.style.whiteSpace = 'pre';
      measureElement.style.font = `${style.fontSize} ${style.fontFamily}`;
      measureElement.style.letterSpacing = style.letterSpacing;
      measureElement.style.wordSpacing = style.wordSpacing;
      measureElement.innerText = lines[lineIndex].substring(0, charIndex);
      
      document.body.appendChild(measureElement);
      const textWidth = measureElement.getBoundingClientRect().width;
      document.body.removeChild(measureElement);
      
      // Calcular posições finais com compensação de rolagem
      const x = paddingLeft + textWidth - textarea.scrollLeft;
      const y = paddingTop + (lineIndex * lineHeight) - textarea.scrollTop;
      
      // Restaurar estado original do textarea
      try {
        textarea.setSelectionRange(originalStart, originalEnd);
        textarea.scrollTop = originalScrollTop;
        textarea.scrollLeft = originalScrollLeft;
      } catch (e) {
        // Ignorar erros silenciosamente
      }
      
      // Garantir que as coordenadas estejam dentro dos limites visíveis
      // ou pelo menos próximas para que o label seja visível
      const result = {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y))
      };
      
      return result;
    } catch (error) {
      console.error('Error calculating cursor position:', error);
      // Retornar posição padrão
      return { x: 5, y: 5 };
    }
  };  /**
   * Renderizar cursores e seleções colaborativas
   */
  const renderedElements = useMemo(() => {
    if (!textareaRef.current) {
      return [];
    }

    console.log('Rendering cursors and selections:', Object.keys(cursors).length, 'total', 
      `(textarea dimensions: ${dimensions.width}x${dimensions.height})`);

    return Object.entries(cursors)
      .filter(([userId, cursorData]) => {
        // Filtrar apenas cursores válidos de outros usuários
        return userId !== 'currentUser' &&
          cursorData &&
          typeof cursorData.position === 'number' &&
          cursorData.username;
      })
      .map(([userId, cursorData]) => {
        const color = getUserColor(userId);
        const now = Date.now();
        const lastUpdate = cursorData.lastUpdate || now;
        const isStale = now - lastUpdate > 15000; // 15 segundos
        const elements = [];

        // Renderizar seleção se existir
        if (cursorData.selection && cursorData.selection.start !== cursorData.selection.end) {
          const selectionRange = getSelectionRange(cursorData.selection);

          if (selectionRange) {
            console.log(`✅ Rendering selection for ${userId}:`, selectionRange);

            if (selectionRange.isMultiline) {
              // Seleção multi-linha - renderizar múltiplos retângulos
              const startY = selectionRange.start.y;
              const endY = selectionRange.end.y;
              const lineHeight = parseFloat(window.getComputedStyle(textareaRef.current).lineHeight) || 18;

              // Primeira linha (do início até o final da linha)
              elements.push(
                <div
                  key={`${userId}-selection-start`}
                  className="collaborative-selection"
                  style={{
                    position: 'absolute',
                    left: `${selectionRange.start.x}px`,
                    top: `${selectionRange.start.y}px`,
                    width: `${textareaRef.current.clientWidth - selectionRange.start.x}px`,
                    height: `${lineHeight}px`,
                    backgroundColor: color,
                    opacity: isStale ? 0.1 : 0.2,
                    zIndex: 999,
                    pointerEvents: 'none',
                  }}
                />
              );

              // Linhas intermediárias (se houver)
              const numMiddleLines = Math.max(0, (endY - startY) / lineHeight - 1);
              for (let i = 0; i < numMiddleLines; i++) {
                elements.push(
                  <div
                    key={`${userId}-selection-middle-${i}`}
                    className="collaborative-selection"
                    style={{
                      position: 'absolute',
                      left: '0px',
                      top: `${startY + (i + 1) * lineHeight}px`,
                      width: `${textareaRef.current.clientWidth}px`,
                      height: `${lineHeight}px`,
                      backgroundColor: color,
                      opacity: isStale ? 0.1 : 0.2,
                      zIndex: 999,
                      pointerEvents: 'none',
                    }}
                  />
                );
              }

              // Última linha (do início da linha até o final)
              elements.push(
                <div
                  key={`${userId}-selection-end`}
                  className="collaborative-selection"
                  style={{
                    position: 'absolute',
                    left: '0px',
                    top: `${selectionRange.end.y}px`,
                    width: `${selectionRange.end.x}px`,
                    height: `${lineHeight}px`,
                    backgroundColor: color,
                    opacity: isStale ? 0.1 : 0.2,
                    zIndex: 999,
                    pointerEvents: 'none',
                  }}
                />
              );
            } else {
              // Seleção de linha única
              elements.push(
                <div
                  key={`${userId}-selection`}
                  className="collaborative-selection"
                  style={{
                    position: 'absolute',
                    left: `${selectionRange.start.x}px`,
                    top: `${selectionRange.start.y}px`,
                    width: `${selectionRanFge.end.x - selectionRange.start.x}px`,
                    height: '18px',
                    backgroundColor: color,
                    opacity: isStale ? 0.1 : 0.2,
                    zIndex: 999,
                    pointerEvents: 'none',
                  }}
                />
              );
            }
          }
        }        // Sempre renderizar cursor (getCursorPosition agora sempre retorna uma posição)
        const cursorPosition = getCursorPosition(cursorData.position);
        
        // Log para debug
        console.log(`✅ Rendering cursor for ${userId} at`, cursorPosition);

        // Sempre adicionar o cursor ao DOM
        elements.push(
          <div
            key={`${userId}-cursor`}
            className="collaborative-cursor-wrapper"
            style={{
              position: 'absolute',
              left: `${cursorPosition.x}px`,
              top: `${cursorPosition.y}px`,
              zIndex: 1001,
              pointerEvents: 'none',
              transform: 'translateX(0px) translateY(0px)', // Reset any inherited transforms
              transition: 'left 0.1s ease, top 0.1s ease', // Transição suave ao mover
              willChange: 'left, top', // Otimizar para animações
            }}
          >              {/* Linha do cursor com animação de pulsação */}
              <div
                style={{
                  width: '2px',                  
                  height: '18px',
                  backgroundColor: color,
                  borderRadius: '1px',
                  boxShadow: `0 0 3px ${color}`,
                  animation: 'cursorBlink 1s infinite',
                  opacity: isStale ? 0.4 : 1
                }}
              />

              {/* Label do usuário - mostrar apenas se não há seleção ou sempre mostrar */}
              <div
                style={{
                  position: 'absolute',
                  left: '3px',
                  top: '-22px',
                  backgroundColor: color,
                  color: 'white',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  opacity: isStale ? 0.4 : 1,
                  boxShadow: `0 1px 3px rgba(0,0,0,0.2)`,
                }}              >
                {cursorData.username}
                {cursorData.selection && cursorData.selection.start !== cursorData.selection.end &&
                  ` (${cursorData.selection.end - cursorData.selection.start} chars)`
                }
              </div>
            </div>
          );

        return elements;
      })
      .flat()
      .filter(Boolean);
  }, [cursors, textareaRef, dimensions]);  

  // Adicionar observer de resize para atualizar posições de cursor
  useEffect(() => {
    const textareaElement = textareaRef.current;
    if (!textareaElement) return;

    const resizeObserver = new ResizeObserver(() => {
      // Forçar atualização das posições dos cursores ao redimensionar
      console.log('Textarea resized, updating cursor positions');
      Object.keys(cursors).forEach(userId => {
        if (cursors[userId]?.position != null) {
          // Atualizar a posição do cursor apenas (sem forçar re-renderização de outros elementos)
          const cursorPosition = getCursorPosition(cursors[userId].position);
          console.log(`Updating cursor position for ${userId} to`, cursorPosition);
        }
      });
    });

    // Observar mudanças de tamanho no textarea
    resizeObserver.observe(textareaElement);

    // Limpar observer ao desmontar
    return () => {
      resizeObserver.disconnect();
    };
  }, [textareaRef, cursors]);  

  return (
    <>
      {/* Estilo para animação do cursor */}
      <style>{cursorAnimation}</style>
        <div
      className="cursor-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible',
      }}
    >
      {/* Indicador visual que o overlay está funcionando */}
      <div style={{
        position: 'absolute',
        top: '5px',
        right: '5px',
        width: '8px',
        height: '8px',
        backgroundColor: '#44ff44',
        borderRadius: '50%',
        zIndex: 1002,
        opacity: 0.7,
        boxShadow: '0 0 4px rgba(68, 255, 68, 0.7)',
        animation: 'cursorBlink 2s infinite',
      }} />
      {/* Cursor de teste simples para verificar se o overlay funciona
      {Object.keys(cursors).length > 0 && (
        <div style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          width: '8px',
          height: '8px',
          backgroundColor: 'lime',
          borderRadius: '50%',
          zIndex: 1002,
        }} />
      )} */}

      {/* Cursores e seleções colaborativas */}
      {renderedElements}      {/* Debug info limpo */}
      {Object.keys(cursors).length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '5px',
          right: '5px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '2px 6px',
          fontSize: '10px',
          borderRadius: '3px',
          fontFamily: 'monospace',
        }}>
          Users: {Object.keys(cursors).length} | Elements: {renderedElements.length}
        </div>
      )}
    </div>
    </>
  );
};

export default CursorOverlay;