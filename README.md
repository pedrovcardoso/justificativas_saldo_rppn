# Gerenciador de Justificativas de Saldo RPPN

Sistema para gestão, análise e acompanhamento de **Restos a Pagar Não Processados (RPPN)**, permitindo o registro de justificativas técnicas para manutenção ou cancelamento de saldos orçamentários.

## Desenvolvimento
- Pedro Henrique Vieira Cardoso
- Superintendência Central de Contadoria Geral - SCCG
- [pedro.cardoso@fazenda.mg.gov.br](mailto:pedro.cardoso@fazenda.mg.gov.br)

## Tecnologias e Dependências

O sistema utiliza um stack moderno focado em performance e manutenibilidade:

- **Frontend**: HTML5, Tailwind CSS e Vanilla JavaScript.
- **Backend (API Intermediation)**: Next.js, Node.js.
- **Banco de Dados**: MySQL.
- **Dependências Principais**:
  - `next`: Framework para rotas de API e infraestrutura.
  - `mysql2`: Conectividade com o banco de dados.
  - `react`: Base para o motor do Next.js.

## Arquitetura do Sistema

A arquitetura foi projetada para ser modular e desacoplada, garantindo que o processamento de dados e a interface do usuário operem de forma independente.

### Camada de Frontend
- **Arquitetura de Componentes**: Utiliza componentes customizados reutilizáveis (ex: `custom-select`, `custom-table`) localizados em `/frontend/components`.
- **Gerenciamento de Estado**: O estado dos filtros e dados é mantido em memória (`rawData`, `panelFilteredData`, `tableFilteredData`) para evitar requisições desnecessárias.
- **Vanilla Core**: A lógica de UI é baseada em JavaScript puro, reduzindo o overhead de frameworks e garantindo carregamento instantâneo.

### Camada de Backend
- **Fluxos de Dados (Next.js)**: Centraliza a comunicação com o banco de dados e expõe endpoints para o frontend.
- **Processamento de CSV/Lote**: Capaz de processar grandes volumes de dados de RPPN e realizar o "enrichment" (enriquecimento) dos dados antes da exibição.

### Estrutura de Pastas
- `frontend/`: Contém os arquivos estáticos e componentes da interface.
- `backend/`: Contém a lógica de API, conexões de banco e workflows.
- `docs/`: Manuais técnicos e lógica de negócio detalhada.

### Principais Funcionalidades

- **Dashboard Executivo**: Visualização resumida de saldos totais, volumes em análise, concluídos e pendentes.
- **Relatórios Dinâmicos**: Tabela avançada com filtros multicamadas (painel lateral + filtros por coluna).
- **Fluxo de Aprovação**:
  - Registro de decisão (**Manter** ou **Cancelar**).
  - Avaliação técnica (**Aceito** ou **Rejeitado**).
  - Status automático baseado na combinação de decisão e avaliação.
- **Gestão de Legislação**: Biblioteca de normas relacionadas aos processos de restos a pagar.
- **Padronização de Justificativas**: Sistema de formulários dinâmicos e personalizados para cada cenário, garantindo a conformidade e qualidade das informações registradas.
- **Notificações**: Sistema de avisos para usuários sobre pendências ou prazos.

## Lógica de Status

Os processos seguem uma máquina de estados baseada nas ações do usuário e do avaliador:

| Cenário | Decisão | Avaliação | Status Final |
| :--- | :--- | :--- | :--- |
| **Inicial** | (vazio) | (vazio) | **Pendente** |
| **Ação Registrada** | Manter / Cancelar | (vazio) | **Em análise** |
| **Aprovado** | Manter / Cancelar | Aceito | **Concluído** |
| **Revisão Necessária** | Manter / Cancelar | Rejeitado | **Retorno** |
