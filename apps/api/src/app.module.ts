import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbModule } from './db/db.module';
import { AuditoriaModule } from './common/auditoria.service';
import { StorageModule } from './common/storage.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { EntregadorController } from './entregador/entregador.controller';
import { EntregadorService } from './entregador/entregador.service';
import { CredencialService } from './credencial/credencial.service';
import { VencimentosJob } from './credencial/vencimentos.job';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { IndicadoresService } from './admin/indicadores.service';
import { FiscalizacaoController } from './fiscalizacao/fiscalizacao.controller';
import { PublicoController } from './publico/publico.controller';

@Module({
  imports: [
    DbModule,
    AuditoriaModule,
    StorageModule,
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
  ],
  controllers: [AuthController, EntregadorController, AdminController, FiscalizacaoController, PublicoController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AuthGuard,
    AuthService,
    EntregadorService,
    CredencialService,
    VencimentosJob,
    AdminService,
    IndicadoresService,
  ],
})
export class AppModule {}
