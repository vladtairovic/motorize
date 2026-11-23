import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CredencialService } from '../credencial/credencial.service';
import { ZodPipe, primeiroNome } from '../common/util';

/**
 * Consulta pública de credencial (comerciante, cidadão): mostra só o mínimo
 * necessário para confiar no entregador — nome abreviado, placa e situação.
 */
@Controller('publico')
export class PublicoController {
  constructor(private cred: CredencialService) {}

  @Get('saude')
  saude() {
    return { ok: true, servico: 'motorize-api', horario: new Date() };
  }

  @Get('chave')
  chave() {
    return this.cred.chavePublica();
  }

  @Post('validar')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validar(@Body(new ZodPipe(z.object({ token: z.string().min(10).max(2000) }))) d: { token: string }) {
    const r = await this.cred.validarToken(d.token);
    const c = r.credencial;
    return {
      resultado: r.resultado,
      credencial: c
        ? {
            numero: c.numero,
            nome: primeiroNome(c.entregador.nomeSocial || c.entregador.nome),
            placa: c.entregador.motocicleta?.placa ?? null,
            validaAte: c.validaAte,
          }
        : null,
    };
  }
}
