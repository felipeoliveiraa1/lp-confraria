import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outputDir = path.join(root, 'public/assets/headlines-vturb');
const fontRegular = await fs.readFile(path.join(root, 'public/assets/InstrumentSans-500.woff2'));
const fontSemibold = await fs.readFile(path.join(root, 'public/assets/InstrumentSans-600.woff2'));

const options = [
  {
    desktop: [
      ['Descubra uma nova forma de ter uma', false],
      ['segunda fonte de renda em dólar', true],
      ['sem investir todo o seu salário.', false],
    ],
    mobile: [
      ['Descubra uma nova forma', false],
      ['de ter uma segunda fonte', false],
      ['de renda em dólar', true],
      ['sem investir todo', false],
      ['o seu salário.', false],
    ],
    subDesktop: [
      'Assista ao vídeo abaixo e veja como o Sistema de Capital Invisível',
      'vem mudando a vida de centenas de brasileiros',
    ],
    subMobile: [
      'Assista ao vídeo abaixo e veja como',
      'o Sistema de Capital Invisível vem',
      'mudando a vida de centenas de brasileiros',
    ],
  },
  {
    desktop: [
      ['Existe uma forma de buscar uma renda extra', true],
      ['sem precisar vender produtos, criar conteúdo', false],
      ['ou depender de apostas.', false],
    ],
    mobile: [
      ['Existe uma forma de buscar', false],
      ['uma renda extra', true],
      ['sem precisar vender produtos,', false],
      ['criar conteúdo ou depender', false],
      ['de apostas.', false],
    ],
    subDesktop: [
      'Assista ao vídeo e descubra como usar o Sistema de Capital Invisível',
      'e faturar de 100 a 500 reais por dia ainda essa semana',
    ],
    subMobile: [
      'Assista ao vídeo e descubra como usar',
      'o Sistema de Capital Invisível e faturar',
      'de 100 a 500 reais por dia ainda essa semana',
    ],
  },
  {
    desktop: [
      ['Descubra uma nova forma de fazer', false],
      ['um segundo salário em dólar', true],
      ['sem precisar largar seu trabalho', false],
    ],
    mobile: [
      ['Descubra uma nova forma', false],
      ['de fazer um segundo', false],
      ['salário em dólar', true],
      ['sem precisar largar', false],
      ['seu trabalho', false],
    ],
    subDesktop: [
      'Assista ao vídeo e veja como trabalhadores CLT estão faturando de',
      'US$100 a US$500 por dia usando o Sistema de Capital Invisível',
    ],
    subMobile: [
      'Assista ao vídeo e veja como trabalhadores',
      'CLT estão faturando de US$100 a US$500',
      'por dia usando o Sistema de Capital Invisível',
    ],
  },
  {
    desktop: [
      ['Uma nova tecnologia está ajudando brasileiros', false],
      ['a faturar de US$100 a US$500 por dia', true],
      ['usando o Sistema de Capital Invisível', false],
    ],
    mobile: [
      ['Uma nova tecnologia está', false],
      ['ajudando brasileiros a faturar', false],
      ['de US$100 a US$500 por dia', true],
      ['usando o Sistema', false],
      ['de Capital Invisível', false],
    ],
    subDesktop: ['Assista ao vídeo e entenda como começar ainda hoje'],
    subMobile: ['Assista ao vídeo e entenda', 'como começar ainda hoje'],
  },
  {
    desktop: [
      ['Descubra como fazer empresas depositarem', false],
      ['de 150 a 250 dólares por dia direto na sua conta', true],
      ['sem precisar colocar o seu dinheiro em risco', false],
    ],
    mobile: [
      ['Descubra como fazer', false],
      ['empresas depositarem de', false],
      ['150 a 250 dólares por dia', true],
      ['direto na sua conta sem colocar', false],
      ['o seu dinheiro em risco', false],
    ],
    subDesktop: [
      'Toque no play abaixo e veja como esse sistema pode funcionar',
      'mesmo para quem está começando do zero',
    ],
    subMobile: [
      'Toque no play abaixo e veja como esse',
      'sistema pode funcionar mesmo para quem',
      'está começando do zero',
    ],
  },
  {
    desktop: [
      ['Ex-motoboy descobre como fazer empresas americanas', false],
      ['depositarem de 150 a 250 dólares por dia', true],
      ['na sua conta sem precisar arriscar o seu salário', false],
    ],
    mobile: [
      ['Ex-motoboy descobre como', false],
      ['fazer empresas americanas', false],
      ['depositarem de 150 a 250', true],
      ['dólares por dia na sua conta', true],
      ['sem arriscar o seu salário', false],
    ],
    subDesktop: [
      'Dê o play no vídeo abaixo e descubra o sistema',
      'por trás dessa nova oportunidade',
    ],
    subMobile: [
      'Dê o play no vídeo abaixo e descubra',
      'o sistema por trás dessa nova oportunidade',
    ],
  },
  {
    desktop: [
      ['O [[Passo a Passo]] Que Brasileiros Comuns', false],
      ['Estão Usando Pra', false],
      ['Lucrar R$550 Por Dia', true],
      ['No Mercado Mais Lucrativo Do Mundo', false],
    ],
    mobile: [
      ['O [[Passo a Passo]] Que', false],
      ['Brasileiros Comuns Estão', false],
      ['Usando Pra', false],
      ['Lucrar R$550 Por Dia', true],
      ['No Mercado Mais Lucrativo', false],
      ['Do Mundo', false],
    ],
    subDesktop: ['Nada de investir, nada de aparecer e nada de day trade!'],
    subMobile: [
      'Nada de investir, nada de aparecer',
      'e nada de day trade!',
    ],
  },
];

const lp08Clt = {
  desktop: [
    ['Trabalhadores brasileiros estão {{saindo da CLT}}', false],
    ['com essa nova inteligência artificial.', false],
  ],
  mobile: [
    ['Trabalhadores brasileiros', false],
    ['estão {{saindo da CLT}}', false],
    ['com essa nova', false],
    ['inteligência artificial.', false],
  ],
  subDesktop: [
    'Assista ao vídeo abaixo e veja como fazer um segundo salário em dólar',
    'ainda essa semana',
  ],
  subMobile: [
    'Assista ao vídeo abaixo e veja como',
    'fazer um segundo salário em dólar',
    'ainda essa semana',
  ],
};

const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);

const formatLine = (value) => escapeXml(value)
  .replace(/\[\[(.*?)\]\]/g, '<tspan text-decoration="underline">$1</tspan>')
  .replace(/\{\{(.*?)\}\}/g, '<tspan class="inline-green">$1</tspan>');

function svgFor(option, mobile) {
  const width = mobile ? 410 : 1500;
  const height = mobile ? 480 : 360;
  const headline = mobile ? option.mobile : option.desktop;
  const subheadline = mobile ? option.subMobile : option.subDesktop;
  const headlineSize = mobile ? 26 : 54;
  const headlineStep = mobile ? 34 : 66;
  const subSize = mobile ? 18 : 28;
  const subStep = mobile ? 25 : 38;
  const gap = mobile ? 28 : 30;
  const headlineHeight = headline.length * headlineStep;
  const subHeight = subheadline.length * subStep;
  const totalHeight = headlineHeight + gap + subHeight;
  let y = (height - totalHeight) / 2 + headlineSize;

  const headlineText = headline.map(([line, green]) => {
    const row = `<text x="50%" y="${y}" text-anchor="middle" class="headline${green ? ' green' : ''}">${formatLine(line)}</text>`;
    y += headlineStep;
    return row;
  }).join('');

  y += gap - headlineSize + subSize;
  const subText = subheadline.map((line) => {
    const row = `<text x="50%" y="${y}" text-anchor="middle" class="subheadline">${escapeXml(line)}</text>`;
    y += subStep;
    return row;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>
      @font-face { font-family: Instrument; font-weight: 500; src: url(data:font/woff2;base64,${fontRegular.toString('base64')}); }
      @font-face { font-family: Instrument; font-weight: 600; src: url(data:font/woff2;base64,${fontSemibold.toString('base64')}); }
      .headline { font-family: Instrument, sans-serif; font-size: ${headlineSize}px; font-weight: 500; fill: #dddddd; }
      .headline.green { font-weight: 600; fill: #1eff00; }
      .headline .inline-green { font-weight: 600; fill: #1eff00; }
      .subheadline { font-family: Instrument, sans-serif; font-size: ${subSize}px; font-weight: 600; fill: #ff5454; }
    </style>
    ${headlineText}
    ${subText}
  </svg>`;
}

await fs.mkdir(outputDir, { recursive: true });

for (const [index, option] of options.entries()) {
  const number = String(index + 1).padStart(2, '0');
  for (const mobile of [false, true]) {
    const device = mobile ? 'mobile' : 'desktop';
    const svg = svgFor(option, mobile);
    await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, `headline-${number}-${device}.png`));
  }
}

for (const mobile of [false, true]) {
  const device = mobile ? 'mobile' : 'desktop';
  const svg = svgFor(lp08Clt, mobile);
  await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, `headline-lp08-clt-${device}.png`));
}

console.log(`Geradas ${options.length * 2 + 2} artes em ${outputDir}`);
