import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { AdminService } from './admin.service';
import { IndicadoresService } from './indicadores.service';
import { Ip, SomenteServidor, Usuario, Sujeito } from '../auth/auth.guard';
import { ZodPipe } from '../common/util';

const pagina = z.coerce.number().int().min(1).default(1);
const qSol = z.object({ status: z.string().optional(), busca: z.string().max(80).optional(), pagina });
const qEnt = z.object({ busca: z.string().max(80).optional(), situacao: z.string().optional(), bairro: z.string().optional(), pagina });
const avaliar = z.object({ status: z.enum(['ACEITO', 'RECUSADO']), motivoRecusa: z.string().max(500).optional() });
const decisao = z.object({ decisao: z.enum(['APROVAR', 'PENDENCIA', 'REPROVAR']), motivo: z.string().max(1000).optional() });
const statusCred = z.object({ status: z.enum(['ATIVA', 'SUSPENSA', 'REVOGADA']), motivo: z.string().trim().min(5, 'Descreva o motivo').max(500) });
const comunicado = z.object({ titulo: z.string().trim().min(3).max(120), mensagem: z.string().trim().min(5).max(1000), bairro: z.string().optional() });
const servidor = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.string().email(),
  senha: z.string().min(8, 'Mínimo de 8 caracteres'),
  papel: z.enum(['ADMIN', 'ANALISTA', 'AGENTE', 'GESTOR']),
  matricula: z.string().max(30).optional(),
  orgao: z.string().max(60).default('CTTU'),
});

@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService, private ind: IndicadoresService) {}

  // Indicadores — gestor/prefeitura também acessa
  @Get('indicadores')
  @SomenteServidor('ANALISTA', 'GESTOR')
  async indicadores() {
    const [resumo, porBairro, porAtividade, plataformas, evolucao, mapa, consultas] = await Promise.all([
      this.ind.resumo(), this.ind.porBairro(), this.ind.porAtividade(), this.ind.plataformas(),
      this.ind.evolucao(), this.ind.mapa(), this.ind.consultasRecentes(),
    ]);
    return { resumo, porBairro, porAtividade, plataformas, evolucao, mapa, consultas };
  }

  @Get('relatorios/entregadores.csv')
  @SomenteServidor('ANALISTA', 'GESTOR')
  async csv(@Res() res: FastifyReply, @Usuario() u: Sujeito) {
    const csv = await this.ind.csvEntregadores();
    res
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="motorize-entregadores-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  @Get('bairros')
  @SomenteServidor()
  bairros() {
    return this.svc.bairros();
  }

  // Solicitações — análise documental (backoffice)
  @Get('solicitacoes')
  @SomenteServidor('ANALISTA', 'GESTOR')
  solicitacoes(@Query(new ZodPipe(qSol)) q: z.infer<typeof qSol>) {
    return this.svc.listarSolicitacoes(q);
  }

  @Get('solicitacoes/:id')
  @SomenteServidor('ANALISTA')
  solicitacao(@Param('id', ParseUUIDPipe) id: string, @Usuario() u: Sujeito, @Ip() ip: string) {
    return this.svc.detalheSolicitacao(id, u, ip);
  }

  @Post('solicitacoes/:id/iniciar-analise')
  @SomenteServidor('ANALISTA')
  iniciar(@Param('id', ParseUUIDPipe) id: string, @Usuario() u: Sujeito) {
    return this.svc.iniciarAnalise(id, u);
  }

  @Post('solicitacoes/:id/decisao')
  @SomenteServidor('ANALISTA')
  decidir(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisao)) d: z.infer<typeof decisao>, @Usuario() u: Sujeito) {
    return this.svc.decidir(id, d, u);
  }

  @Patch('documentos/:id')
  @SomenteServidor('ANALISTA')
  avaliar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(avaliar)) d: z.infer<typeof avaliar>, @Usuario() u: Sujeito) {
    return this.svc.avaliarDocumento(id, d, u);
  }

  @Get('documentos/:id/arquivo')
  @SomenteServidor('ANALISTA')
  async arquivo(@Param('id', ParseUUIDPipe) id: string, @Usuario() u: Sujeito, @Ip() ip: string, @Res() res: FastifyReply) {
    const { stream, mime } = await this.svc.arquivo(id, u, ip);
    res.header('Content-Type', mime).header('Cache-Control', 'private, no-store').send(stream);
  }

  // Entregadores e credenciais
  @Get('entregadores')
  @SomenteServidor('ANALISTA', 'GESTOR')
  entregadores(@Query(new ZodPipe(qEnt)) q: z.infer<typeof qEnt>) {
    return this.svc.listarEntregadores(q);
  }

  @Get('entregadores/:id')
  @SomenteServidor('ANALISTA')
  entregador(@Param('id', ParseUUIDPipe) id: string, @Usuario() u: Sujeito, @Ip() ip: string) {
    return this.svc.detalheEntregador(id, u, ip);
  }

  @Patch('credenciais/:id/status')
  @SomenteServidor('ANALISTA')
  statusCredencial(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(statusCred)) d: z.infer<typeof statusCred>, @Usuario() u: Sujeito) {
    return this.svc.alterarStatusCredencial(id, d, u);
  }

  // Comunicação institucional
  @Get('comunicados')
  @SomenteServidor('ANALISTA', 'GESTOR')
  comunicados() {
    return this.svc.comunicadosRecentes();
  }

  @Post('comunicados')
  @SomenteServidor('ANALISTA', 'GESTOR')
  comunicar(@Body(new ZodPipe(comunicado)) d: z.infer<typeof comunicado>, @Usuario() u: Sujeito) {
    return this.svc.comunicado(d, u);
  }

  // Administração
  @Get('servidores')
  @SomenteServidor('ADMIN')
  servidores() {
    return this.svc.listarServidores();
  }

  @Post('servidores')
  @SomenteServidor('ADMIN')
  criarServidor(@Body(new ZodPipe(servidor)) d: z.infer<typeof servidor>, @Usuario() u: Sujeito) {
    return this.svc.criarServidor(d, u);
  }

  @Patch('servidores/:id')
  @SomenteServidor('ADMIN')
  alternar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(z.object({ ativo: z.boolean() }))) d: { ativo: boolean }, @Usuario() u: Sujeito) {
    return this.svc.alternarServidor(id, d.ativo, u);
  }

  @Get('auditoria')
  @SomenteServidor('ADMIN')
  auditoria(@Query('pagina') p?: string) {
    return this.svc.listarAuditoria(Math.max(1, Number(p) || 1));
  }
}
