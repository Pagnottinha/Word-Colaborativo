# Word Colaborativo

Um editor de documentos colaborativo em tempo real, similar ao Google Docs, desenvolvido com Node.js, Express, Socket.IO, React e Redux.

## Funcionalidades

- ✅ **Edição em tempo real**: Múltiplos usuários podem editar o mesmo documento simultaneamente
- ✅ **Sincronização automática**: Mudanças são sincronizadas instantaneamente via WebSocket
- ✅ **Gerenciamento de documentos**: Criar, editar, excluir e listar documentos
- ✅ **Salvamento automático**: Documentos são salvos automaticamente a cada 30 segundos
- ✅ **Interface moderna**: Design responsivo e intuitivo
- ✅ **Indicadores de colaboração**: Mostra quantos usuários estão online
- ✅ **Persistência de dados**: Dados armazenados em banco SQLite

## Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **Socket.IO** - Comunicação em tempo real via WebSocket
- **SQLite3** - Banco de dados local
- **CORS** - Habilitação de CORS
- **UUID** - Geração de IDs únicos

### Frontend
- **React** - Biblioteca de interface
- **Redux Toolkit** - Gerenciamento de estado
- **Socket.IO Client** - Cliente WebSocket
- **React Icons** - Ícones
- **Vite** - Build tool e dev server

## Estrutura do Projeto

```
Word/
├── Backend/
│   ├── package.json
│   ├── server.js
│   └── documents.db (criado automaticamente)
└── Front/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── App.css
        ├── main.jsx
        ├── components/
        │   ├── DocumentsList.jsx
        │   └── DocumentEditor.jsx
        ├── services/
        │   ├── socketService.js
        │   └── apiService.js
        └── store/
            ├── index.js
            └── slices/
                ├── documentSlice.js
                ├── documentsListSlice.js
                └── collaborationSlice.js
```

## Como Executar

### 1. Iniciar o Backend

```bash
cd Backend
npm start
```

O servidor será iniciado na porta 3001.

### 2. Iniciar o Frontend

```bash
cd Front
npm run dev
```

O frontend será iniciado na porta 5173.

### 3. Acessar a aplicação

Abra seu navegador e acesse: `http://localhost:5173`

## Como Usar

1. **Criar um documento**: Clique em "Novo Documento" e digite um título
2. **Editar um documento**: Clique em qualquer documento da lista para abrir o editor
3. **Colaboração**: Abra a mesma aplicação em múltiplas abas/janelas para simular colaboração
4. **Salvar**: Use Ctrl+S ou o botão "Salvar" para salvar manualmente (ou aguarde o salvamento automático)
5. **Voltar à lista**: Clique em "Voltar" no editor para retornar à lista de documentos

## Funcionalidades do Editor

- **Edição em tempo real**: Digite e veja as mudanças aparecerem instantaneamente em outras janelas
- **Título editável**: Clique no campo de título para alterá-lo
- **Indicadores de status**: 
  - Status de conexão (Conectado/Desconectado)
  - Número de usuários online
  - Última vez que foi salvo
  - Contador de palavras e caracteres
- **Atalhos do teclado**:
  - `Ctrl+S`: Salvar documento

## API Endpoints

### Documentos
- `GET /api/documents` - Listar todos os documentos
- `GET /api/documents/:id` - Obter um documento específico
- `POST /api/documents` - Criar novo documento
- `PUT /api/documents/:id` - Atualizar documento
- `DELETE /api/documents/:id` - Excluir documento

### WebSocket Events

#### Cliente → Servidor
- `join-document` - Entrar em um documento
- `leave-document` - Sair de um documento
- `text-change` - Mudança no texto
- `title-change` - Mudança no título
- `save-document` - Salvar documento
- `cursor-position` - Posição do cursor

#### Servidor → Cliente
- `document-data` - Dados do documento
- `text-change` - Mudança no texto de outro usuário
- `title-change` - Mudança no título de outro usuário
- `user-joined` - Usuário entrou no documento
- `user-left` - Usuário saiu do documento
- `document-saved` - Documento foi salvo
- `cursor-position` - Posição do cursor de outro usuário

## Desenvolvimento

### Modo de Desenvolvimento

Para executar em modo de desenvolvimento com hot-reload:

**Backend:**
```bash
cd Backend
npm install -g nodemon  # Se não tiver o nodemon instalado
npm run dev
```

**Frontend:**
```bash
cd Front
npm run dev
```

### Build para Produção

```bash
cd Front
npm run build
```

## Melhorias Futuras

- [ ] Autenticação de usuários
- [ ] Permissões de documentos (público/privado)
- [ ] Histórico de versões
- [ ] Comentários em documentos
- [ ] Formatação de texto (negrito, itálico, etc.)
- [ ] Export para PDF/Word
- [ ] Modo escuro
- [ ] Busca em documentos
- [ ] Tags e categorias
- [ ] Cursor de outros usuários em tempo real

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
