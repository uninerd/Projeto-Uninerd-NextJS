CREATE TABLE IF NOT EXISTS horarios_medicos (
  id_medico INT UNSIGNED NOT NULL,
  data_hora DATETIME NOT NULL,
  PRIMARY KEY (id_medico, data_hora),
  CONSTRAINT fk_horarios_medico FOREIGN KEY (id_medico) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT valid_doctor_hour CHECK (
    HOUR(data_hora) BETWEEN 8 AND 17 AND MINUTE(data_hora)=0 AND SECOND(data_hora)=0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agenda_dias_medicos (
  id_medico INT UNSIGNED NOT NULL,
  data DATE NOT NULL,
  PRIMARY KEY (id_medico, data),
  FOREIGN KEY (id_medico) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agenda_semanal_medicos (
  id_medico INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  hora TIME NOT NULL,
  PRIMARY KEY (id_medico, dia_semana, hora),
  FOREIGN KEY (id_medico) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT valid_weekday CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT valid_weekly_hour CHECK (HOUR(hora) BETWEEN 8 AND 17 AND MINUTE(hora)=0 AND SECOND(hora)=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
