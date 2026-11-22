"""Optional vision and chat service. The Express API works without it."""
from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel

app = FastAPI(title="Mesob AI service")


class ChatIn(BaseModel):
    message: str
    context: dict
    lang: str = "en"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    label = "injera" if "injera" in name else "shiro"
    return {"guesses": [{"label": label, "confidence": 0.62}, {"label": "misir wot", "confidence": 0.41}]}


@app.post("/chat")
def chat(body: ChatIn):
    foods = body.context.get("foods") or []
    notice = body.context.get("notice") or ""
    if not foods:
        return {"reply": f"The context has no foods to quote. {notice}".strip()}
    food = foods[0]
    reply = (
        f"{food.get('name_en')} is listed at {food.get('kcal')} kcal and "
        f"{food.get('carbs_g')} g carbohydrate per portion. {notice}"
    )
    return {"reply": reply.strip()}
