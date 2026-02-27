## Documentação da API de Fluxos do Power Automate Cloud

### Estrutura de Retorno Padrão

Todas as respostas da API seguem a seguinte estrutura padrão:

```json
{
  "success": boolean,
  "error": "string",
  "message": "string",
  "data": {}
}
```

*   `success`: Indica se a requisição foi bem-sucedida (`true`) ou não (`false`).
*   `error`: Uma mensagem de erro, presente apenas quando `success` é `false`.
*   `message`: Uma mensagem descritiva sobre o resultado da operação.
*   `data`: Um objeto contendo dados adicionais relevantes para a resposta (pode ser vazio).

---

### Fluxo 1: Autenticação (Auth)

**URL Base:** `https://default4c86fd71d0164231a16057311d68b9.51.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6268733c89d34beab95650687b639b00/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ASdpJccB3BlVWq_VnabESl91OirL3FRe6Uxy5L6dgT4`

Este fluxo gerencia a autenticação e validação de sessões de usuários.

#### Esquema do Corpo da Requisição

```json
{
    "type": "object",
    "properties": {
        "endpoint": {
            "type": "string",
            "description": "O endpoint específico a ser acionado dentro do fluxo."
        },
        "user": {
            "type": "string",
            "description": "Email do usuário."
        },
        "otp_code": {
            "type": "string",
            "description": "Código OTP para validação."
        },
        "otp_channel": {
            "type": "string",
            "description": "Canal pelo qual o OTP será enviado (ex: email, sms)."
        },
        "token": {
            "type": "string",
            "description": "Token de autenticação da sessão."
        }
    },
    "required": [
        "endpoint",
        "user"
    ]
}
```

#### Endpoints

##### `send_otp`

Envia um código OTP (One-Time Password) para o usuário.

*   **Parâmetros Necessários no Corpo da Requisição:** `endpoint`, `user`
*   **Respostas:**
    *   `400 Bad Request`: `{ "success": false, "error": "Formato de usuário inválido." }`
    *   `404 Not Found`: `{ "success": false, "error": "Usuário não encontrado." }`
    *   `200 OK`: `{ "success": true, "message": "OTP enviado com sucesso por email." }`

##### `validate_otp`

Valida um código OTP fornecido pelo usuário.

*   **Parâmetros Necessários no Corpo da Requisição:** `endpoint`, `user`, `otp_code`
*   **Respostas:**
    *   `400 Bad Request`: `{ "success": false, "error": "Formato de usuário ou OTP inválido." }`
    *   `401 Unauthorized`: `{ "success": false, "error": "OTP inválido." }`
    *   `401 Unauthorized`: `{ "success": false, "error": "OTP expirado." }`
    *   `409 Conflict`: `{ "success": false, "error": "OTP já utilizado." }`
    *   `200 OK`: `{ "success": true, "message": "OTP validado com sucesso.", "data": { "role": "...", "uo": "...", "token": "...", "expires_in": 7200 } }`

##### `validate_session`

Revalida a sessão de um usuário utilizando um token existente.

*   **Parâmetros Necessários no Corpo da Requisição:** `endpoint`, `user`, `token`
*   **Respostas:**
    *   `400 Bad Request`: `{ "success": false, "error": "Formato de token ou usuário inválido." }`
    *   `404 Not Found`: `{ "success": false, "error": "Token não encontrado." }`
    *   `200 OK`: `{ "success": true, "message": "Sessão revalidada com sucesso.", "data": { "role": "...", "uo": "...", "token": "...", "expires_in": 7200 } }`

##### `logout`

Realiza o logout de um usuário, invalidando sua sessão.

*   **Parâmetros Necessários no Corpo da Requisição:** `endpoint`, `user`, `token`
*   **Respostas:**
    *   `200 OK`: `{ "success": true, "message": "Logout realizado com sucesso." }`

---

### Fluxo 2: Salvar Justificativa

**URL Base:** `https://default4c86fd71d0164231a16057311d68b9.51.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/0339340250294a70816277b8caec377b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=LgZyWNXrffi1WjtYAETFQ9P3GGY12sNfB07_kEjCW5I`

Este fluxo permite registrar e avaliar justificativas.

**Observação:** Este fluxo pode acionar o endpoint `validate_session` do **Fluxo 1 - Auth** e, portanto, pode retornar suas respectivas respostas.

#### Esquema do Corpo da Requisição

```json
{
    "type": "object",
    "properties": {
        "user": {
            "type": "string",
            "description": "Email do usuário."
        },
        "token": {
            "type": "string",
            "description": "Token de autenticação da sessão."
        },
        "endpoint": {
            "type": "string",
            "description": "O endpoint específico a ser acionado dentro do fluxo."
        },
        "rppn": {
            "type": "string",
            "description": "Identificador do restos a pagar."
        },
        "id": {
            "type": "string",
            "description": "ID da justificativa."
        },
        "justificativa": {
            "type": "string",
            "description": "Texto da justificativa."
        },
        "acao": {
            "type": "string",
            "description": "Ação a ser tomada (ex: 'manter', 'cancelar')."
        },
        "status": {
            "type": "string",
            "description": "Status da justificativa (ex: 'Aceito', 'Rejeitado')."
        },
        "motivo_rejeicao": {
            "type": "string",
            "description": "Motivo da rejeição da justificativa, se aplicável."
        },
        "dados": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rppn": { "type": "string" },
                    "id": { "type": "string" }
                }
            }
        }
    },
    "required": [
        "user",
        "token",
        "endpoint"
    ]
}
```

#### Endpoints

##### `justificar`

Salva uma nova justificativa ou atualiza uma existente (em lote).

*   **Parâmetros Necessários no Corpo da Requisição:** `user`, `token`, `endpoint`, `acao`, `justificativa`, `dados` (lista de objetos com `rppn`)

**Exemplo de Requisição:**
```json
{
	"user":"pedro.cardoso@fazenda.mg.gov.br",
	"token":"05a6bf58-f500-4a9d-9bb5-54efb8716cca",
	"endpoint":"justificar",
	"acao":"manter",
	"justificativa":"contrato em aberto",
	"dados":[
		{
			"rppn": "1261.1260160.2014.870.12.361.15.4585.1.3.3.90.93.09.10.1"
		},
		{
			"rppn": "1261.1260160.2014.870.12.361.15.4585.1.3.3.90.93.08.70.1"
		}
	]
}
```

*   **Respostas (Array):**
    *   `200 OK`: `[{ "success": true, "statusCode": "200", "message": "Dados salvos com sucesso.", "data": { "id": "...", "rppn": "..." } }]`
    *   `409 Conflict`: `[{ "success": false, "statusCode": "409", "error": "Outra justificativa em aberto.", "data": { "rppn": "..." } }]`

##### `avaliar_status`

Atribui status para justificativas existentes (em lote).

*   **Parâmetros Necessários no Corpo da Requisição:** `user`, `token`, `endpoint`, `rppn`, `status`, `motivo_rejeicao`, `dados` (lista de `rppn` e `id`)
*   **Respostas (Array):**
    *   `200 OK`: `[{ "success": true, "statusCode": "200", "message": "Dados salvos com sucesso." }]`

---

### Fluxo 3: Obter Dados (Get Data)

**URL Base:** `https://default4c86fd71d0164231a16057311d68b9.51.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/4ed1dbc6dd1649fa957c1a7c2e0a2c1a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=N9lHULFnjKfbzt2X5wSSTZJ6TNxtbNxrRrseb69iPPA`

Este fluxo é responsável por obter dados no banco.

**Observação:** Este fluxo pode acionar o endpoint `validate_session` do **Fluxo 1 - Auth** e, portanto, pode retornar suas respectivas respostas.

#### Esquema do Corpo da Requisição

```json
{
    "type": "object",
    "properties": {
        "user": {
            "type": "string"
        },
        "token": {
            "type": "string"
        },
        "endpoint": {
            "type": "string"
        }
    },
    "required": [
        "endpoint",
        "user",
        "token"
    ]
}
```

#### Endpoints

##### `get_data`

Obtém dados da unidade, em formato CSV separado por ponto e vírgula (`;`).

*   **Parâmetros Necessários no Corpo da Requisição:** `user`, `token`, `endpoint`
*   **Respostas:**
    *   `200 OK`: `{ "success": true, "message": "Dados validados com sucesso.", "data": { "csv": "...", "role": "...", "uo": "..." } }`

##### `check_status`

Verifica o status de uma lista de restos a pagar.

*   **Parâmetros Necessários no Corpo da Requisição:** `user`, `token`, `endpoint`
*   **Respostas:**
    *   `200 OK`: `{ "success": true, "message": "Dados validados com sucesso.", "data": { "status": [{ "id_justificativa": "...", "rppn": "...", "user_justificativa": "...", "user_avaliador": "...", "acao": "...", "justificativa": "...", "status": "...", "motivo_rejeicao": "...", "data_criacao": "yyyy-mm-ddThh:mm:ssZ", "data_avaliacao": "yyyy-mm-ddThh:mm:ssZ" }], "role": "...", "uo": "..." } }`