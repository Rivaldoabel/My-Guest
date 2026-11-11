# My Guest — aplicação web

Primeira versão funcional para criar eventos, registar convidados, gerar QR Codes individuais e validar entradas.

## Tecnologias
- React + Vite (interface web responsiva)
- Supabase Auth (contas e início de sessão)
- Supabase PostgreSQL (eventos, convidados e registos)
- QRCode React (geração dos códigos)
- html5-qrcode (leitura pela câmara)

## 1. Criar a base de dados
1. Crie um projecto em https://supabase.com/
2. Abra **SQL Editor**.
3. Copie e execute todo o conteúdo de `supabase/schema.sql`.
4. Em **Project Settings → API**, copie a Project URL e a chave `anon`/`publishable`.

## 2. Configurar a aplicação
1. Instale Node.js (versão LTS): https://nodejs.org/
2. Na pasta do projecto, copie `.env.example` para `.env`.
3. Preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Instale dependências e execute:

```bash
npm install
npm run dev
```

Abra o endereço local apresentado pelo Vite.

## 3. Publicar na Internet
Pode publicar a aplicação no Vercel (https://vercel.com/) ou Netlify (https://www.netlify.com/).

- Importe o repositório Git ou envie a pasta do projecto.
- Comando de build: `npm run build`
- Pasta de publicação: `dist`
- Configure as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do serviço.
- Faça o deploy.

A leitura pela câmara exige HTTPS (os serviços de alojamento indicados fornecem HTTPS).

## 4. Configurações recomendadas no Supabase
- Em **Authentication → URL Configuration**, defina a URL publicada em Site URL e Redirect URLs.
- Para testes, pode desactivar a confirmação de e-mail em Authentication → Providers → Email. Em produção, é preferível manter confirmação.
- Nunca coloque a chave `service_role` no frontend. A chave anon/public é a única chave usada pela aplicação.

## 5. Como testar
1. Crie uma conta e entre.
2. Crie um evento.
3. Adicione convidados.
4. Descarregue um QR Code ou copie a ligação do convite.
5. Abra **Controlar entradas** e leia o QR Code.
6. Leia o mesmo código novamente: deverá aparecer o aviso de convite já utilizado.

## Limitações desta versão
- O QR Code é único por convidado e a validação é registada na base de dados. A função SQL bloqueia a linha durante a validação para impedir duas entradas simultâneas com o mesmo código.
- A aplicação exige ligação à Internet para validar entradas. Não autoriza entradas offline.
- A primeira pessoa a apresentar um convite copiado poderá entrar. O sistema impede reutilização posterior, mas não prova a identidade física do portador.
- Esta versão não inclui ainda pagamentos, envio automático por SMS/e-mail/WhatsApp, importação Excel, edição/exclusão de eventos, nem personalização gráfica avançada dos convites.
- O link do QR Code abre a aplicação; o funcionário deve estar autenticado e ter seleccionado o evento correspondente para validar o código.
- Antes de usar em eventos reais, teste com vários telemóveis e contas e reveja as políticas de acesso e privacidade.

## Estrutura
```text
my-guest/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── style.css
├── supabase/
│   └── schema.sql
├── .env.example
├── index.html
├── package.json
└── README.md
```
