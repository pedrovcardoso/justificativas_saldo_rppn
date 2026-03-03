# Guia: Configuração do Banco de Dados MySQL

Este guia detalha como instalar, configurar e popular o banco de dados para o sistema de Justificativas RPPN.

---

## 1. Baixar e Instalar o MySQL (Windows)

Se você ainda não tem o MySQL instalado:

1.  Acesse a [página de download do MySQL Installer](https://dev.mysql.com/downloads/installer/).
2.  Escolha a versão **"web community"** (a menor) e clique em **Download**.
3.  Execute o instalador:
    *   Escolha o tipo de instalação **"Developer Default"** ou apenas **"Server only"** e **"Workbench"**.
    *   Siga as instruções de "Next".
    *   **Importante:** Na etapa de **Authentication Method**, escolha "Use Strong Password Encryption".
    *   **Senha do Root:** Defina uma senha para o usuário `root` e **anote-a**. Você precisará dela no arquivo `.env.local`.

---

## 2. Criar o Banco de Dados e Tabelas

Após a instalação, use o **MySQL Workbench** (que vem no instalador) para criar a estrutura:

1.  Abra o **MySQL Workbench**.
2.  Conecte-se à instância local (clique em "Local instance MySQL80").
3.  No menu superior, vá em **File > Open SQL Script...**.
4.  Selecione o arquivo `backend/schema.sql` deste projeto.
5.  Clique no ícone de **Raio** (Execute) para rodar todo o script.
    *   Isso criará o banco `rppn_db` e todas as tabelas necessárias.

---

## 3. Configurar a Conexão no Sistema

Agora você precisa avisar ao Next.js como falar com o banco:

1.  Vá até a pasta `backend/`.
2.  Abra o arquivo `.env.local`.
3.  Preencha com as suas informações:
    ```env
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=root
    DB_PASSWORD=sua_senha_aqui  <-- COLOQUE A SENHA QUE VOCÊ DEFINIU NA INSTALAÇÃO
    DB_NAME=rppn_db
    ```

---

## 4. Inserir os Primeiros Dados (Manualmente)

Para ver o site funcionando com os dados de exemplo, você pode rodar este comando SQL no Workbench:

```sql
USE rppn_db;

INSERT INTO restos_a_pagar (uo_codigo, ue_codigo, ano_origem, documento, funcao, subfuncao, programa, projeto_atividade, subprojeto, natureza_item, elemento_item, fonte_recurso, procedencia, saldo_rppn)
VALUES 
('1011', '1010001', '2023', '1450', '1', '31', '729', '4239', '1', '3.3.90.39.21', '3921', '10', '1', 2900.36),
('1011', '1010001', '2024', '231', '1', '31', '729', '4239', '1', '3.3.90.39.22', '3922', '10', '1', 202973.44),
('1011', '1010001', '2024', '1764', '1', '31', '729', '4239', '1', '3.3.90.40.02', '4002', '10', '1', 10000.00);
```

---

## 5. Próximos Passos

Com o banco configurado e o arquivo `.env.local` salvo:
1. Abra o terminal na pasta `backend/`.
2. Digite `npm run dev`.
3. Acesse `http://localhost:3000`.

O sistema lerá automaticamente esses dados do seu MySQL local!
