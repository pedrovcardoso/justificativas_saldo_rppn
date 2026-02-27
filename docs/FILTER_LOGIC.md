# Arquitetura de Filtros — Dashboard RPPN

## Visão Geral

A página do dashboard utiliza **3 variáveis globais em memória** para controlar o estado dos dados, evitando consultas repetidas e mantendo separação clara entre filtros do painel lateral e filtros de coluna da tabela.

---

## Variáveis Globais

| Variável | Tipo | Conteúdo |
|---|---|---|
| `rawData` | `Array<Object>` | Todos os registros, parseados e enriquecidos. Imutável após `loadData`. |
| `panelFilteredData` | `Array<Object>` | Subconjunto de `rawData` após aplicar os filtros do painel lateral. Atualizado sempre que `reloadUI` é chamada. |
| `tableFilteredData` | `Array<Object>` | Subconjunto de `panelFilteredData` após aplicar os filtros de coluna da tabela. Também exposto como `window._tableFilteredData` para o `custom-table.js`. |

---

## Fluxo de Dados

```
loadData()
  ├── rawData = parseCSV() + enrichRows()
  ├── buildTableHeader()
  ├── populateFilterOptions()   → lê rawData
  └── reloadUI()

reloadUI()
  ├── applyPanelFilters()       → rawData → panelFilteredData
  ├── applyTableColumnFilters() → panelFilteredData → tableFilteredData
  ├── updateCards(panelFilteredData)
  └── renderCurrentPage()       → usa tableFilteredData (paginado)
```

---

## Painel de Filtros

### Campos disponíveis
- **Unidade Executora** — custom-select multi (id: `filterUE`)
- **Programa** — custom-select multi (id: `filterPrograma`)
- **Elemento Item** — custom-select multi (id: `filterElemento`)
- **Status** — custom-select multi (id: `filterStatus`)
- **Saldo Mínimo** — campo numérico (id: `filterSaldoMin`) — padrão: `0.01`
- **Saldo Máximo** — campo numérico (id: `filterSaldoMax`) — padrão: vazio
- **Busca Geral** — campo texto (id: `searchInput`)

### Comportamento
- As opções dos selects exibem sempre os valores **distintos de `rawData`** (não do subconjunto filtrado).
- Qualquer alteração nos selects ou campos aciona `reloadUI()`.
- Os cards (total, pendentes, finalizados) refletem `panelFilteredData`.

### Funções relevantes (`script.js`)
| Função | Responsabilidade |
|---|---|
| `populateFilterOptions()` | Lê `rawData` e repopula os selects via `setCustomSelectOptions` |
| `applyPanelFilters()` | Filtra `rawData` com todos os critérios do painel → `panelFilteredData` |
| `reloadUI()` | Orquestra toda a atualização da UI após mudança no painel |

---

## Filtros de Coluna da Tabela

### Comportamento
- Cada coluna possui um botão de filtro que abre um menu de checkboxes.
- As opções do menu percorrem **todo `tableFilteredData`** (não só a página atual do DOM), portanto capturam todos os valores presentes nos dados filtrados pelo painel.
- Os filtros de coluna são **sobrepostos**: o filtro da coluna A impacta as opções exibidas pelo filtro da coluna B, pois ambos operam sobre o mesmo `tableFilteredData`.
- Filtros de coluna **não acionam** `reloadUI()` — disparam apenas o evento `tableFiltersChanged`, que chama `applyTableColumnFilters()` + `renderCurrentPage()`.
- Os cards **não são** afetados pelos filtros de coluna.

### Funções relevantes
| Local | Função | Responsabilidade |
|---|---|---|
| `script.js` | `applyTableColumnFilters()` | Filtra `panelFilteredData` com `getActiveTableFilters()` → `tableFilteredData` |
| `custom-table.js` | `openFilterMenu()` | Lê `window._tableFilteredData` para montar as opções do menu |
| `custom-table.js` | `applyTableFilters()` | Dispara `tableFiltersChanged` |

---

## Botão Limpar Filtros (`clearAllFilters`)

Ao ser acionado, executa em ordem:

1. Limpa o campo `searchInput`
2. Restaura `filterSaldoMin` para `0.01`
3. Limpa `filterSaldoMax`
4. Chama `clearCustomSelect` para cada select do painel *(sem disparar o evento de change)*
5. Dispara o evento global `clearAllFilters` → `custom-table.js` zera `activeFilters` e restaura ícones dos filtros de coluna
6. Chama `reloadUI()` para atualizar tudo

> **Nota:** `clearCustomSelect` não dispara o evento de change registrado via `onCustomSelectChange`, garantindo que o passo 6 seja a única chamada a `reloadUI`.

---

## Eventos

| Evento | Quem dispara | Quem escuta | Efeito |
|---|---|---|---|
| `tableFiltersChanged` | `custom-table.js` (ao mudar checkbox de coluna) | `script.js` | Chama `applyTableColumnFilters` + `renderCurrentPage` |
| `clearAllFilters` | `script.js` (clearAllFilters) | `custom-table.js` | Zera `activeFilters` e restaura ícones |
| `onCustomSelectChange` callback | `custom-select.js` (ao selecionar/deselecionar item) | `script.js` (registrado em `populateFilterOptions`) | Chama `reloadUI` |

---

## Paginação

A paginação opera sempre sobre `tableFilteredData`. A variável `currentPage` é resetada para `1` sempre que `reloadUI` é chamada. Filtros de coluna também resetam a página via `renderCurrentPage`.
