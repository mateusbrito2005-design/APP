"""
Boletim de Legislação -> Planilha de controle (CSC Operações / Apurações Fiscais)

Uso:
    python BOLETIM.py            # gera a planilha final
    python BOLETIM.py --dump     # grava o texto de cada <td> do 1º boletim (para ajustar o parser)
"""
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side

# ==================================================
# CONFIGURAÇÃO
# ==================================================
CAIXA_POSTAL = "matesi05@braskem.com"      # nome da caixa como aparece no Outlook
PASTA = "Boletim"
FILTRO_ASSUNTO = "Boletim de Legislação"
ARQUIVO_SAIDA = Path.home() / "Downloads" / "Controle_Boletim_CSC.xlsx"

AREAS_CSC = ["CSC Operações Fiscais", "CSC Apurações Fiscais"]

UFS_GREEN = {"SP", "RS", "PR"}             # Braskem Green
UFS_VOQEN = {"SP", "RJ", "BA"}             # Voqen
TODAS_UFS = (
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
).split()

# Municípios no escopo (nome sem acento -> empresa(s))
MUNICIPIOS = {
    "sao paulo": "Braskem Green / Voqen",
    "rio de janeiro": "Voqen",
    "salvador": "Voqen",
    "triunfo": "Braskem Green",
    "araucaria": "Braskem Green",
}
MUNICIPAL_FORA_DO_ESCOPO = "revisar"       # "revisar" = mantém marcado | "descartar"

PALAVRAS_LAIS = ["ICMS", "IPI", "ISS"]     # demais -> GABI

COLUNAS = ["Nº Boletim", "Tema", "Analista responsável", "Ação demandada", "Tarefa"]
COL_REVISAO = "Revisão manual"             # coluna extra; apague se não quiser

# Começo típico de título de publicação (usado só para não confundir título com texto de ação)
TITULO_RE = re.compile(
    r"^(Federal|Estadual|Municipal|CONFAZ|Reforma Tribut|Com[eé]rcio Exterior|ICMS|ISS|IPI|"
    r"Trabalhista|Previdenci)",
    re.I,
)

ROTULOS = {
    "ato": "Ato:",
    "area": "Área(s) conhecimento(s):",
    "vigencia": "Vigência:",
    "impacto": "Impacto:",
    "acoes": "Áreas/Ações",
}


# ==================================================
# UTILITÁRIOS
# ==================================================
def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def linhas_limpas(texto):
    linhas = [re.sub(r"[ \t\xa0]+", " ", l).strip() for l in texto.splitlines()]
    return [l for l in linhas if l]


def valor_apos(linhas, rotulo):
    """Texto (com quebras de linha preservadas) depois do rótulo."""
    bruto = "\n".join(linhas)
    m = re.search(re.escape(rotulo), bruto, re.I)
    if not m:
        # rótulo pode ter acento diferente: tenta normalizado
        i = norm(bruto).find(norm(rotulo))
        return bruto[i + len(rotulo):].strip(" :\n") if i >= 0 else bruto
    return bruto[m.end():].strip(" :\n")


def numero_boletim(assunto):
    m = re.search(r"(\d{1,3}\s*/\s*\d{4})", assunto)
    return m.group(1).replace(" ", "") if m else ""


def analista(tema):
    return "LAÍS" if any(re.search(rf"\b{p}\b", tema) for p in PALAVRAS_LAIS) else "GABI"


# ==================================================
# PARSER DO HTML
# ==================================================
def tds_folha(html):
    soup = BeautifulSoup(html, "html.parser")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for t in soup.find_all(["p", "div", "li", "tr"]):
        t.append("\n")
    # só células sem tabela aninhada (evita duplicar texto das células externas)
    return [td for td in soup.find_all(["td", "th"]) if not td.find(["td", "th"])]


def detecta_rotulo(col):
    n = norm(col)
    for chave, rot in ROTULOS.items():
        if n.startswith(norm(rot)):
            return chave
    return None


def parse_boletim(html):
    """Retorna lista de publicações (dict) do e-mail."""
    pubs, pub = [], None
    vistos, candidato, secao, em_acoes = set(), None, None, False

    def novo():
        return {"titulo": candidato or "", "secao": secao, "ato": "", "area": "",
                "vigencia": "", "impacto": "", "acoes_raw": [], "bloco": [candidato or ""]}

    for td in tds_folha(html):
        linhas = linhas_limpas(td.get_text())
        if not linhas:
            continue
        col = " ".join(linhas)

        # cabeçalho de seção
        m = re.fullmatch(r"(Federais?|Estaduais?|Municipais?)\s*:?", col, re.I)
        if m:
            if pub:
                pubs.append(pub)
            pub, vistos, candidato, em_acoes = None, set(), None, False
            secao = norm(m.group(1))[:3].upper()   # FED / EST / MUN
            continue

        chave = detecta_rotulo(col)

        if chave is None:
            if TITULO_RE.match(col) and " - " in col:
                candidato, em_acoes = col, False
            elif em_acoes and pub:
                pub["acoes_raw"].extend(linhas)
                pub["bloco"].append(col)
            elif len(col) > 25:
                candidato = col
                if pub:
                    pub["bloco"].append(col)
            continue

        # rótulo repetido => começou outra publicação
        if pub is None or chave in vistos:
            if pub:
                pubs.append(pub)
            pub, vistos = novo(), set()
        vistos.add(chave)
        pub["bloco"].append(col)
        em_acoes = chave == "acoes"

        if chave == "acoes":
            resto = valor_apos(linhas, ROTULOS["acoes"])
            resto = re.sub(r"^[:\s]+", "", resto)
            pub["acoes_raw"].extend(linhas_limpas(resto))
        elif chave == "impacto":
            pub["impacto"] = valor_apos(linhas, ROTULOS["impacto"])      # texto integral
        else:
            pub[chave] = re.sub(r"\s+", " ", valor_apos(linhas, ROTULOS[chave])).strip()

    if pub:
        pubs.append(pub)
    return pubs


def extrair_acoes(tokens):
    """{area_csc: texto_da_acao ('' se só citada)} a partir das linhas de Áreas/Ações."""
    res, pendente = {}, None
    for tok in tokens:
        achou = None
        for area in AREAS_CSC:
            m = re.search(re.escape(norm(area)), norm(tok))
            if m:
                achou = (area, m)
                break
        if achou:
            area, m = achou
            # posição equivalente no texto original (norm preserva o tamanho)
            resto = tok[m.end():].lstrip(" :-–—\t").strip()
            res.setdefault(area, "")
            if resto:
                res[area] = resto
                pendente = None
            else:
                pendente = area
        elif pendente:
            res[pendente] = tok.strip()
            pendente = None
    return res


# ==================================================
# REGRAS DE NEGÓCIO
# ==================================================
def tipo_publicacao(p):
    if p["secao"] == "FED":
        return "FEDERAL"
    if p["secao"] == "EST":
        return "ESTADUAL"
    if p["secao"] == "MUN":
        return "MUNICIPAL"
    t = norm(p["titulo"])
    if t.startswith("federal"):
        return "FEDERAL"
    if "municip" in t:
        return "MUNICIPAL"
    if "confaz" in t or "estadual" in t or ufs_do_titulo(p["titulo"]):
        return "ESTADUAL"
    return "FEDERAL"


def ufs_do_titulo(titulo):
    return {u for u in re.findall(r"\b([A-Z]{2})\b", titulo) if u in TODAS_UFS}


def abrangencia(p, tipo):
    """-> (manter: bool, revisar: str)"""
    if tipo == "FEDERAL":
        return True, ""

    if tipo == "MUNICIPAL":
        for texto in (norm(p["titulo"]), norm(" ".join(p["bloco"]))):
            for cidade in MUNICIPIOS:
                if re.search(rf"\b{cidade}\b", texto):
                    return True, ""
        if MUNICIPAL_FORA_DO_ESCOPO == "descartar":
            return False, ""
        return True, "Municipal: município não identificado no escopo"

    ufs = ufs_do_titulo(p["titulo"])
    bloco = norm(" ".join(p["bloco"]))
    green, voqen = "green" in bloco, "voqen" in bloco

    if not ufs:
        return True, "Estadual sem UF identificada no tema"
    if not (ufs & (UFS_GREEN | UFS_VOQEN)):
        return False, ""
    if not (green or voqen):
        return True, "Empresa não identificada (UF no escopo)"
    if (green and ufs & UFS_GREEN) or (voqen and ufs & UFS_VOQEN):
        return True, ""
    return False, ""


def avaliar(p):
    """Retorna linha da planilha ou None se a publicação não é relevante."""
    acoes = extrair_acoes(p["acoes_raw"])
    areas_conh = [a for a in AREAS_CSC if norm(a) in norm(p["area"])]
    if not areas_conh and not acoes:
        return None

    manter, revisar = abrangencia(p, tipo_publicacao(p))
    if not manter:
        return None

    textos = []
    for t in acoes.values():
        if t and t not in textos:
            textos.append(t)
    acao = " | ".join(textos) if textos else "Conhecimento"

    return {
        "Tema": p["titulo"],
        "Analista responsável": analista(p["titulo"]),
        "Ação demandada": acao,
        "Tarefa": p["impacto"],
        COL_REVISAO: revisar,
    }


# ==================================================
# EXCEL
# ==================================================
def salvar(df, caminho):
    df.to_excel(caminho, index=False)
    wb = load_workbook(caminho)
    ws = wb.active
    borda = Border(*(Side(style="thin"),) * 4)
    azul = PatternFill("solid", fgColor="1F4E78")
    for row in ws.iter_rows():
        for c in row:
            c.border = borda
            c.alignment = Alignment(wrap_text=True, vertical="top")
    for c in ws[1]:
        c.fill, c.font = azul, Font(color="FFFFFF", bold=True)
    for col, w in zip("ABCDEF", (12, 80, 20, 60, 120, 40)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    wb.save(caminho)


# ==================================================
# MAIN (Outlook)
# ==================================================
def main():
    import win32com.client

    dump = "--dump" in sys.argv
    ns = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
    try:
        caixa = ns.Folders[CAIXA_POSTAL]
    except Exception:
        print("Caixa não encontrada. Disponíveis:", [f.Name for f in ns.Folders])
        return
    emails = caixa.Folders[PASTA].Items
    emails.Sort("[ReceivedTime]", True)

    linhas, vistos, total_pubs = [], set(), 0
    for email in emails:
        try:
            assunto = str(email.Subject)
            if FILTRO_ASSUNTO not in assunto:
                continue
            print(f"Processando: {assunto}")
            if dump:
                dump_path = Path(__file__).with_name("dump_boletim.txt")
                with open(dump_path, "w", encoding="utf-8") as f:
                    for i, td in enumerate(tds_folha(email.HTMLBody)):
                        f.write(f"--- td {i} ---\n{td.get_text()}\n")
                print("Dump gravado em", dump_path)
                return
            num = numero_boletim(assunto)
            pubs = parse_boletim(email.HTMLBody)
            total_pubs += len(pubs)
            for p in pubs:
                r = avaliar(p)
                if not r:
                    continue
                chave = (num, r["Tema"])
                if chave in vistos:
                    continue
                vistos.add(chave)
                linhas.append({"Nº Boletim": num, **r})
        except Exception as erro:
            print(f"ERRO: {erro}")

    df = pd.DataFrame(linhas, columns=COLUNAS + [COL_REVISAO])
    salvar(df, ARQUIVO_SAIDA)
    print("=" * 50)
    print(f"Publicações lidas: {total_pubs} | Relevantes: {len(df)}")
    print(f"A revisar manualmente: {(df[COL_REVISAO] != '').sum()}")
    print(ARQUIVO_SAIDA)


if __name__ == "__main__":
    main()
