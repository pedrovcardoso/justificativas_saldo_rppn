# Documentação de Status dos Processos

Esta seção descreve os estados possíveis para cada RPPN (Restos a Pagar Não Processados) no dashboard, baseados na combinação dos dados de **Decisão** e **Avaliação**.

## Opções de Filtro (Painel de Filtros)

As opções de filtro para as colunas virtuais são fixas, garantindo que o painel esteja sempre completo:

- **Decisão**: `Manter`, `Cancelar`, `(em branco)`
- **Avaliação**: `Pendente`, `Aceito`, `Rejeitado`, `(em branco)`
- **Status**: `Pendente`, `Em análise`, `Concluído`, `Retorno`

## Lógica de Status e Exibição

A exibição das colunas segue as regras de capitalização (Sentence Case) abaixo:

| Cenário | Decisão (Coluna) | Avaliação (Coluna) | Status (Coluna) | Badge Cor | Descrição |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sem Registro / Sem Ação** | (em branco) | (em branco) | **Pendente** | Amarelo (`amber`) | Aguardando registro de decisão inicial. |
| **Decisão mas sem Status** | `Manter` / `Cancelar` | `Pendente` | **Pendente** | Amarelo (`amber`) | Decisão registrada, mas status da avaliação ainda nulo. |
| **Decisão e Status Pendente** | `Manter` / `Cancelar` | `Pendente` | **Em análise** | Laranja (`orange`) | Avaliação marcada como pendente pelo analista. |
| **Avaliado como Aceito** | `Manter` / `Cancelar` | `Aceito` | **Concluído** | Verde (`emerald`) | Processo finalizado com aprovação técnica. |
| **Avaliado como Rejeitado** | `Manter` / `Cancelar` | `Rejeitado` | **Retorno** | Vermelho (`rose`) | Necessita de revisão após rejeição técnica. |

## Observações Técnicas

- **Opção "(em branco)"**: Nos filtros de Decisão e Avaliação, a opção `(em branco)` seleciona registros que não possuem valor preenchido para aquele campo.
- **Capitalização**: Todos os termos de status agora usam apenas a primeira letra maiúscula (e.g., "Em análise").
- **Materialização**: Os campos **Decisão**, **Avaliação** e **Status** são injetados nos objetos de dados para possibilitar o uso dos filtros de cabeçalho.
- **Sincronização**: Dados consultados em tempo real (sem cache), garantindo visibilidade imediata de alterações.
