# Dexter-Br

Dexter-Br é um fork do projeto **Dexter**, originalmente desenvolvido por Virat Singh, adaptado para análise do **mercado financeiro brasileiro**.

O projeto mantém o conceito original de um agente de inteligência artificial para análise financeira, porém com integrações voltadas para ativos da **B3** e dados públicos do mercado brasileiro.

Este projeto foi desenvolvido com auxílio de **Google Antigravity, GPT, Sonnet 4.6 e Gemini 3.1**.

---

## Repositório

https://github.com/vpereira88/dexter-br

---

## Origem do Projeto

Este projeto é baseado no repositório original:

https://github.com/virattt/dexter

O Dexter original é um agente de IA para análise de mercado que utiliza LLMs e ferramentas de coleta de dados para realizar análises financeiras automatizadas.

O **Dexter-Br** estende essa ideia para o contexto brasileiro.

---

## Objetivo

O objetivo do Dexter-Br é permitir análises automatizadas de ativos brasileiros utilizando **apenas dados públicos e gratuitos**.

O projeto elimina a necessidade de APIs pagas utilizadas em algumas implementações do Dexter original.

---

## Fontes de Dados

O projeto utiliza apenas fontes públicas disponíveis na internet, incluindo:

* CVM (Comissão de Valores Mobiliários)
* Fundamentus
* StatusInvest
* Outras bases públicas de dados financeiros

A coleta das informações é realizada por meio de **web scraping controlado**, apenas para obtenção dos dados necessários às análises.

---

## Aviso sobre Dados

Todos os dados utilizados pertencem às suas respectivas plataformas.

O Dexter-Br apenas automatiza a coleta de informações públicas disponíveis na internet para fins educacionais, experimentais e de pesquisa.

Caso alguma plataforma solicite ajustes ou remoção de integração, a solicitação será prontamente atendida.

---

## Funcionalidades

* Agente de IA para análise financeira
* Suporte a ativos da B3
* Coleta automática de indicadores fundamentalistas
* Integração com dados públicos da CVM
* Análise automatizada de empresas brasileiras
* Estrutura modular para inclusão de novas fontes de dados

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/vpereira88/dexter-br.git
```

Entre na pasta do projeto:

```bash
cd dexter-br
```

Instale as dependências:

```bash
bun install
```

Crie o arquivo `.env`:

```bash
cp env.example .env
```

Adicione sua chave da OpenAI (ou demais provedores):

```bash
OPENAI_API_KEY=your_key_here
```

Execute o projeto:

```bash
bun start
```

---

## Licença

Este projeto é distribuído sob a **MIT License**.

O projeto original Dexter também utiliza a mesma licença.

Copyright (c) 2025 Virat Singh
Modifications (c) 2026 Dexter-Br Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the Software without restriction.

Consulte o arquivo `LICENSE` para mais detalhes.

---

## Créditos

Projeto original:

Dexter
https://github.com/virattt/dexter

Fork e adaptações para o mercado brasileiro:

Dexter-Br
https://github.com/vpereira88/dexter-br

Desenvolvido com auxílio de:

Google Antigravity
GPT
Sonnet 4.6
Gemini 3.1
