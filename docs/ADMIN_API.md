# Admin API — Especificação de Endpoints

Todos os endpoints admin devem ser integrados ao mesmo `API_URLS` centralizado em `api.js`. O padrão atual do projeto usa uma única URL base (Power Automate flow) com um campo `endpoint` no body para roteamento.

---

## Autenticação

Todos os endpoints admin exigem `user` e `token` válidos no body. O backend deve verificar se o usuário autenticado tem `role === "admin"` antes de processar a requisição.

---

## 1. Usuários

### `getUsers`
**Endpoint:** `get_users`

```json
{
  "endpoint": "get_users",
  "user": "string",
  "token": "string"
}
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": [
    { "username": "string", "role": "user|admin", "uo": "string|null" }
  ]
}
```

---

### `createUser`
**Endpoint:** `create_user`

```json
{
  "endpoint": "create_user",
  "user": "string",
  "token": "string",
  "username": "string",
  "role": "user|admin",
  "uo": "string|null"
}
```

**Resposta esperada:**
```json
{ "success": true }
```

---

### `updateUser`
**Endpoint:** `update_user`

```json
{
  "endpoint": "update_user",
  "user": "string",
  "token": "string",
  "username": "string",
  "role": "user|admin",
  "uo": "string|null"
}
```

**Resposta esperada:**
```json
{ "success": true }
```

---

## 2. Notificações

### `getNotifications`
**Endpoint:** `get_notifications`

```json
{
  "endpoint": "get_notifications",
  "user": "string",
  "token": "string"
}
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": [
    { "id": "string", "titulo": "string", "mensagem": "string", "tipo": "info|aviso|urgente", "ativo": true }
  ]
}
```

---

### `createNotification`
**Endpoint:** `create_notification`

```json
{
  "endpoint": "create_notification",
  "user": "string",
  "token": "string",
  "titulo": "string",
  "mensagem": "string",
  "tipo": "info|aviso|urgente",
  "ativo": true
}
```

**Resposta esperada:**
```json
{ "success": true, "data": { "id": "string" } }
```

---

### `updateNotification`
**Endpoint:** `update_notification`

```json
{
  "endpoint": "update_notification",
  "user": "string",
  "token": "string",
  "id": "string",
  "titulo": "string",
  "mensagem": "string",
  "tipo": "info|aviso|urgente",
  "ativo": true
}
```

**Resposta esperada:**
```json
{ "success": true }
```

---

### `deleteNotification`
**Endpoint:** `delete_notification`

```json
{
  "endpoint": "delete_notification",
  "user": "string",
  "token": "string",
  "id": "string"
}
```

**Resposta esperada:**
```json
{ "success": true }
```

---

## 3. Avaliação de Decisões (já implementado)

O endpoint `avaliar_status` já existe no backend e é chamado por `avaliarStatus()` em `api.js`.

```json
{
  "endpoint": "avaliar_status",
  "user": "string",
  "token": "string",
  "rppn": "string",
  "status": "aceito|rejeitado",
  "motivo_rejeicao": "string",
  "dados": [{ "rppn": "string", "id": "string" }]
}
```

---

## 4. CMS de Legislação

A legislação é atualmente gerenciada localmente via `assets/json/legislacao.json`. Para persistência no backend, serão necessários os seguintes endpoints:

### `getLegislacao` / `saveLegislacao`

> [!NOTE]
> O CMS de legislação no frontend já funciona com edição local do JSON. Os endpoints abaixo são necessários apenas para persistência no servidor.

**Endpoint:** `save_legislacao`

```json
{
  "endpoint": "save_legislacao",
  "user": "string",
  "token": "string",
  "items": [
    {
      "titulo": "string",
      "tipo": "string",
      "numero": "string",
      "ano": "string",
      "esfera": "Federal|Estadual|Municipal",
      "status": "Vigente|Revogado|Suspenso",
      "ementa": "string",
      "url": "string",
      "tags": ["string"]
    }
  ]
}
```

**Resposta esperada:**
```json
{ "success": true }
```
