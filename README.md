# Word Colaborativo

Um editor de documentos colaborativo em tempo real, similar ao Google Docs, desenvolvido com Node.js, Express, Socket.IO, React e Redux. Suporta edição em tempo real, autenticação de usuários, compartilhamento de documentos e controle de permissões.

## ✨ Funcionalidades

### 🔐 Autenticação e Usuários
- ✅ **Sistema de login/registro**: Criação de contas e autenticação segura com JWT
- ✅ **Perfis de usuário**: Gerenciamento de informações pessoais
- ✅ **Sessões persistentes**: Mantém usuários logados entre sessões

### 📝 Documentos
- ✅ **Edição em tempo real**: Múltiplos usuários podem editar simultaneamente
- ✅ **Sincronização automática**: Mudanças sincronizadas instantaneamente via WebSocket
- ✅ **Salvamento automático**: Documentos salvos automaticamente a cada 30 segundos
- ✅ **Títulos editáveis**: Altere títulos de documentos em tempo real
- ✅ **Contador de palavras**: Estatísticas do documento em tempo real

### 🤝 Colaboração
- ✅ **Usuários online**: Visualize quem está editando o documento
- ✅ **Indicadores de presença**: Saiba quantos usuários estão conectados
- ✅ **Notificações de entrada/saída**: Receba avisos quando usuários se conectam/desconectam

### 🔒 Compartilhamento e Permissões
- ✅ **Documentos públicos**: Torne documentos visíveis para todos
- ✅ **Documentos privados**: Mantenha documentos restritos ao proprietário
- ✅ **Compartilhamento direto**: Compartilhe documentos com usuários específicos
- ✅ **Controle de permissões**: Gerencie quem pode ver e editar documentos
- ✅ **Revogação de acesso**: Remova automaticamente usuários quando documentos ficam privados

### 🎨 Interface
- ✅ **Design moderno**: Interface limpa e responsiva
- ✅ **Modais interativos**: Configurações, compartilhamento e autenticação
- ✅ **Indicadores visuais**: Status de conexão, salvamento e atividade
- ✅ **Atalhos de teclado**: Navegação eficiente (Ctrl+S para salvar)

## 🛠 Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web minimalista
- **Socket.IO** - Comunicação em tempo real via WebSocket
- **SQLite3** - Banco de dados local embarcado
- **JWT** - Autenticação baseada em tokens
- **bcrypt** - Criptografia de senhas
- **UUID** - Geração de identificadores únicos
- **CORS** - Habilitação de requisições cross-origin

### Frontend
- **React 19** - Biblioteca de interface moderna
- **Redux Toolkit** - Gerenciamento de estado previsível
- **Socket.IO Client** - Cliente WebSocket para comunicação em tempo real
- **React Icons** - Conjunto abrangente de ícones
- **Vite** - Build tool e dev server ultra-rápido
- **ESLint** - Linting e qualidade de código

## 📁 Estrutura do Projeto

```
Word/
├── README.md                     # Documentação principal do projeto
├── SETUP.md                      # Guia de configuração
├── Backend/                      # Servidor Node.js
│   ├── package.json             # Dependências e scripts do backend
│   ├── server.js                # Arquivo principal do servidor
│   ├── README.md                # Documentação específica do backend
│   ├── documents.db             # Banco SQLite (criado automaticamente)
│   └── src/
│       ├── config/
│       │   └── index.js         # Configurações da aplicação
│       ├── database/
│       │   └── index.js         # Conexão e inicialização do banco
│       ├── middleware/
│       │   └── auth.js          # Middleware de autenticação JWT
│       ├── routes/
│       │   └── auth.js          # Rotas de autenticação HTTP
│       ├── services/
│       │   ├── authService.js   # Lógica de autenticação
│       │   ├── documentService.js # Lógica de documentos
│       │   └── broadcastService.js # Serviços de broadcast WebSocket
│       ├── socket/
│       │   ├── index.js         # Configuração principal dos handlers
│       │   ├── authHandlers.js  # Handlers de autenticação WebSocket
│       │   ├── documentHandlers.js # Handlers de documentos
│       │   └── collaborationHandlers.js # Handlers de colaboração
│       └── utils/
│           └── validation.js    # Utilitários de validação
└── Front/                       # Cliente React
    ├── package.json             # Dependências e scripts do frontend
    ├── vite.config.js           # Configuração do Vite
    ├── index.html               # Template HTML principal
    ├── README.md                # Documentação específica do frontend
    └── src/
        ├── App.jsx              # Componente principal da aplicação
        ├── main.jsx             # Ponto de entrada da aplicação
        ├── components/
        │   ├── AuthModal.jsx    # Modal de login/registro
        │   ├── CursorOverlay.jsx # Overlay para cursores de usuários
        │   ├── DocumentEditor.jsx # Editor de documentos
        │   ├── DocumentsList.jsx # Lista de documentos
        │   ├── SettingsModal.jsx # Modal de configurações
        │   └── ShareModal.jsx   # Modal de compartilhamento
        ├── services/
        │   ├── socketService.js # Cliente WebSocket
        │   └── apiService.js    # Cliente HTTP para API REST
        └── store/
            ├── index.js         # Configuração da store Redux
            └── slices/
                ├── documentSlice.js # Estado do documento atual
                ├── documentsSlice.js # Estado da lista de documentos
                └── collaborationSlice.js # Estado de colaboração
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js 16+ instalado
- npm ou yarn como gerenciador de pacotes

### 1. Clonar o Repositório
```bash
git clone <url-do-repositorio>
cd Word
```

### 2. Instalar Dependências

**Backend:**
```bash
cd Backend
npm install
```

**Frontend:**
```bash
cd Front
npm install
```

### 3. Executar o Projeto

**Opção 1: Executar separadamente**

Terminal 1 - Backend:
```bash
cd Backend
npm run dev
```
O servidor será iniciado na porta **3001** com hot-reload.

Terminal 2 - Frontend:
```bash
cd Front
npm run dev
```
O frontend será iniciado na porta **5173** com hot-reload.

**Opção 2: Scripts de produção**

Backend (produção):
```bash
cd Backend
npm start
```

Frontend (build):
```bash
cd Front
npm run build
npm run preview
```

### 4. Acessar a Aplicação

Abra seu navegador e acesse: `http://localhost:5173`

## 📋 Como Usar

### Primeiros Passos
1. **Registrar/Login**: Crie uma conta ou faça login com credenciais existentes
2. **Dashboard**: Visualize seus documentos próprios, compartilhados e públicos
3. **Criar documento**: Clique em "Novo Documento" e digite um título

### Gerenciamento de Documentos
1. **Editar**: Clique em qualquer documento para abrir o editor
2. **Configurações**: Use o botão de engrenagem para alterar título e visibilidade
3. **Compartilhar**: Use o botão de compartilhamento para dar acesso a outros usuários
4. **Excluir**: Delete documentos que não precisar mais

### Colaboração em Tempo Real
1. **Múltiplos usuários**: Abra o mesmo documento em várias abas/dispositivos
2. **Edição simultânea**: Digite e veja mudanças aparecerem instantaneamente
3. **Usuários online**: Observe o contador de usuários conectados
4. **Salvamento**: Use Ctrl+S ou aguarde o salvamento automático

### Controle de Acesso
- **Público**: Qualquer usuário logado pode ver e editar
- **Privado**: Apenas o proprietário e usuários com permissão específica
- **Compartilhamento**: Conceda acesso individual por nome de usuário

## 🎯 Funcionalidades do Editor

### Edição
- **Texto em tempo real**: Digite e veja mudanças instantâneas em outras sessões
- **Título editável**: Clique no campo de título para alterá-lo dinamicamente
- **Salvamento automático**: Documentos salvos a cada 30 segundos automaticamente
- **Salvamento manual**: Use Ctrl+S para forçar salvamento imediato

### Indicadores Visuais
- **Status de conexão**: Mostra se está conectado ao servidor
- **Usuários online**: Contador de usuários ativos no documento
- **Última sincronização**: Timestamp da última vez que foi salvo
- **Estatísticas**: Contador de palavras e caracteres em tempo real

### Atalhos do Teclado
- `Ctrl+S`: Salvar documento manualmente
- `Esc`: Fechar modais abertos

## 🔌 API Reference

### Endpoints HTTP

#### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/me` - Obter dados do usuário atual

#### Documentos
- `GET /api/documents` - Listar documentos do usuário
- `GET /api/documents/:id` - Obter documento específico
- `POST /api/documents` - Criar novo documento
- `PUT /api/documents/:id` - Atualizar documento
- `DELETE /api/documents/:id` - Excluir documento
- `POST /api/documents/:id/share` - Compartilhar documento
- `DELETE /api/documents/:id/share/:userId` - Remover compartilhamento

### WebSocket Events

#### Cliente → Servidor
- `authenticate` - Autenticar usuário via WebSocket
- `join-document` - Entrar em um documento específico
- `leave-document` - Sair de um documento
- `text-change` - Enviar mudança no conteúdo do texto
- `title-change` - Enviar mudança no título
- `save-document` - Forçar salvamento do documento
- `toggle-document-visibility` - Alterar visibilidade (público/privado)
- `share-document` - Compartilhar documento com usuário
- `remove-share` - Remover compartilhamento

#### Servidor → Cliente
- `authenticated` - Confirmação de autenticação
- `auth-error` - Erro de autenticação
- `document-content` - Conteúdo inicial do documento
- `document-error` - Erro relacionado ao documento
- `text-change` - Mudança no texto de outro usuário
- `title-change` - Mudança no título de outro usuário
- `user-joined` - Usuário entrou no documento
- `user-left` - Usuário saiu do documento
- `users-update` - Lista atualizada de usuários conectados
- `document-saved` - Confirmação de salvamento
- `document-access-revoked` - Acesso ao documento foi revogado
- `document-visibility-updated` - Visibilidade do documento alterada
- `documents-list` - Lista atualizada de documentos do usuário

## 💻 Desenvolvimento

### Modo de Desenvolvimento

Para executar em modo de desenvolvimento com hot-reload:

**Backend:**
```bash
cd Backend
npm run dev  # Usa nodemon para auto-reload
```

**Frontend:**
```bash
cd Front
npm run dev  # Usa Vite dev server com HMR
```

### Build para Produção

**Frontend:**
```bash
cd Front
npm run build     # Gera build otimizado
npm run preview   # Preview do build de produção
```

### Estrutura de Banco de Dados

O projeto usa SQLite com as seguintes tabelas:

```sql
-- Usuários
users (id, username, email, password_hash, created_at)

-- Documentos
documents (id, title, content, owner_id, is_public, created_at, updated_at)

-- Permissões de compartilhamento
document_permissions (id, document_id, user_id, permission_type, granted_at, granted_by)
```

### Scripts Disponíveis

**Backend:**
- `npm start` - Executar em produção
- `npm run dev` - Executar em desenvolvimento com nodemon

**Frontend:**
- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build
- `npm run lint` - Verificar qualidade do código

## 🔒 Segurança

### Autenticação
- Senhas criptografadas com bcrypt
- Tokens JWT para sessões seguras
- Autenticação via WebSocket e HTTP

### Autorização
- Verificação de permissões em cada operação
- Isolamento de documentos por usuário
- Controle granular de acesso (público/privado/compartilhado)

### Validação
- Validação de entrada em todas as rotas
- Sanitização de dados do usuário
- Verificação de ownership antes de operações

## 🚨 Solução de Problemas

### Problemas Comuns

**Erro de conexão WebSocket:**
- Verifique se o backend está rodando na porta 3001
- Confirme que não há firewall bloqueando a conexão
- Tente recarregar a página

**Documento não sincroniza:**
- Verifique a conexão com a internet
- Confirme que você tem permissão para editar o documento
- Tente sair e entrar novamente no documento

**Erro de autenticação:**
- Limpe os dados do localStorage
- Faça logout e login novamente
- Verifique se as credenciais estão corretas

### Logs de Debug

Para ativar logs detalhados:

**Backend:** Os logs são automáticos no console
**Frontend:** Abra as ferramentas de desenvolvedor (F12) e verifique o console

## 🛣 Roadmap e Melhorias Futuras

### Próximas Funcionalidades
- [ ] **Formatação de texto**: Negrito, itálico, sublinhado
- [ ] **Histórico de versões**: Controle de versão com rollback
- [ ] **Comentários**: Sistema de comentários em trechos específicos
- [ ] **Sugestões**: Modo de sugestão de edições
- [ ] **Export/Import**: PDF, Word, Markdown
- [ ] **Busca avançada**: Busca por conteúdo e tags
- [ ] **Templates**: Modelos pré-definidos de documentos

### Melhorias Técnicas
- [ ] **Modo offline**: Sincronização quando reconectar
- [ ] **Otimização de performance**: Lazy loading e virtualização
- [ ] **Testes automatizados**: Cobertura de testes unitários e E2E
- [ ] **Docker**: Containerização para deploy
- [ ] **CI/CD**: Pipeline de deploy automatizado
- [ ] **Monitoramento**: Logs estruturados e métricas

### UX/UI
- [ ] **Modo escuro**: Tema escuro para a interface
- [ ] **Cursores em tempo real**: Visualização de cursores de outros usuários
- [ ] **Notificações**: Sistema de notificações push
- [ ] **Mobile**: App mobile nativo ou PWA
- [ ] **Acessibilidade**: Melhor suporte para leitores de tela
