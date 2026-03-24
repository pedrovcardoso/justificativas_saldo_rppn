# Documentação de Status dos Processos

Esta seção descreve os estados possíveis para cada RPPN no dashboard, baseados na combinação dos dados de **Decisão** e **Avaliação**.

## Opções de Filtro (Painel de Filtros)

As opções de filtro para as colunas virtuais são fixas:

- **Decisão**: `Manter`, `Cancelar`, `(em branco)`
- **Avaliação**: `Pendente`, `Aceito`, `Rejeitado`, `(em branco)`
- **Status**: `Pendente`, `Em análise`, `Concluído`, `Retorno`

## Cores das Badges

| Valor | Cor | Significado |
| :--- | :--- | :--- |
| **Manter** | Azul (`sky`) | Decisão de manter o saldo registrada. |
| **Cancelar** | Vermelho (`rose`) | Decisão de cancelar o saldo registrada. |
| **Pendente** | Amarelo (`amber`) | Aguardando ação ou avaliação inicial. |
| **Em análise** | Laranja (`orange`) | Decisão registrada, aguardando aprovação técnica. |
| **Concluído** / **Aceito** | Verde (`emerald`) | Processo aprovado tecnicamente. |
| **Retorno** / **Rejeitado** | Vermelho (`rose`) | Registro rejeitado ou necessita correção. |

## Lógica de Status (Coluna Status)

O status final é determinado conforme a presença de Decisão e o estado da Avaliação:

| Cenário | Decisão | Avaliação | Status Final | Cor |
| :--- | :--- | :--- | :--- | :--- |
| **Sem Ação** | (vazio) | (vazio) | **Pendente** | Amarelo |
| **Aguardando** | `Manter` / `Cancelar` | (vazio) | **Em análise** | Laranja |
| **Em Revisão** | `Manter` / `Cancelar` | `Pendente` | **Em análise** | Laranja |
| **Aprovado** | `Manter` / `Cancelar` | `Aceito` | **Concluído** | Verde |
| **Reprovado** | `Manter` / `Cancelar` | `Rejeitado` | **Retorno** | Vermelho |

## Observações Técnicas

- **Sentence Case**: Todos os termos usam apenas a primeira letra maiúscula (ex: "Em análise").
- **Materialização**: Os campos virtuais são injetados nos objetos para permitir filtros de cabeçalho.
- **Sincronização**: Realizada em tempo real via `check_status` no carregamento dos dados.
