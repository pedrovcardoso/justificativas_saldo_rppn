# Arquitetura de Filtros — Dashboard RPPN

## Visão Geral

A página do dashboard utiliza um sistema de filtragem em cascata baseado em **3 variáveis globais em memória**. Esta abordagem permite uma interface reativa e rápida, evitando chamadas repetitivas ao servidor e mantendo a integridade dos dados originais.

---

## Variáveis Globais

| Variável | Tipo | Conteúdo |
|---|---|---|
| `rawData` | `Array<Object>` | Registros parseados, enriquecidos via `enrichRows` e imutáveis após o carregamento inicial (`loadData`). |
| `panelFilteredData` | `Array<Object>` | Subconjunto de `rawData` após a aplicação dos filtros do painel lateral. Atualizado em cada `reloadUI`. |
| `tableFilteredData` | `Array<Object>` | Subconjunto de `panelFilteredData` após filtros de coluna. É a base para a renderização da tabela e paginação. |

---

## Fluxo de Processamento

1.  **`loadData()`**:
    - Obtém dados brutos da API.
    - Executa `enrichRows()`: Injeta nomes descritivos (UE, UO, Programa, Itens) e calcula os campos virtuais (**Decisão**, **Avaliação**, **Status**).
    - Popula as opções dos filtros baseada nos valores únicos presentes em `rawData`.
2.  **`reloadUI()`**:
    - **`applyPanelFilters()`**: Filtra `rawData` → `panelFilteredData`.
    - **`applyTableColumnFilters()`**: Filtra `panelFilteredData` → `tableFilteredData`.
    - Atualiza os cards (KPIs) com base no `panelFilteredData`.
    - Reseta a paginação e chama `renderCurrentPage()`.

---

## Painel de Filtros (Painel Lateral)

### Campos de Filtragem
| Campo | ID do Elemento | Tipo | Observação |
|---|---|---|---|
| **Busca Geral** | `searchInput` | Texto | Pesquisa em todas as colunas visíveis. |
| **Unidade Orçamentária** | `filterUO` | Multi-select | Exibido apenas para perfis Administradores. |
| **Unidade Executora** | `filterUE` | Multi-select | |
| **Programa** | `filterPrograma` | Multi-select | |
| **Elemento Item** | `filterElemento` | Multi-select | |
| **Status do Processo** | `filterStatusProcesso` | Multi-select | Representa o estado final do fluxo. |
| **Decisão** | `filterDecisao` | Multi-select | `Manter`, `Cancelar` ou `(em branco)`. |
| **Avaliação** | `filterAvaliacao` | Multi-select | `Pendente`, `Aceito`, `Rejeitado` ou `(em branco)`. |
| **Saldo (Mín/Máx)** | `filterSaldoMin` / `Max` | Numérico | Filtra pelo valor do Saldo RPPN. |

### Comportamento
- Os filtros do painel são **independentes** entre si em termos de opções (as opções do select mostram sempre todos os valores possíveis do banco de dados).
- Qualquer alteração aciona o ciclo completo de `reloadUI()`.
- Os **Cards de Resumo** refletem apenas estes filtros (ignorando filtros de coluna).

---

## Filtros de Coluna da Tabela

### Comportamento
- **Efeito cascata**: As opções de filtro da Coluna B são limitadas pelo que já foi filtrado na Coluna A.
- **Armazenamento**: O estado dos filtros de coluna é gerido pelo componente `custom-table.js`.
- **Independência de UI**: Alterar um filtro de coluna não recalcula os cards de resumo no topo da página.

---

## Lógica de Sincronização e Eventos

- **`tableFiltersChanged`**: Disparado pelo componente de tabela. O dashboard escuta e atualiza o `tableFilteredData` e a interface.
- **`clearAllFilters`**: Limpa todos os estados (painel e colunas) e força um `reloadUI()`.
- **Cache**: Os dados enriquecidos são armazenados no `sessionStorage` (`rppn_data_cache`) para agilizar recarregamentos da página no mesmo acesso.

---
*Nota: A lógica de materialização dos campos "Decisão", "Avaliação" e "Status" ocorre no frontend, correlacionando os dados orçamentários com o histórico de justificativas recebido da API.*
