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


def _formatar_indicadores(rows: list, categoria: str) -> str:
    """Formata indicadores do banco em texto estruturado para o agente."""
    items = [r for r in rows if r["categoria"] == categoria]
    if not items:
        label = _CATEGORIA_LABEL.get(categoria, categoria)
        return f"Nenhum indicador {label} disponível para este município."

    linhas = []
    for r in items:
        valor = r["valor_num"] if r["valor_num"] is not None else r["valor_txt"]
        if valor is None:
            valor_str = "indisponível"
        elif isinstance(valor, float) and valor == int(valor):
            valor_str = str(int(valor))
        else:
            valor_str = str(valor)

        unidade = f" {r['unidade']}" if r["unidade"] else ""
        lim = f" | Limitação: {r['limitacoes']}" if r["limitacoes"] else ""
        linhas.append(
            f"- {r['nome']}: {valor_str}{unidade} "
            f"[Fonte: {r['fonte']}, Período: {r['periodo']}, Tipo: {r['tipo']}]{lim}"
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
