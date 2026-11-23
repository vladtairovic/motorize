import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z, ZodType } from 'zod';

export class ZodPipe<T> implements PipeTransform {
  constructor(private schema: ZodType<T>) {}
  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        mensagem: 'Dados inválidos',
        campos: r.error.issues.map((i) => ({ campo: i.path.join('.'), erro: i.message })),
      });
    }
    return r.data;
  }
}

export const somenteDigitos = (s: string) => s.replace(/\D/g, '');

export function cpfValido(cpfBruto: string): boolean {
  const cpf = somenteDigitos(cpfBruto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export const mascararCpf = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;

export const zCpf = z.string().transform(somenteDigitos).refine(cpfValido, 'CPF inválido');
export const zPlaca = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .refine((s) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(s), 'Placa inválida (use AAA0A00 ou AAA0000)');
export const zTelefone = z.string().transform(somenteDigitos).refine((s) => s.length >= 10 && s.length <= 11, 'Telefone inválido');

export function primeiroNome(nome: string) {
  const p = nome.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0];
}
