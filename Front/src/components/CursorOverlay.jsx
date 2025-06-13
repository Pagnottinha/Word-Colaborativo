import React, { useMemo } from 'react';
import { useCallback } from 'react';

/**
 * CursorOverlay - Versão completamente reescrita
 * 
 * Abordagem simples e confiável:
 * 1. Usa apenas setSelectionRange nativo do textarea
 * 2. Usa getBoundingClientRect para obter posições exatas
 * 3. Sem elementos mirror complexos ou cálculos complicados
 */
const CursorOverlay = ({ cursors, textareaRef }) => {

  /**
   * Método simples e direto para calcular posição do cursor
   * Usa apenas APIs nativas do browser
   */
  const getCursorPosition = useCallback((position) => {
    if (!textareaRef.current || typeof position !== 'number') {
      return null;
    }

    try {
      const textarea = textareaRef.current;
      const text = textarea.value;

      // Verificar se a posição é válida
      if (position < 0 || position > text.length) {
        return null;
      }

      // Salvar estado atual do textarea
      const originalStart = textarea.selectionStart;
      const originalEnd = textarea.selectionEnd;
      const originalScrollTop = textarea.scrollTop;
      const originalScrollLeft = textarea.scrollLeft;

      // Temporariamente colocar o cursor na posição desejada
      textarea.setSelectionRange(position, position);
      textarea.focus();

      // Criar um elemento temporário para medir a posição
      const range = document.createRange();
      const selection = window.getSelection();

      // Para textarea, precisamos usar uma abordagem diferente
      // Vamos usar as coordenadas do cliente relativas ao textarea

      // Obter as dimensões e posição do textarea
      const textareaRect = textarea.getBoundingClientRect();
      const style = window.getComputedStyle(textarea);

      // Calcular a posição baseada na linha e coluna
      const lines = text.substring(0, position).split('\n');
      const currentLine = lines.length - 1;
      const currentColumn = lines[lines.length - 1].length;
      // Obter métricas de texto - usar o texto real da linha para maior precisão
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${style.fontSize} ${style.fontFamily}`;
      // Medir a largura exata do texto até a posição do cursor na linha atual
      const currentLineText = lines[lines.length - 1];
      let textWidth = 0;

      // Para posição 0, a largura é sempre 0
      if (position === 0) {
        textWidth = 0;
      } else if (currentLineText.length > 0) {
        textWidth = context.measureText(currentLineText).width;
      }

      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;

      // Padding do textarea
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      // Posição calculada usando a largura exata do texto
      const x = paddingLeft + textWidth - textarea.scrollLeft;
      const y = paddingTop + (currentLine * lineHeight) - textarea.scrollTop;

      // Restaurar estado original
      textarea.setSelectionRange(originalStart, originalEnd);
      textarea.scrollTop = originalScrollTop;
      textarea.scrollLeft = originalScrollLeft;

      // Verificar se a posição está dentro dos limites visíveis
      if (x < 0 || y < 0 || x > textarea.clientWidth || y > textarea.clientHeight) {
        return null;
      } console.log(`Cursor position for ${position}:`, {
        line: currentLine,
        column: currentColumn,
        x: Math.round(x),
        y: Math.round(y),
        textWidth,
        paddingLeft,
        paddingTop,
        isPosition0: position === 0
      });

      return { x: Math.round(x), y: Math.round(y) };

    } catch (error) {
      console.error('Error calculating cursor position:', error);
      return null;
    }
  }, [textareaRef]);

  /**
   * Calcula a posição de uma seleção de texto
   * Retorna as coordenadas de início e fim da seleção
   */
  const getSelectionRange = useCallback((selection) => {
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
   * Renderizar cursores e seleções colaborativas
   */
  const renderedElements = useMemo(() => {
    if (!textareaRef.current) {
      return [];
    }

    console.log('Rendering cursors and selections:', Object.keys(cursors).length, 'total');

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
                    width: `${selectionRange.end.x - selectionRange.start.x}px`,
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
        }

        // Renderizar cursor apenas se não há seleção (cursor fica no final da seleção)
        const cursorPosition = getCursorPosition(cursorData.position);

        if (cursorPosition) {
          console.log(`✅ Rendering cursor for ${userId} at`, cursorPosition);

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
              }}
            >
              {/* Linha do cursor */}
              <div
                style={{
                  width: '2px',
                  height: '18px',
                  backgroundColor: color,
                  borderRadius: '1px',
                  opacity: isStale ? 0.4 : 1,
                  boxShadow: `0 0 2px ${color}`,
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
                }}
              >
                {cursorData.username}
                {cursorData.selection && cursorData.selection.start !== cursorData.selection.end &&
                  ` (${cursorData.selection.end - cursorData.selection.start} chars)`
                }
              </div>
            </div>
          );
        } else {
          console.log(`❌ No cursor position calculated for user ${userId}`);
        }

        return elements;
      })
      .flat()
      .filter(Boolean);
  }, [cursors, getSelectionRange, getCursorPosition, textareaRef]); 
  
  return (
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
      {renderedElements}

      {/* Debug info limpo */}
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
  );
};

export default CursorOverlay;
