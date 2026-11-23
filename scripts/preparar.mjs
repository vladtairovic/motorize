// Cria apps/api/.env a partir do exemplo, com segredos JWT aleatórios (funciona no Windows, Linux e macOS).
import fs from 'node:fs';
import crypto from 'node:crypto';
const destino = 'apps/api/.env';
if (fs.existsSync(destino)) {
  console.log('✔ apps/api/.env já existe — mantido.');
} else {
  const s = () => crypto.randomBytes(48).toString('base64url');
  const txt = fs.readFileSync('apps/api/.env.example', 'utf8')
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${s()}`)
    .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${s()}`);
  fs.writeFileSync(destino, txt);
  console.log('✔ apps/api/.env criado com segredos novos.');
}
