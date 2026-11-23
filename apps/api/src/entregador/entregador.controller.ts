import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { EntregadorService, DOCS_OBRIGATORIOS, TipoDoc } from './entregador.service';
import { SomenteEntregador, Usuario, Sujeito } from '../auth/auth.guard';
import { ZodPipe, zPlaca } from '../common/util';

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
const dados = z.object({
  nomeSocial: z.string().trim().max(120).optional().nullable(),
  dataNascimento: dataIso.refine((d) => {
    const idade = (Date.now() - new Date(d).getTime()) / (365.25 * 864e5);
    return idade >= 18 && idade < 100;
  }, 'É preciso ter 18 anos ou mais'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('').transform(() => null)),
  bairro: z.string().trim().min(2).max(80),
  logradouro: z.string().trim().max(160).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  tipoAtividade: z.enum(['APP_DELIVERY', 'MOTOFRETE', 'MOTOTAXI', 'AUTONOMO']),
  plataformas: z.array(z.string().max(30)).max(10).default([]),
  cnhNumero: z.string().transform((s) => s.replace(/\D/g, '')).refine((s) => s.length === 11, 'A CNH tem 11 números'),
  cnhCategoria: z.enum(['A', 'AB', 'AC', 'AD', 'AE']),
  cnhValidade: dataIso,
});
const anoAtual = new Date().getFullYear();
const moto = z.object({
  placa: zPlaca,
  renavam: z.string().transform((s) => s.replace(/\D/g, '')).refine((s) => s.length === 0 || s.length === 11, 'O RENAVAM tem 11 números').optional(),
  marca: z.string().trim().min(2).max(40),
  modelo: z.string().trim().min(1).max(60),
  ano: z.coerce.number().int().min(1980).max(anoAtual + 1),
  cor: z.string().trim().min(3).max(30),
});

@Controller('entregador')
@SomenteEntregador()
export class EntregadorController {
  constructor(private svc: EntregadorService) {}

  @Get('painel')
  painel(@Usuario() u: Sujeito) {
    return this.svc.painel(u.sub);
  }

  @Put('dados')
  dados(@Usuario() u: Sujeito, @Body(new ZodPipe(dados)) d: z.infer<typeof dados>) {
    return this.svc.atualizarDados(u.sub, d);
  }

  @Put('motocicleta')
  moto(@Usuario() u: Sujeito, @Body(new ZodPipe(moto)) d: z.infer<typeof moto>) {
    return this.svc.salvarMoto(u.sub, d);
  }

  @Post('documentos/:tipo')
  async documento(@Usuario() u: Sujeito, @Param('tipo') tipo: string, @Req() req: FastifyRequest) {
    if (!(DOCS_OBRIGATORIOS as readonly string[]).includes(tipo)) throw new BadRequestException('Tipo de documento inválido');
    const file = await req.file();
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      throw new BadRequestException('Arquivo maior que 8 MB. Tire a foto com menor resolução.');
    }
    return this.svc.enviarDocumento(u.sub, tipo as TipoDoc, { buffer, mime: file.mimetype });
  }

  @Get('documentos/:id/arquivo')
  async arquivo(@Usuario() u: Sujeito, @Param('id', ParseUUIDPipe) id: string, @Res() res: FastifyReply) {
    const { stream, mime } = await this.svc.arquivoProprio(u.sub, id);
    res.header('Content-Type', mime).header('Cache-Control', 'private, no-store').send(stream);
  }

  @Post('solicitacao/enviar')
  @HttpCode(200)
  enviar(@Usuario() u: Sujeito) {
    return this.svc.enviarSolicitacao(u.sub);
  }

  @Post('renovacao')
  @HttpCode(200)
  renovar(@Usuario() u: Sujeito) {
    return this.svc.iniciarRenovacao(u.sub);
  }

  @Get('credencial')
  credencial(@Usuario() u: Sujeito) {
    return this.svc.credencial(u.sub);
  }

  @Get('notificacoes')
  notificacoes(@Usuario() u: Sujeito) {
    return this.svc.notificacoes(u.sub);
  }

  @Post('notificacoes/lidas')
  @HttpCode(204)
  async lidas(@Usuario() u: Sujeito) {
    await this.svc.marcarLidas(u.sub);
  }

  @Get('meus-dados')
  exportar(@Usuario() u: Sujeito) {
    return this.svc.exportar(u);
  }

  @Delete('conta')
  @HttpCode(204)
  async excluir(@Usuario() u: Sujeito) {
    await this.svc.anonimizar(u);
  }
}
