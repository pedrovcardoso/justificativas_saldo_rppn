CREATE DATABASE IF NOT EXISTS rppn_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rppn_db;

CREATE TABLE IF NOT EXISTS restos_a_pagar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uo_codigo VARCHAR(20),
  ue_codigo VARCHAR(20),
  ano_origem VARCHAR(4),
  documento VARCHAR(50),
  funcao VARCHAR(10),
  subfuncao VARCHAR(10),
  programa VARCHAR(20),
  projeto_atividade VARCHAR(20),
  subprojeto VARCHAR(20),
  natureza_item VARCHAR(50),
  elemento_item VARCHAR(20),
  fonte_recurso VARCHAR(10),
  procedencia VARCHAR(10),
  saldo_rppn DECIMAL(15,2) DEFAULT 0,
  valor_inscrito DECIMAL(15,2) DEFAULT 0,
  valor_pago DECIMAL(15,2) DEFAULT 0,
  valor_cancelado DECIMAL(15,2) DEFAULT 0,
  rppn VARCHAR(255) GENERATED ALWAYS AS (
    CONCAT(uo_codigo,'.',ue_codigo,'.',ano_origem,'.',documento,'.',funcao,'.',subfuncao,'.',programa,'.',projeto_atividade,'.',subprojeto,'.',natureza_item,'.',fonte_recurso,'.',procedencia)
  ) STORED,
  INDEX idx_rppn (rppn),
  INDEX idx_uo (uo_codigo)
);

CREATE TABLE IF NOT EXISTS justificativas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rppn VARCHAR(255) NOT NULL,
  user_justificativa VARCHAR(255) NOT NULL,
  user_avaliador VARCHAR(255),
  acao ENUM('manter', 'cancelar') NOT NULL,
  justificativa TEXT NOT NULL,
  status ENUM('Pendente', 'Aceito', 'Rejeitado') NOT NULL DEFAULT 'Pendente',
  motivo_rejeicao TEXT,
  data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_avaliacao DATETIME,
  INDEX idx_rppn (rppn),
  INDEX idx_user (user_justificativa),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo ENUM('info', 'aviso', 'urgente') NOT NULL DEFAULT 'info',
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS legislacao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  numero VARCHAR(100),
  ano VARCHAR(10),
  esfera ENUM('Federal', 'Estadual', 'Municipal'),
  status ENUM('Vigente', 'Revogado', 'Suspenso'),
  ementa TEXT,
  url VARCHAR(500),
  tags JSON
);
