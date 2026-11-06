"""
Endpoint de investigação conversacional.
Recebe uma pergunta sobre um município e retorna a análise dos três agentes.
Injeta os indicadores do banco de dados no contexto de cada agente.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.agents.consolidator_agent import AgenteConsolidador
from app.agents.schemas import ResultadoConsolidado, TarefaAgente
from app.db.database import get_db

router = APIRouter(prefix="/investigar", tags=["investigação"])


_PERGUNTA_MAX_CHARS = 500


class PedidoInvestigacao(BaseModel):
    codigo_ibge: str
    pergunta: str

    @field_validator("pergunta")
    @classmethod
    def validar_tamanho_pergunta(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("A pergunta não pode estar vazia.")
        if len(v) > _PERGUNTA_MAX_CHARS:
            raise ValueError(
                f"A pergunta excede o limite de {_PERGUNTA_MAX_CHARS} caracteres "
                f"({len(v)} fornecidos)."
            )
        return v


_CATEGORIA_LABEL = {"mercado": "mercado", "social": "sociais"}


# Indicadores prioritários por categoria (limitamos a estes para economizar tokens)
_CHAVES_MERCADO = {
    "penetracao_internet_fixa", "cobertura_4g", "pib_per_capita",
    "densidade_movel", "populacao_estimada", "emprego_formal_pct",
}
_CHAVES_SOCIAL = {
    "acesso_internet_domiciliar", "indice_inclusao_digital", "idhm",
    "pobreza_extrema_pct", "taxa_alfabetizacao", "escolas_publicas",
}


def _formatar_indicadores(rows: list, categoria: str) -> str:
    """Formata indicadores do banco em texto compacto para o agente."""
    chaves_ok = _CHAVES_MERCADO if categoria == "mercado" else _CHAVES_SOCIAL
    items = [r for r in rows if r["categoria"] == categoria and r["chave"] in chaves_ok]
    if not items:
        # fallback: qualquer indicador da categoria (máx 6)
        items = [r for r in rows if r["categoria"] == categoria][:6]
    if not items:
        return f"Nenhum indicador de {categoria} disponível."

    linhas = []
    for r in items:
        valor = r["valor_num"] if r["valor_num"] is not None else r["valor_txt"]
        if valor is None:
            valor_str = "N/D"
        elif isinstance(valor, float) and valor == int(valor):
            valor_str = str(int(valor))
        else:
            valor_str = str(valor)
        unidade = f" {r['unidade']}" if r["unidade"] else ""
        linhas.append(
            f"{r['nome']}: {valor_str}{unidade} ({r['fonte']}, {r['periodo']}, {r['tipo']})"
        )
    return "\n".join(linhas)


@router.post("", response_model=ResultadoConsolidado)
async def investigar(pedido: PedidoInvestigacao) -> ResultadoConsolidado:
    """
    Aciona os três agentes (Mercado, Social e Consolidador) para investigar
    um município. Mercado e Social executam em paralelo com os dados do banco.
    """
    db = await get_db()
    try:
        # Busca o município
        rows_muni = await db.execute_fetchall(
            "SELECT nome FROM municipios WHERE codigo_ibge = ?",
            (pedido.codigo_ibge,),
        )
        if not rows_muni:
            raise HTTPException(
                status_code=404,
                detail=f"Município com código IBGE {pedido.codigo_ibge} não encontrado.",
            )

        nome_municipio = rows_muni[0]["nome"]

        # Carrega indicadores do banco para injetar nos agentes
        rows_ind = await db.execute_fetchall(
            """
            SELECT categoria, chave, nome, valor_num, valor_txt,
                   unidade, fonte, periodo, tipo, limitacoes
            FROM indicadores
            WHERE codigo_ibge = ?
            ORDER BY categoria, chave
            """,
            (pedido.codigo_ibge,),
        )
    finally:
        await db.close()

    # Formata indicadores por pilar para contexto dos agentes
    contexto_mercado = _formatar_indicadores(rows_ind, "mercado")
    contexto_social  = _formatar_indicadores(rows_ind, "social")

    consolidador = AgenteConsolidador()

    return await consolidador.investigar(
        codigo_ibge=pedido.codigo_ibge,
        nome_municipio=nome_municipio,
        pergunta=pedido.pergunta,
        contexto_mercado=contexto_mercado,
        contexto_social=contexto_social,
    )
