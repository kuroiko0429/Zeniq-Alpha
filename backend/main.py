# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import products, orders, sales, auth

app = FastAPI(title="学校祭POS API")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(sales.router)
app.include_router(auth.router)