import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Armazenamento de documentos fora da pasta pública.
 * Driver local (disco). Para produção em nuvem/on-premise, troque por um driver
 * S3-compatível (MinIO, AWS S3, OCI) implementando os mesmos métodos.
 */
@Injectable()
export class StorageService {
  private raiz = path.resolve(process.env.STORAGE_DIR ?? path.join(__dirname, '..', '..', 'storage'));

  async salvar(buffer: Buffer, pasta: string, extensao: string) {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const rel = path.posix.join(pasta, `${crypto.randomUUID()}.${extensao}`);
    const abs = path.join(this.raiz, rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, buffer, { mode: 0o600 });
    return { caminho: rel, sha256, tamanho: buffer.length };
  }

  stream(rel: string) {
    const abs = path.join(this.raiz, rel);
    if (!abs.startsWith(this.raiz) || !fs.existsSync(abs)) throw new NotFoundException('Arquivo não encontrado');
    return fs.createReadStream(abs);
  }

  async lerBase64(rel: string) {
    try {
      return (await fsp.readFile(path.join(this.raiz, rel))).toString('base64');
    } catch {
      return null;
    }
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
