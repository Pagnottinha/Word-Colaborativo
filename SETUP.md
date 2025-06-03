# Configurações de Ambiente

## Backend

### Variáveis de Ambiente (opcional)
Crie um arquivo `.env` no diretório Backend para configurações personalizadas:

```
PORT=3001
DB_PATH=./documents.db
CORS_ORIGIN=http://localhost:5173
```

### Configurações do Socket.IO
- **Porta padrão**: 3001
- **CORS habilitado** para localhost:5173
- **Namespace padrão**: /

## Frontend

### Configurações do Vite
- **Porta padrão**: 5173
- **Hot Module Replacement** habilitado
- **Proxy para API**: Configurado para localhost:3001

### Configurações do Redux
- **DevTools** habilitadas em desenvolvimento
- **Middleware** configurado para debugging

## Banco de Dados

### SQLite Schema

```sql
-- Tabela de documentos
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de operações (para auditoria)
CREATE TABLE document_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT,
    operation_type TEXT,
    operation_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id)
);
```

## Deploy

### Preparação para Deploy

1. **Build do Frontend**:
```bash
cd Front
npm run build
```

2. **Configurar Variáveis de Ambiente**:
```bash
export PORT=3001
export NODE_ENV=production
```

3. **Instalar Dependências de Produção**:
```bash
cd Backend
npm install --production
```

### Exemplo de Deploy com PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicação
pm2 start Backend/server.js --name "word-backend"

# Configurar PM2 para iniciar no boot
pm2 startup
pm2 save
```

## Troubleshooting

### Problemas Comuns

1. **Erro de conexão WebSocket**:
   - Verifique se o backend está rodando na porta 3001
   - Confirme que o CORS está configurado corretamente

2. **Banco de dados não criado**:
   - Verifique permissões de escrita no diretório Backend
   - O arquivo `documents.db` é criado automaticamente

3. **Frontend não carrega**:
   - Verifique se todas as dependências foram instaladas
   - Execute `npm install` novamente se necessário

4. **Colaboração não funciona**:
   - Abra múltiplas abas/janelas para testar
   - Verifique o console do navegador para erros

### Logs

- **Backend**: Logs aparecem no terminal onde o servidor foi iniciado
- **Frontend**: Logs aparecem no console do navegador (F12)
- **Banco**: SQLite não gera logs por padrão

## Performance

### Otimizações Implementadas

- **Debounce** em mudanças de texto para evitar spam de eventos
- **Auto-save** a cada 30 segundos
- **Lazy loading** de componentes
- **Memoização** de componentes React quando apropriado
- **Compressão** de dados WebSocket

### Monitoramento

Para produção, considere implementar:
- **Rate limiting** nas APIs
- **Logging estruturado** com Winston
- **Métricas** com Prometheus
- **Health checks** para monitoramento
