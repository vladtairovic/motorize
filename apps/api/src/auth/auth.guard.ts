import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata,
  UnauthorizedException, createParamDecorator, applyDecorators, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export type Papel = 'ADMIN' | 'ANALISTA' | 'AGENTE' | 'GESTOR';
export interface Sujeito {
  sub: string;
  tipo: 'ENTREGADOR' | 'SERVIDOR';
  papel?: Papel;
  nome?: string;
}

const META = 'motorize:acesso';
type Regra = { tipo: Sujeito['tipo']; papeis?: Papel[] };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const h: string | undefined = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    let sujeito: Sujeito;
    try {
      sujeito = this.jwt.verify<Sujeito>(h.slice(7), { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    const regra = this.reflector.getAllAndOverride<Regra>(META, [ctx.getHandler(), ctx.getClass()]);
    if (regra) {
      if (regra.tipo !== sujeito.tipo) throw new ForbiddenException('Acesso não permitido para este perfil.');
      if (regra.papeis && sujeito.papel !== 'ADMIN' && !regra.papeis.includes(sujeito.papel!))
        throw new ForbiddenException('Seu perfil não tem permissão para esta ação.');
    }
    req.sujeito = sujeito;
    return true;
  }
}

/** Rota exclusiva do entregador autenticado. */
export const SomenteEntregador = () => applyDecorators(SetMetadata(META, { tipo: 'ENTREGADOR' }), UseGuards(AuthGuard));
/** Rota de servidor municipal; ADMIN sempre tem acesso. */
export const SomenteServidor = (...papeis: Papel[]) =>
  applyDecorators(SetMetadata(META, { tipo: 'SERVIDOR', papeis: papeis.length ? papeis : undefined }), UseGuards(AuthGuard));

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): Sujeito => ctx.switchToHttp().getRequest().sujeito);
export const Ip = createParamDecorator((_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest().ip);
