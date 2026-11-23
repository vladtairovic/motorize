import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthService, VERSAO_TERMO_LGPD } from './auth.service';
import { ZodPipe, zCpf, zTelefone } from '../common/util';
import { Ip, SomenteServidor, SomenteEntregador, Usuario, Sujeito } from './auth.guard';

const cadastro = z.object({
  cpf: zCpf,
  nome: z.string().trim().min(5, 'Informe o nome completo').max(120),
  telefone: zTelefone,
  senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres').max(72),
  aceiteTermo: z.literal(true, { message: 'É preciso aceitar o termo de uso de dados' }),
});
const loginEnt = z.object({ cpf: zCpf, senha: z.string().min(1) });
const loginSrv = z.object({ email: z.string().email(), senha: z.string().min(1) });
const refresh = z.object({ refreshToken: z.string().min(20) });

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private auth: AuthService) {}

  @Get('termo')
  termo() {
    return {
      versao: VERSAO_TERMO_LGPD,
      controlador: 'Prefeitura Municipal de Toritama — CTTU',
      finalidade:
        'Cadastro e credenciamento municipal de motociclistas de entrega, fiscalização de trânsito, comunicação institucional e geração de indicadores agregados para políticas públicas.',
      baseLegal: 'LGPD art. 7º, III e art. 23 (execução de políticas públicas pela administração pública).',
      dadosColetados: ['Nome, CPF, telefone, data de nascimento', 'Endereço/bairro de atuação', 'CNH e dados da motocicleta', 'Foto para a credencial'],
      naoColetados: ['Dados bancários', 'Renda', 'Localização em tempo real'],
      retencao: 'Enquanto o credenciamento estiver ativo e por até 5 anos após o encerramento, para fins de auditoria.',
      direitos: 'Você pode consultar, corrigir e pedir a exclusão (anonimização) dos seus dados a qualquer momento pelo app.',
    };
  }

  @Post('entregador/cadastro')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  cadastrar(@Body(new ZodPipe(cadastro)) d: z.infer<typeof cadastro>, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.auth.cadastrarEntregador(d, ip, ua);
  }

  @Post('entregador/login')
  @HttpCode(200)
  loginEntregador(@Body(new ZodPipe(loginEnt)) d: z.infer<typeof loginEnt>, @Headers('user-agent') ua: string) {
    return this.auth.loginEntregador(d.cpf, d.senha, ua);
  }

  @Post('servidor/login')
  @HttpCode(200)
  loginServidor(@Body(new ZodPipe(loginSrv)) d: z.infer<typeof loginSrv>, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.auth.loginServidor(d.email, d.senha, ip, ua);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  renovar(@Body(new ZodPipe(refresh)) d: z.infer<typeof refresh>, @Headers('user-agent') ua: string) {
    return this.auth.renovar(d.refreshToken, ua);
  }

  @Post('sair')
  @HttpCode(204)
  async sair(@Body(new ZodPipe(refresh)) d: z.infer<typeof refresh>) {
    await this.auth.sair(d.refreshToken);
  }

  @Get('servidor/eu')
  @SomenteServidor()
  euServidor(@Usuario() u: Sujeito) {
    return u;
  }

  @Get('entregador/eu')
  @SomenteEntregador()
  euEntregador(@Usuario() u: Sujeito) {
    return u;
  }
}
