import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { z } from 'zod';
import { registerDto, loginDto, updateUserDto } from '../backend/src/server/modules/users/user.dto';
import { doctorDto, createDoctorDto, specialtyDto, doctorScheduleDto, doctorWeekDto } from '../backend/src/server/modules/doctors/doctor.dto';
import { appointmentDto, updateAppointmentDto } from '../backend/src/server/modules/appointments/appointment.dto';
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const schema = (value: z.ZodType, io: 'input' | 'output' = 'output') => z.toJSONSchema(value, { io,unrepresentable:'any' });
const error = { description:'Requisição inválida, acesso negado, conflito ou dependência indisponível.',content:{ 'application/json':{ schema:ref('Error') } } };
function operation(summary: string, options: { body?: string; status?: number; response?: string; public?: boolean; parameters?: unknown[] } = {}) {
  return {
    summary, ...(options.public ? { security:[] } : {}), ...(options.parameters ? { parameters:options.parameters } : {}),
    ...(options.body ? { requestBody:{ required:true,content:{ 'application/json':{ schema:ref(options.body) } } } } : {}),
    responses:{ [String(options.status ?? 200)]:{ description:'Sucesso',content:{ 'application/json':{ schema:ref(options.response ?? 'Message') } } },'400':error,'401':error,'403':error,'404':error,'405':error,'409':error,'413':{ description:'Corpo acima do limite de 16 KiB; bloqueio no backend ou Nginx.',content:{ 'application/json':{ schema:ref('Error') },'text/html':{ schema:{ type:'string' } } } },'503':error },
  };
}
const id = { name:'id',in:'path',required:true,schema:{ type:'integer',minimum:1 } };
const pagination = ['page','limit'].map(name=>({ name,in:'query',schema:{ type:'integer',minimum:1,maximum:name==='limit'?100:100000,default:name==='limit'?10:1 } }));
const user = z.object({ id:z.number(),nome:z.string(),email:z.string(),nivel:z.enum(['paciente','medico','admin']),cpf:z.string().nullable().optional(),crm_numero:z.string().nullable().optional(),crm_uf:z.string().nullable().optional(),id_especialidade:z.number().nullable().optional() });
const doctor = z.object({ id:z.number(),name:z.string(),address:z.string(),specialty:z.string(),crm:z.string(),crmUf:z.string() });
const appointment = z.object({ id:z.number().int().positive(),patientId:z.number().int().positive(),doctorId:z.number().int().positive(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/),type:z.enum(['consulta','exame']),status:z.enum(['AGENDADO','CONCLUIDO','CANCELADO']),patientName:z.string(),doctorName:z.string() });
const page = (item: z.ZodType) => z.object({ data:z.array(item),total:z.number(),page:z.number(),last_page:z.number() });
const spec = {
  openapi:'3.1.0',info:{ title:'Uninerd API',version:'1.0.0',description:'Backend Next.js independente com sessão HttpOnly. Escritas validam Origin. Horários são locais da clínica em São Paulo, sem offset, das 08h às 17h em horas inteiras. Papéis e transições são validados no servidor.' },
  servers:[{ url:'http://localhost:8080/api',description:'Nginx: frontend e backend separados' },{ url:'http://localhost:3000/api',description:'Frontend local com rewrite' },{ url:'http://localhost:3001/api',description:'Backend local direto; escritas exigem Origin igual a APP_ORIGIN' }],
  security:[{ session:[] }],
  paths:{
    '/health':{ get:operation('Verificar processo',{ public:true,response:'Health' }) },
    '/ready':{ get:operation('Verificar MySQL e Redis',{ public:true,response:'Readiness' }) },
    '/users/register':{ post:operation('Cadastrar paciente ou médico; não aceita administrador',{ body:'Register',status:201,response:'Profile',public:true }) },
    '/users/login':{ post:operation('Autenticar e definir cookie uninerd_session HttpOnly',{ body:'Login',public:true,response:'LoginResponse' }) },
    '/users/logout':{ post:operation('Apagar cookie de sessão',{ public:true,response:'Success' }) },
    '/users/me':{ get:operation('Consultar perfil da sessão',{ response:'Profile' }) },
    '/users/{id}':{
      get:operation('Consultar apenas próprio perfil',{ parameters:[id],response:'Profile' }),
      put:operation('Atualizar próprio perfil; não permite mudar papel',{ parameters:[id],body:'UpdateUser',response:'Profile' }),
      delete:operation('Excluir própria conta sem vínculos e apagar cookie',{ parameters:[id],response:'Success' }),
    },
    '/doctors':{
      get:operation('Listar médicos com cache-aside',{ parameters:[...pagination,{ name:'specialty',in:'query',description:'Busca por nome do médico ou especialidade',schema:{ type:'string',maxLength:100 } }],response:'DoctorPage' }),
      post:operation('Administrador cria médico e credenciais reais',{ body:'CreateDoctor',status:201,response:'Doctor' }),
    },
    '/doctors/{id}':{
      get:operation('Consultar médico',{ parameters:[id],response:'Doctor' }),
      put:operation('Administrador ou próprio médico atualiza cadastro',{ parameters:[id],body:'UpdateDoctor' }),
      delete:operation('Administrador exclui médico sem vínculos',{ parameters:[id] }),
    },
    '/doctors/{id}/availability':{ get:operation('Consultar horários livres sem dados de pacientes',{ parameters:[id,{ name:'date',in:'query',required:true,schema:{ type:'string',format:'date' } }],response:'Availability' }) },
    '/doctors/{id}/schedule':{
      get:operation('Próprio médico consulta agenda efetiva de uma data',{ parameters:[id,{ name:'date',in:'query',required:true,schema:{ type:'string',format:'date' } }],response:'DoctorSchedule' }),
      put:operation('Próprio médico define exceção por data; preserva horários reservados',{ parameters:[id],body:'DoctorScheduleInput',response:'DoctorSchedule' }),
    },
    '/doctors/{id}/weekly-schedule':{
      get:operation('Próprio médico consulta horários por dia da semana',{ parameters:[id],response:'DoctorWeek' }),
      put:operation('Próprio médico define semana recorrente; preserva reservas futuras',{ parameters:[id],body:'DoctorWeekInput',response:'DoctorWeek' }),
    },
    '/specialties':{
      get:operation('Listar especialidades com cache; acesso público para cadastro',{ public:true,response:'SpecialtyList' }),
      post:operation('Administrador cria especialidade',{ body:'SpecialtyInput',status:201,response:'SpecialtyWrite' }),
    },
    '/specialties/{id}':{
      put:operation('Administrador atualiza especialidade',{ parameters:[id],body:'SpecialtyInput' }),
      delete:operation('Administrador exclui especialidade sem vínculos',{ parameters:[id] }),
    },
    '/appointments':{
      get:operation('Listar agendamentos conforme papel da sessão',{ parameters:pagination,response:'AppointmentPage' }),
      post:operation('Paciente reserva para si; conflitos retornam 409',{ body:'CreateAppointment',status:201,response:'AppointmentCreated' }),
    },
    '/appointments/{id}':{
      get:operation('Consultar agendamento autorizado',{ parameters:[id],response:'Appointment' }),
      put:operation('Editar reserva ativa; paciente não conclui e médico não transfere',{ parameters:[id],body:'UpdateAppointment' }),
      delete:operation('Cancelar reserva ativa preservando histórico e liberando slot',{ parameters:[id] }),
    },
    '/notifications':{ get:operation('Consultar histórico de notificações do usuário',{ response:'Notifications', parameters:[{ name:'offset',in:'query',required:false,schema:{ type:'integer',minimum:0,maximum:1000000,default:0 } }] }) },
  },
  components:{ securitySchemes:{ session:{ type:'apiKey',in:'cookie',name:'uninerd_session' } },schemas:{
    Register:schema(registerDto,'input'), Login:schema(loginDto,'input'), UpdateUser:schema(updateUserDto,'input'),
    UpdateDoctor:schema(doctorDto,'input'),CreateDoctor:schema(createDoctorDto,'input'),SpecialtyInput:schema(specialtyDto,'input'),
    CreateAppointment:schema(appointmentDto,'input'),UpdateAppointment:schema(updateAppointmentDto,'input'),
    User:schema(user),Doctor:schema(doctor),Appointment:schema(appointment),
    Profile:schema(z.object({ success:z.literal(true),data:user })),LoginResponse:schema(z.object({ success:z.literal(true),user })),
    DoctorPage:schema(page(doctor)),AppointmentPage:schema(page(appointment)),
    Availability:schema(z.object({ doctorId:z.number(),date:z.string(),hours:z.array(z.string()) })),
    DoctorScheduleInput:schema(doctorScheduleDto,'input'),DoctorWeekInput:schema(doctorWeekDto,'input'),
    DoctorSchedule:schema(z.object({ doctorId:z.number(),date:z.string(),hours:z.array(z.string()),occupiedHours:z.array(z.string()),source:z.enum(['date','weekly']) })),
    DoctorWeek:schema(z.object({ doctorId:z.number(),days:z.array(z.object({ weekday:z.number().int().min(0).max(6),hours:z.array(z.string()),occupiedHours:z.array(z.string()) })) })),
    SpecialtyList:schema(z.array(z.object({ id:z.number(),name:z.string() }))),SpecialtyWrite:schema(z.object({ id:z.number(),nome:z.string() })),
    AppointmentCreated:schema(z.object({ id:z.number().int().positive(),message:z.string() })),Message:schema(z.object({ message:z.string() })),Success:schema(z.object({ success:z.literal(true) })),
    Error:schema(z.object({ success:z.literal(false),message:z.string(),requestId:z.string().optional() })),
    Health:schema(z.object({ status:z.literal('ok'),service:z.string() })),Readiness:schema(z.object({ status:z.enum(['ok','degraded']),database:z.boolean(),redis:z.boolean() })),
    Notifications:schema(z.object({ data:z.array(z.object({ eventId:z.string(),appointmentId:z.number(),message:z.string(),timestamp:z.string() })),nextOffset:z.number().int().nonnegative().nullable() })),
  } },
};
type Operation = ReturnType<typeof operation> & { operationId?: string; tags?: string[]; description?: string };
spec.components.schemas.Profile.properties!.data = ref('User');
spec.components.schemas.LoginResponse.properties!.user = ref('User');
const tagNames: Record<string,string> = { health:'Saúde',ready:'Saúde',users:'Usuários',doctors:'Médicos',specialties:'Especialidades',appointments:'Agendamentos',notifications:'Notificações' };
const document = spec as typeof spec & { tags: { name:string; description:string }[] };
document.tags = [
  { name:'Saúde',description:'Processo e dependências do backend.' },
  { name:'Usuários',description:'Cadastro, cookie de sessão e perfil próprio.' },
  { name:'Médicos',description:'Catálogo, administração e horários disponíveis.' },
  { name:'Especialidades',description:'Consulta pública e manutenção pelo administrador.' },
  { name:'Agendamentos',description:'Reservas autorizadas e transições do agregado.' },
  { name:'Notificações',description:'Inbox do usuário autenticado no microsserviço.' },
];
const cookieHeader = { description:'Cookie HttpOnly, SameSite=Lax e Path=/; Secure quando COOKIE_SECURE=true. Login cria sessão por 1 dia; logout/exclusão removem o cookie.',schema:{ type:'string' } };
for (const [path,item] of Object.entries(spec.paths)) {
  for (const [method,definition] of Object.entries(item)) {
    const op = definition as Operation;
    op.operationId = `${method}${path.replace(/\{([^}]+)\}/g,'by-$1').split(/[^a-zA-Z0-9]+/).filter(Boolean).map(part=>part[0].toUpperCase()+part.slice(1)).join('')}`;
    op.tags = [tagNames[path.split('/')[1]]];
    op.description = 'Respostas do backend incluem X-Request-Id. Escritas validam Origin; em navegador, use a mesma origem do frontend. Papéis e regras adicionais são descritos no resumo e no guia INTEGRACAO-APIS-DADOS.md.';
    const responses = op.responses as Record<string,{ description:string; content:Record<string,{ schema:object }>; headers?:Record<string,unknown> }>;
    for (const response of Object.values(responses)) response.headers = { 'X-Request-Id':{ description:'Identificador para correlação com os logs do backend; bloqueios do Nginx podem não incluí-lo.',schema:{ type:'string',format:'uuid' } } };
    if (path === '/ready') responses['503'] = { description:'MySQL indisponível; status degraded e flags reais das dependências.',content:{ 'application/json':{ schema:ref('Readiness') } } };
    if ((path === '/users/login' && method === 'post') || (path === '/users/logout' && method === 'post') || (path === '/users/{id}' && method === 'delete')) {
      const status = Object.keys(responses).find(key => /^2/.test(key))!;
      responses[status].headers!['Set-Cookie'] = cookieHeader;
    }
    if (path === '/users/login' || path === '/users/register') {
      responses['429'] = { description:'Nginx limita autenticação a 5 requisições/minuto por IP, com burst de 10.',content:{ 'text/html':{ schema:{ type:'string' } } } };
    }
  }
}
spec.components.schemas.CreateAppointment.description = 'Horário local São Paulo UTC-03:00, sem offset, futuro, hora inteira entre 08 e 17, disponibilizado pelo médico e sem reserva ativa. Exceção por data tem prioridade sobre semana recorrente. Paciente é obtido da sessão; patientId não é aceito.';
spec.components.schemas.UpdateAppointment.description = 'AGENDADO pode ser editado; CONCLUIDO/CANCELADO são terminais. Paciente não conclui, médico não transfere e conclusão preserva os dados originais.';
spec.components.schemas.Register.description = 'Senha de 8 a 128 caracteres com maiúscula, minúscula, número e símbolo !@#$%^&*. CPF exige dígitos verificadores válidos; CRM/UF e especialidade são obrigatórios para médico. Não aceita admin.';
spec.components.schemas.CreateDoctor.description = 'Somente administrador. Além dos limites de formato, a senha segue as mesmas regras fortes do cadastro de usuários e a especialidade precisa existir.';
const output = JSON.stringify(spec,null,2)+'\n';
if (process.argv.includes('--check')) {
  if (!existsSync('contracts/openapi.json') || readFileSync('contracts/openapi.json','utf8').replace(/\r\n/g,'\n') !== output) throw new Error('OpenAPI desatualizado. Execute npm run docs:api.');
  console.log('OpenAPI sincronizado com o gerador e DTOs.');
} else {
  mkdirSync('contracts',{ recursive:true }); writeFileSync('contracts/openapi.json',output);
  console.log('OpenAPI gerado em contracts/openapi.json a partir dos DTOs.');
}
