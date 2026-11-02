export interface User {
  id?: number;
  nome: string;
  email: string;
  cpf?: string;
  crm?: string;
  especialidade?: string;
  nivel: 'medico' | 'paciente' | 'admin';
}

export interface AuthContextData {
  user: User | null;
  signIn: (credentials: { email: string; password: string }) => Promise<User>;
  signOut: () => void;
  updateUser: (user: User) => void;
  loading: boolean;
}

export interface Doctor {
  id: number;
  name: string;
  address: string;
  specialty: string;
  crm?: string;
  crm_numero?: string;
}

export interface Specialty {
  id: number;
  name: string;
}

export interface Appointment {
  id: number;
  date: string;
  doctorName: string;
  patientName: string;
  doctorId?: number;
  patientId?: number;
  type?: string;
  status: string;
}
