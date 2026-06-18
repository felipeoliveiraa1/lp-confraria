# LP Confraria — A Sociedade Trader (Astro)

Versão estática da landing page `lp03.confrariadodolar.com.br/al-bio/`, reconstruída em
**Astro** para deploy na **Vercel** (resolve o connect rate que sofria no WordPress:
TTFB instantâneo no CDN + scripts deixam de ficar presos no adiamento do LiteSpeed).

Mantém idêntico ao original: player VSL (ConverteAI), Meta Pixel (`857473790367684`
+ `1471336464764734`), GTM (`GTM-TXZ8KFR7`), GA4, PixelYourSite e os botões para o
checkout `checkout.payt.com.br/cc074bb1887e88b3e7d9ad747153e157`.

## Rodar local

```bash
npm install
npm run build      # gera dist/ (estático)
npm run preview    # serve em http://localhost:4321
```

## Deploy na Vercel

**Opção A — CLI (mais rápido):**
```bash
npm i -g vercel        # ou use: npx vercel
vercel                 # primeiro deploy (preview)
vercel --prod          # produção
```

**Opção B — Git + import:** suba o repositório no GitHub e importe em vercel.com.
A Vercel detecta o Astro automaticamente (build `astro build`, saída `dist`).

Depois é só apontar seu domínio para a Vercel.

## Regerar a página a partir do snapshot

A página (`src/pages/index.html`) e os assets (`public/assets/`) já estão prontos e
versionados. Para regenerar a partir do snapshot original:

```bash
npm run generate   # baixa assets faltantes + reprocessa o snapshot -> src/pages/index.html
```

### Notas técnicas (correções aplicadas ao snapshot)
- LiteSpeed: scripts `type="litespeed/javascript"` convertidos para `<script>` normais
  em ordem de dependência; loader do LiteSpeed e resolver offline removidos.
- Elementor **Motion Effects** + **lazy-load de container**: o fundo das seções/bônus
  ficava escondido até o JS rodar. Removido o gate `:not(.elementor-motion-effects-...)`
  e bakeada a classe `e-lazyloaded` → imagens aparecem imediatamente (sem JS).
- Assets que o snapshot não capturou (fontes InstrumentSans, imagens de bônus e
  backgrounds) baixados do servidor original para `public/assets/`.

### Limitação conhecida
O CAPI **server-side** do PixelYourSite (via `admin-ajax.php` do WordPress) não existe
sem o WP — gera 404/CORS no console, inofensivo. O Pixel **client-side**, GTM e GA
disparam normalmente. Se precisar de CAPI server-side, dá para fazer via Conversions
API da Meta direto ou um endpoint serverless na Vercel.
