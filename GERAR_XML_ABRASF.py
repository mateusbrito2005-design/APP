"""
SAP (aba 'DETALHADO TOTAL') -> XML ABRASF 2.03 (EnviarLoteRpsEnvio) para notas tomadas.

Uso:
    python GERAR_XML_ABRASF.py --xlsx Confronto.xlsx --nota 25545
    python GERAR_XML_ABRASF.py --xlsx Confronto.xlsx --ausentes        # todas "AUSENTE NO SITE"
    python GERAR_XML_ABRASF.py --xlsx Confronto.xlsx --todas

Gera 1 arquivo por prestador (no ABRASF 2.03 o prestador fica no cabeçalho do lote).
CONFIRME os itens marcados com "CONFIRMAR" com o manual do ISS Digital de Triunfo.
"""
import argparse
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl

# ==================================================
# CONFIGURAÇÃO
# ==================================================
ABA = "DETALHADO TOTAL"
LINHA_CABECALHO = 6
NS = "http://www.abrasf.org.br/nfse.xsd"

# Tomador = Braskem filial Triunfo. PREENCHER (não consta na planilha).
TOMADOR_CNPJ = ""            # 14 dígitos
TOMADOR_IM = ""              # inscrição municipal em Triunfo
TOMADOR_RAZAO = "BRASKEM S.A."

SERIE_RPS = "1"              # CONFIRMAR: a planilha não traz série
TIPO_RPS = "1"               # 1 = RPS
ISS_RETIDO = "1"             # CONFIRMAR: 1 = retido pelo tomador, 2 = não retido
EXIGIBILIDADE_ISS = "1"      # 1 = exigível
ALIQUOTA_COMO_FRACAO = True  # CONFIRMAR: ABRASF 2.0 usa 0.05 para 5%
SIMPLES = "2"                # 1 = optante, 2 = não optante (planilha vem em branco)
INCENTIVO_FISCAL = "2"       # 2 = não


# ==================================================
# LEITURA DO SAP
# ==================================================
def data_iso(s):
    s = str(s).strip()
    for f in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, f).strftime("%Y-%m-%d")
        except ValueError:
            pass
    raise ValueError(f"Data inválida: {s!r}")


def so_digitos(v, tam=None):
    d = re.sub(r"\D", "", str(v or ""))
    if isinstance(v, float):
        d = str(int(v))
    return d.zfill(tam) if tam else d


def dec(v, casas=2):
    return f"{float(v or 0):.{casas}f}"


def ler_notas(xlsx):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    ws = wb[ABA]
    cab = [c.value for c in ws[LINHA_CABECALHO]]

    def idx(nome, ultimo=False):
        pos = [i for i, h in enumerate(cab) if h and str(h).strip() == nome]
        if not pos:
            raise KeyError(f"Coluna não encontrada: {nome}")
        return pos[-1] if ultimo else pos[0]

    i_site = next(i for i, h in enumerate(cab) if h and "ISS DIGITAL" in str(h))
    col = {
        "ibge": idx("Código IBGE"), "numero": idx("Nº Nota Fiscal"), "emissao": idx("Data Emissão"),
        "competencia": idx("Data Emissão", ultimo=True), "fornecedor_nome": idx("Fornecedor") + 1,
        "cnpj": idx("CNPJ/CPF"), "im": idx("Inscrição"), "cod_serv": idx("Cód. Serviço"),
        "valor": idx("Valor TOTAL Serviço"), "base": idx("Base Calculo ISS"),
        "aliq": idx("Aliq. ISS"), "iss": idx("Valor do ISS"), "local_ibge": idx("Loc.Prestação IBGE ADDTAX"),
        "site": i_site,
    }
    notas = []
    for row in ws.iter_rows(min_row=LINHA_CABECALHO + 1, values_only=True):
        if row[col["numero"]] in (None, ""):
            continue
        n = {k: row[i] for k, i in col.items()}
        notas.append(n)
    return notas


# ==================================================
# XML ABRASF 2.03
# ==================================================
def q(tag):
    return f"{{{NS}}}{tag}"


def sub(pai, tag, texto=None):
    e = ET.SubElement(pai, q(tag))
    if texto is not None:
        e.text = str(texto)
    return e


def cpf_cnpj(pai, doc):
    c = sub(pai, "CpfCnpj")
    sub(c, "Cnpj" if len(doc) == 14 else "Cpf", doc)


def montar_lote(cnpj_prest, im_prest, notas, num_lote):
    ET.register_namespace("", NS)
    raiz = ET.Element(q("EnviarLoteRpsEnvio"))
    lote = sub(raiz, "LoteRps")
    lote.set("Id", f"lote{num_lote}")
    lote.set("versao", "2.03")
    sub(lote, "NumeroLote", num_lote)
    pr = sub(lote, "Prestador")
    cpf_cnpj(pr, cnpj_prest)
    if im_prest:
        sub(pr, "InscricaoMunicipal", im_prest)
    sub(lote, "QuantidadeRps", len(notas))
    lista = sub(lote, "ListaRps")

    for n in notas:
        numero = so_digitos(n["numero"])
        aliq = round(float(n["aliq"] or 0), 2)
        rps = sub(lista, "Rps")
        inf = sub(rps, "InfDeclaracaoPrestacaoServico")
        inf.set("Id", f"rps{numero}")

        r = sub(inf, "Rps")
        ident = sub(r, "IdentificacaoRps")
        sub(ident, "Numero", numero)
        sub(ident, "Serie", SERIE_RPS)
        sub(ident, "Tipo", TIPO_RPS)
        sub(r, "DataEmissao", data_iso(n["emissao"]))
        sub(r, "Status", "1")

        sub(inf, "Competencia", data_iso(n["competencia"]))

        serv = sub(inf, "Servico")
        v = sub(serv, "Valores")
        sub(v, "ValorServicos", dec(n["valor"]))
        sub(v, "ValorDeducoes", "0.00")
        sub(v, "ValorIss", dec(n["iss"]))
        sub(v, "Aliquota", dec(aliq / 100 if ALIQUOTA_COMO_FRACAO else aliq, 4))
        sub(serv, "IssRetido", ISS_RETIDO)
        sub(serv, "ItemListaServico", n["cod_serv"])
        sub(serv, "Discriminacao", f"Servico tomado - NF {numero}")
        ibge = so_digitos(n["local_ibge"], 7)[-7:]
        sub(serv, "CodigoMunicipio", ibge)
        sub(serv, "ExigibilidadeISS", EXIGIBILIDADE_ISS)
        sub(serv, "MunicipioIncidencia", ibge)

        p = sub(inf, "Prestador")
        cpf_cnpj(p, cnpj_prest)
        if im_prest:
            sub(p, "InscricaoMunicipal", im_prest)

        t = sub(inf, "TomadorServico")
        it = sub(t, "IdentificacaoTomador")
        cpf_cnpj(it, TOMADOR_CNPJ)
        if TOMADOR_IM:
            sub(it, "InscricaoMunicipal", TOMADOR_IM)
        sub(t, "RazaoSocial", TOMADOR_RAZAO)

        sub(inf, "OptanteSimplesNacional", SIMPLES)
        sub(inf, "IncentivoFiscal", INCENTIVO_FISCAL)
    ET.indent(raiz)
    return ET.ElementTree(raiz)


# ==================================================
# MAIN
# ==================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--nota", help="número da nota (ex.: 25545)")
    ap.add_argument("--ausentes", action="store_true", help="só as 'AUSENTE NO SITE'")
    ap.add_argument("--todas", action="store_true")
    ap.add_argument("--saida", default="xml_abrasf")
    a = ap.parse_args()

    if not so_digitos(TOMADOR_CNPJ, 14).strip("0"):
        sys.exit("Preencha TOMADOR_CNPJ (e TOMADOR_IM) no topo do script.")

    notas = ler_notas(a.xlsx)
    if a.nota:
        notas = [n for n in notas if so_digitos(n["numero"]) == so_digitos(a.nota)]
    elif a.ausentes:
        notas = [n for n in notas if str(n["site"]).strip().upper() == "AUSENTE NO SITE"]
    elif not a.todas:
        sys.exit("Use --nota, --ausentes ou --todas.")
    if not notas:
        sys.exit("Nenhuma nota encontrada.")

    grupos = defaultdict(list)
    for n in notas:
        grupos[(so_digitos(n["cnpj"], 14), so_digitos(n["im"]))].append(n)

    saida = Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)
    for i, ((cnpj, im), lista) in enumerate(sorted(grupos.items()), start=1):
        arq = saida / f"lote_{cnpj}.xml"
        montar_lote(cnpj, im, lista, i).write(arq, encoding="utf-8", xml_declaration=True)
        print(f"{arq}  ({len(lista)} nota(s))")


if __name__ == "__main__":
    main()
