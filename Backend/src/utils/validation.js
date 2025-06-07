/**
 * Utilitários para validação de dados
 */

/**
 * Valida se um email tem formato válido
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida se uma string não está vazia
 */
const isNonEmptyString = (str) => {
  return typeof str === 'string' && str.trim().length > 0;
};

/**
 * Valida se um valor é um ID válido (UUID)
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Sanitiza uma string removendo caracteres perigosos
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>\"']/g, '');
};

/**
 * Valida permissões de documento
 */
const isValidPermissionType = (permission) => {
  return ['read', 'write'].includes(permission);
};

module.exports = {
  isValidEmail,
  isNonEmptyString,
  isValidUUID,
  sanitizeString,
  isValidPermissionType
};
