CREATE TABLE especialidades (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  cpf CHAR(11) UNIQUE,
  endereco VARCHAR(255),
  crm_numero VARCHAR(10),
  crm_uf CHAR(2),
  id_especialidade INT UNSIGNED,
  nivel ENUM('paciente','medico','admin') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_crm (crm_numero, crm_uf),
  FOREIGN KEY (id_especialidade) REFERENCES especialidades(id),
  CONSTRAINT valid_role_data CHECK (
    (nivel='paciente' AND cpf IS NOT NULL) OR
    (nivel='medico' AND crm_numero IS NOT NULL AND crm_uf IS NOT NULL AND id_especialidade IS NOT NULL) OR nivel='admin'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agendamentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL,
  id_medico INT UNSIGNED NOT NULL,
  data_consulta DATETIME NOT NULL,
  tipo ENUM('consulta','exame') NOT NULL,
  status ENUM('AGENDADO','CONCLUIDO','CANCELADO') NOT NULL DEFAULT 'AGENDADO',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- NULL removes cancelled appointments from the unique active-slot constraint.
  horario_ativo DATETIME GENERATED ALWAYS AS (CASE WHEN status <> 'CANCELADO' THEN data_consulta ELSE NULL END) STORED,
  UNIQUE KEY unique_doctor_active_slot (id_medico, horario_ativo),
  UNIQUE KEY unique_patient_active_slot (id_usuario, horario_ativo),
  KEY patient_schedule (id_usuario,data_consulta),
  KEY doctor_schedule (id_medico,data_consulta),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
  FOREIGN KEY (id_medico) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
